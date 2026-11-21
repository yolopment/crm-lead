import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { streamAudioFile, processAndSaveAudio, streamAudioOrRedirect } from '../services/storage.service.js';
import { CallDirection, CallStatus, LeadStage, Role } from '@prisma/client';
import path from 'path';

export class CallController {
  /**
   * Synchronize call logs from the Android Companion App
   */
  static async syncCalls(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const userId = req.user!.id;
      const { calls } = req.body; // Array of call objects from Android SQLite Room

      if (!Array.isArray(calls) || calls.length === 0) {
        res.status(400).json({ error: 'Payload must include an array of calls.' });
        return;
      }

      const syncedRecords = [];

      for (const item of calls) {
        const {
          phoneNumber,
          contactName,
          direction,
          status,
          durationSec = 0,
          startedAt,
          endedAt,
          notes,
          deviceId,
        } = item;

        if (!phoneNumber) continue;

        // Clean phone number (strip whitespace, dashes)
        const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
        const callStartTime = startedAt ? new Date(startedAt) : new Date();
        const trimmedContactName = contactName?.trim();

        // Check if phone number is in Company DNT or User's Private Numbers
        const isCompanyDnt = await prisma.doNotTrack.findFirst({
          where: { orgId, phone: cleanPhone },
        });
        const isPrivateNumber = await prisma.privateNumber.findFirst({
          where: { userId, phone: cleanPhone },
        });

        if (isCompanyDnt || isPrivateNumber) {
          syncedRecords.push({ id: `dnt-${cleanPhone}`, status: 'ignored_dnt' });
          continue;
        }

        // Check if this exact call was already logged to prevent duplicates
        const existingCall = await prisma.call.findFirst({
          where: {
            orgId,
            userId,
            phoneNumber: cleanPhone,
            startedAt: {
              gte: new Date(callStartTime.getTime() - 2000),
              lte: new Date(callStartTime.getTime() + 2000),
            },
          },
        });

        if (existingCall) {
          // If we now have a contact name from the phonebook, upgrade the associated lead name!
          if (trimmedContactName) {
            const existingLead = await prisma.lead.findFirst({
              where: { orgId, phone: cleanPhone },
            });
            if (existingLead && (!existingLead.fullName || existingLead.fullName.startsWith('Lead (') || existingLead.fullName === cleanPhone)) {
              await prisma.lead.update({
                where: { id: existingLead.id },
                data: { fullName: trimmedContactName },
              });
            }
          }
          syncedRecords.push({ id: existingCall.id, status: 'already_synced' });
          continue;
        }

        // 1. Find or auto-create corresponding Lead by phone number
        let lead = await prisma.lead.findFirst({
          where: {
            orgId,
            phone: cleanPhone,
          },
        });

        if (!lead) {
          lead = await prisma.lead.create({
            data: {
              orgId,
              phone: cleanPhone,
              fullName: trimmedContactName || (cleanPhone.length >= 4 ? `Lead (${cleanPhone.slice(-4)})` : cleanPhone),
              source: direction === 'INBOUND' ? 'inbound_call' : 'outbound_call',
              assignedToId: userId,
              stage: durationSec > 0 ? LeadStage.CONTACTED : LeadStage.NEW,
            },
          });
        } else if (trimmedContactName && (!lead.fullName || lead.fullName.startsWith('Lead (') || lead.fullName === cleanPhone)) {
          // Upgrade generic placeholder lead name to the phonebook contact name
          lead = await prisma.lead.update({
            where: { id: lead.id },
            data: { fullName: trimmedContactName },
          });
        }

        // 2. Map Call Direction and Status
        const callDir = direction === 'INBOUND' ? CallDirection.INBOUND : CallDirection.OUTBOUND;
        const callStatus =
          status === 'MISSED'
            ? CallStatus.MISSED
            : status === 'BUSY'
            ? CallStatus.BUSY
            : CallStatus.CONNECTED;

        // 3. Create Call record in SQL database
        const createdCall = await prisma.call.create({
          data: {
            orgId,
            userId,
            leadId: lead.id,
            phoneNumber: cleanPhone,
            direction: callDir,
            status: callStatus,
            durationSec: Math.max(0, parseInt(durationSec, 10) || 0),
            startedAt: callStartTime,
            endedAt: endedAt ? new Date(endedAt) : null,
            notes,
            deviceId,
          },
        });

        syncedRecords.push({
          id: createdCall.id,
          status: 'created',
          readyForAudioUpload: true,
        });
      }

      // Update device last sync timestamp
      await prisma.device.updateMany({
        where: { userId },
        data: { lastSyncAt: new Date() },
      });

      res.status(200).json({
        message: `Successfully processed ${syncedRecords.length} calls.`,
        synced: syncedRecords,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Call synchronization failed.' });
    }
  }

  /**
   * Upload audio recording for a specific call from Android Companion App
   */
  static async uploadRecording(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const orgId = req.user!.orgId;

      if (!req.file) {
        res.status(400).json({ error: 'No audio file provided in request body.' });
        return;
      }

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId },
      });

      if (!call) {
        res.status(404).json({ error: 'Call record not found.' });
        return;
      }

      if (req.user!.role === Role.AGENT && call.userId !== req.user!.id) {
        res.status(403).json({ error: 'Access denied: You can only upload audio for your own calls.' });
        return;
      }

      // Process and save audio file (uploads to Cloudflare R2 / Google Drive / local disk)
      const { audioPath, audioSize, gdriveUrl } = await processAndSaveAudio(req.file, orgId, call.id);

      const updatedCall = await prisma.call.update({
        where: { id: call.id },
        data: {
          audioPath,
          audioSize,
          gdriveUrl: gdriveUrl || undefined,
        },
      });

      res.status(200).json({
        message: 'Audio recording successfully uploaded and attached to call.',
        callId: updatedCall.id,
        audioSize: updatedCall.audioSize,
        audioPath: updatedCall.audioPath,
        gdriveUrl: updatedCall.gdriveUrl,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload audio recording.' });
    }
  }

  /**
   * Upload and attach audio recording by matching phone number and call timestamp
   */
  static async uploadByMatch(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { phoneNumber, startedAt, durationSec, callId, contactName } = req.body;
      const trimmedContactName = contactName?.trim();

      if (!req.file) {
        res.status(400).json({ error: 'No audio file provided in request body.' });
        return;
      }

      // Clean phone number (strip spaces, symbols)
      const cleanPhone = (phoneNumber || '').replace(/[\s\-\(\)]/g, '');
      const callTime = startedAt ? new Date(startedAt) : null;

      let call = null;

      // 1. Direct ID match if supplied
      if (callId) {
        call = await prisma.call.findFirst({
          where: { id: callId, orgId },
        });
      }

      // 2. Match by phone and timestamp window (+- 3 minutes)
      if (!call && cleanPhone && callTime && !isNaN(callTime.getTime())) {
        call = await prisma.call.findFirst({
          where: {
            orgId,
            phoneNumber: { contains: cleanPhone.slice(-7) },
            startedAt: {
              gte: new Date(callTime.getTime() - 180000),
              lte: new Date(callTime.getTime() + 180000),
            },
          },
          orderBy: { startedAt: 'desc' },
        });
      }

      // 3. Fallback: match most recent call with this phone number
      if (!call && cleanPhone) {
        call = await prisma.call.findFirst({
          where: {
            orgId,
            phoneNumber: { contains: cleanPhone.slice(-7) },
          },
          orderBy: { startedAt: 'desc' },
        });
      }

      if (call) {
        const { audioPath, audioSize, gdriveUrl } = await processAndSaveAudio(req.file, orgId, call.id);

        const updatedCall = await prisma.call.update({
          where: { id: call.id },
          data: {
            audioPath,
            audioSize,
            gdriveUrl: gdriveUrl || undefined,
          },
        });

        if (trimmedContactName && call.leadId) {
          const existingLead = await prisma.lead.findUnique({ where: { id: call.leadId } });
          if (existingLead && (!existingLead.fullName || existingLead.fullName.startsWith('Lead (') || existingLead.fullName === cleanPhone)) {
            await prisma.lead.update({
              where: { id: existingLead.id },
              data: { fullName: trimmedContactName },
            });
          }
        }

        console.log(`🎙️ Recording matched and attached to call ${call.id} (${call.phoneNumber})`);

        res.status(200).json({
          success: true,
          message: 'Audio recording matched and attached to call.',
          callId: updatedCall.id,
          audioSize: updatedCall.audioSize,
          audioPath: updatedCall.audioPath,
          gdriveUrl: updatedCall.gdriveUrl,
        });
        return;
      }

      // 4. If no call exists yet, create the call and attach audio!
      let lead = await prisma.lead.findFirst({
        where: { orgId, phone: { contains: cleanPhone.slice(-7) } },
      });

      if (!lead && cleanPhone) {
        lead = await prisma.lead.create({
          data: {
            orgId,
            phone: cleanPhone,
            fullName: trimmedContactName || (cleanPhone.length >= 4 ? `Lead (${cleanPhone.slice(-4)})` : cleanPhone),
            source: 'inbound_call',
            assignedToId: req.user!.id,
          },
        });
      } else if (lead && trimmedContactName && (!lead.fullName || lead.fullName.startsWith('Lead (') || lead.fullName === cleanPhone)) {
        lead = await prisma.lead.update({
          where: { id: lead.id },
          data: { fullName: trimmedContactName },
        });
      }

      const tempCallId = `new-${Date.now()}`;
      const { audioPath, audioSize, gdriveUrl } = await processAndSaveAudio(req.file, orgId, tempCallId);

      const newCall = await prisma.call.create({
        data: {
          orgId,
          userId: req.user!.id,
          leadId: lead ? lead.id : undefined,
          phoneNumber: cleanPhone || 'Unknown',
          direction: CallDirection.INBOUND,
          status: CallStatus.CONNECTED,
          durationSec: parseInt(durationSec, 10) || 0,
          startedAt: callTime || new Date(),
          audioPath,
          audioSize,
          gdriveUrl: gdriveUrl || undefined,
        },
      });

      console.log(`🎙️ Recording created new call ${newCall.id} with audio attached!`);

      res.status(200).json({
        success: true,
        message: 'New call created and recording attached.',
        callId: newCall.id,
        audioSize: newCall.audioSize,
        audioPath: newCall.audioPath,
        gdriveUrl: newCall.gdriveUrl,
      });
    } catch (error: any) {
      console.error('Error in uploadByMatch:', error);
      res.status(500).json({ error: error.message || 'Failed to attach recording.' });
    }
  }

  /**
   * Stream call audio with range seeking support for web dashboard
   */
  static async streamAudio(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const orgId = req.user!.orgId;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId },
      });

      if (!call || !call.audioPath) {
        res.status(404).json({ error: 'No audio recording found for this call.' });
        return;
      }

      // Restrict audio playback: Agents can ONLY listen to their own calls
      if (req.user!.role === Role.AGENT && call.userId !== req.user!.id) {
        res.status(403).json({ error: 'Forbidden: You cannot access audio recordings from another agent.' });
        return;
      }

      await streamAudioOrRedirect(call.audioPath, req, res);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Error streaming audio recording.' });
    }
  }

  /**
   * List calls with multi-criteria filtering for dashboard
   */
  static async getCalls(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const isAgent = req.user!.role === Role.AGENT;
      const {
        agentId,
        direction,
        status,
        range = 'last_7_days',
        search,
        page = '1',
        limit = '50',
      } = req.query;

      const whereClause: any = { orgId };

      if (isAgent) {
        // Enforce data isolation: Agents ONLY see calls made by themselves
        whereClause.userId = req.user!.id;
      } else if (agentId && agentId !== 'all') {
        whereClause.userId = String(agentId);
      }

      if (direction && direction !== 'all') {
        whereClause.direction = direction === 'INBOUND' ? CallDirection.INBOUND : CallDirection.OUTBOUND;
      }

      if (status && status !== 'all') {
        whereClause.status = status as CallStatus;
      }

      // Date range filtering
      const now = new Date();
      if (range === 'today') {
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        whereClause.startedAt = { gte: startOfDay };
      } else if (range === 'last_7_days') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        whereClause.startedAt = { gte: sevenDaysAgo };
      } else if (range === 'last_30_days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        whereClause.startedAt = { gte: thirtyDaysAgo };
      }

      if (search) {
        const term = String(search);
        whereClause.OR = [
          { phoneNumber: { contains: term } },
          { notes: { contains: term } },
          { lead: { fullName: { contains: term } } },
        ];
      }

      const pageNum = parseInt(String(page), 10) || 1;
      const limitNum = parseInt(String(limit), 10) || 50;

      const [calls, totalCount] = await Promise.all([
        prisma.call.findMany({
          where: whereClause,
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
            lead: {
              select: { id: true, fullName: true, stage: true, tags: true },
            },
          },
          orderBy: { startedAt: 'desc' },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        prisma.call.count({ where: whereClause }),
      ]);

      const formattedCalls = calls.map((c) => ({
        id: c.id,
        phoneNumber: c.phoneNumber,
        direction: c.direction,
        status: c.status,
        durationSec: c.durationSec,
        durationFormatted: `${Math.floor(c.durationSec / 60)}m ${String(c.durationSec % 60).padStart(2, '0')}s`,
        startedAt: c.startedAt,
        notes: c.notes,
        tags: c.tags,
        hasAudio: !!c.audioPath,
        audioUrl: c.audioPath ? `/api/v1/calls/${c.id}/audio` : null,
        gdriveUrl: c.gdriveUrl || null,
        agent: c.user,
        lead: c.lead,
      }));

      res.status(200).json({
        calls: formattedCalls,
        pagination: {
          total: totalCount,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(totalCount / limitNum),
        },
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch calls.' });
    }
  }

  /**
   * Calculate top-level overview KPIs (identical to LeadZam header metrics)
   */
  static async getStats(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { agentId, range = 'last_7_days' } = req.query;

      const whereClause: any = { orgId };
      if (req.user!.role === Role.AGENT) {
        whereClause.userId = req.user!.id;
      } else if (agentId && agentId !== 'all') {
        whereClause.userId = String(agentId);
      }

      const now = new Date();
      if (range === 'today') {
        whereClause.startedAt = { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) };
      } else if (range === 'last_7_days') {
        whereClause.startedAt = { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) };
      } else if (range === 'last_30_days') {
        whereClause.startedAt = { gte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) };
      }

      const calls = await prisma.call.findMany({
        where: whereClause,
        select: {
          id: true,
          status: true,
          durationSec: true,
          phoneNumber: true,
          direction: true,
        },
      });

      const totalCalls = calls.length;
      const connectedCalls = calls.filter((c) => c.status === CallStatus.CONNECTED).length;
      const connectRate = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 100) : 0;
      const totalTalkTimeSec = calls.reduce((sum, c) => sum + (c.durationSec || 0), 0);
      const uniqueNumbers = new Set(calls.map((c) => c.phoneNumber)).size;
      const longCalls = calls.filter((c) => c.durationSec >= 300).length; // 5+ min

      res.status(200).json({
        totalCalls,
        connectedCalls,
        connectRate,
        totalTalkTimeSec,
        talkTimeFormatted: `${Math.floor(totalTalkTimeSec / 60)}m`,
        uniqueCalls: uniqueNumbers,
        longCalls,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to calculate call statistics.' });
    }
  }

  /**
   * Call Activity reports with daily breakdown and direction split
   */
  static async getActivity(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { range = 'last_7_days', agentId } = req.query;

      const whereClause: any = { orgId };
      if (req.user!.role === Role.AGENT) {
        whereClause.userId = req.user!.id;
      } else if (agentId && agentId !== 'all') {
        whereClause.userId = String(agentId);
      }

      const now = new Date();
      const days = range === 'last_30_days' ? 30 : 7;
      const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
      whereClause.startedAt = { gte: startDate };

      const calls = await prisma.call.findMany({
        where: whereClause,
        orderBy: { startedAt: 'asc' },
      });

      // Group calls by date string (YYYY-MM-DD)
      const dayMap: Record<string, { inbound: number; outbound: number; connected: number; talkTime: number }> = {};

      for (let i = 0; i <= days; i++) {
        const d = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dateKey = d.toISOString().split('T')[0];
        dayMap[dateKey] = { inbound: 0, outbound: 0, connected: 0, talkTime: 0 };
      }

      for (const call of calls) {
        const dateKey = call.startedAt.toISOString().split('T')[0];
        if (!dayMap[dateKey]) {
          dayMap[dateKey] = { inbound: 0, outbound: 0, connected: 0, talkTime: 0 };
        }

        if (call.direction === CallDirection.INBOUND) {
          dayMap[dateKey].inbound++;
        } else {
          dayMap[dateKey].outbound++;
        }

        if (call.status === CallStatus.CONNECTED) {
          dayMap[dateKey].connected++;
          dayMap[dateKey].talkTime += call.durationSec;
        }
      }

      const chartData = Object.entries(dayMap).map(([date, data]) => {
        const total = data.inbound + data.outbound;
        return {
          date,
          inbound: data.inbound,
          outbound: data.outbound,
          total,
          connected: data.connected,
          connectRate: total > 0 ? Math.round((data.connected / total) * 100) : 0,
          talkTimeSec: data.talkTime,
          avgDurationSec: data.connected > 0 ? Math.round(data.talkTime / data.connected) : 0,
        };
      });

      res.status(200).json(chartData);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch call activity data.' });
    }
  }

  /**
   * Add note or tag to a call
   */
  static async addNote(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const orgId = req.user!.orgId;
      const { notes, tags } = req.body;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId },
      });

      if (!call) {
        res.status(404).json({ error: 'Call not found.' });
        return;
      }

      if (req.user!.role === Role.AGENT && call.userId !== req.user!.id) {
        res.status(403).json({ error: 'Access denied: You can only set outcomes on your own calls.' });
        return;
      }

      const updated = await prisma.call.update({
        where: { id: call.id },
        data: {
          notes: notes !== undefined ? notes : call.notes,
          tags: tags !== undefined ? tags : call.tags,
        },
      });

      res.status(200).json(updated);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to update call note.' });
    }
  }

  /**
   * Set Call Outcome (Connected / Not connected, outcome chip, notes, follow-up, stage update)
   */
  static async setOutcome(req: Request, res: Response): Promise<void> {
    try {
      const { callId } = req.params;
      const orgId = req.user!.orgId;
      const userId = req.user!.id;
      const { status, outcome, notes, scheduleFollowup, followupDate, updateLeadStage } = req.body;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId },
        include: { lead: true },
      });

      if (!call) {
        res.status(404).json({ error: 'Call not found.' });
        return;
      }

      if (req.user!.role === Role.AGENT && call.userId !== req.user!.id) {
        res.status(403).json({ error: 'Access denied: You can only set outcomes on your own calls.' });
        return;
      }

      const callStatus = status === 'NOT_CONNECTED' || status === 'MISSED' ? 'MISSED' : 'CONNECTED';

      const updatedCall = await prisma.call.update({
        where: { id: call.id },
        data: {
          status: callStatus,
          tags: outcome || call.tags,
          notes: notes !== undefined ? notes : call.notes,
        },
      });

      // If updateLeadStage was requested or if outcome implies a stage
      if (call.leadId && (updateLeadStage || outcome === 'Converted')) {
        const newStage = updateLeadStage || (outcome === 'Converted' ? 'WON' : undefined);
        if (newStage) {
          await prisma.lead.update({
            where: { id: call.leadId },
            data: { stage: newStage },
          });
        }
      }

      // If follow-up was toggled ON
      if (scheduleFollowup && call.leadId && followupDate) {
        await prisma.followUp.create({
          data: {
            orgId,
            leadId: call.leadId,
            assignedToId: userId,
            type: 'CALL',
            title: `Follow-up call (${outcome || 'Outcome'})`,
            note: notes || undefined,
            scheduledAt: new Date(followupDate),
            status: 'PENDING',
            priority: 'NORMAL',
          },
        });
      }

      res.status(200).json({ success: true, call: updatedCall });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to set call outcome.' });
    }
  }

  /**
   * Get unresolved missed callbacks with SLA tracking and callback reconciliation
   */
  static async getMissedCallbacks(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const {
        range = 'last_24_hours',
        slaThreshold = '1h',
        status = 'all',
      } = req.query;

      const now = new Date();
      let lookBackDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 24h default

      if (range === 'last_7_days') {
        lookBackDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (range === 'last_30_days') {
        lookBackDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (range === 'all') {
        lookBackDate = new Date(0);
      }

      // Parse SLA threshold in milliseconds
      let slaThresholdMs = 60 * 60 * 1000; // 1 hour default
      if (slaThreshold === '30m') slaThresholdMs = 30 * 60 * 1000;
      else if (slaThreshold === '2h') slaThresholdMs = 2 * 60 * 60 * 1000;
      else if (slaThreshold === '4h') slaThresholdMs = 4 * 60 * 60 * 1000;
      else if (slaThreshold === '24h') slaThresholdMs = 24 * 60 * 60 * 1000;

      // 1. Fetch all inbound missed calls within lookBack window
      const missedWhere: any = {
        orgId,
        direction: CallDirection.INBOUND,
        status: CallStatus.MISSED,
        startedAt: { gte: lookBackDate },
      };
      if (req.user!.role === Role.AGENT) {
        missedWhere.userId = req.user!.id;
      }

      const missedCalls = await prisma.call.findMany({
        where: missedWhere,
        include: {
          user: {
            select: { id: true, name: true, email: true },
          },
          lead: {
            select: { id: true, fullName: true, stage: true, phone: true },
          },
        },
        orderBy: { startedAt: 'desc' },
      });

      // Filter out manually resolved calls
      const activeMissed = missedCalls.filter((c) => !c.tags?.includes('resolved_callback'));

      // Group by phone number (taking the latest missed call per number)
      const phoneMap = new Map<string, typeof activeMissed>();
      for (const m of activeMissed) {
        if (!phoneMap.has(m.phoneNumber)) {
          phoneMap.set(m.phoneNumber, []);
        }
        phoneMap.get(m.phoneNumber)!.push(m);
      }

      const unresolvedItems = [];
      let notAttemptedCount = 0;
      let triedNoNextStepCount = 0;
      let breachedCount = 0;

      for (const [phone, list] of phoneMap.entries()) {
        const latestMissed = list[0]; // ordered desc

        // Check subsequent calls to this phone number after the missed call
        const subsequentCalls = await prisma.call.findMany({
          where: {
            orgId,
            phoneNumber: phone,
            startedAt: { gt: latestMissed.startedAt },
          },
          orderBy: { startedAt: 'asc' },
        });

        // If any connected call occurred subsequently, this lead is resolved!
        const connectedCallback = subsequentCalls.find((c) => c.status === CallStatus.CONNECTED);
        if (connectedCallback) {
          continue;
        }

        const attemptedOutbound = subsequentCalls.find((c) => c.direction === CallDirection.OUTBOUND);
        const callbackStatus = attemptedOutbound ? 'tried_no_next_step' : 'not_attempted';

        if (callbackStatus === 'not_attempted') {
          notAttemptedCount++;
        } else {
          triedNoNextStepCount++;
        }

        // SLA calculation
        const elapsedMs = now.getTime() - new Date(latestMissed.startedAt).getTime();
        const isBreached = elapsedMs > slaThresholdMs;
        if (isBreached) {
          breachedCount++;
        }

        let slaText = '';
        if (isBreached) {
          const overdueMs = elapsedMs - slaThresholdMs;
          const overdueMins = Math.floor(overdueMs / (60 * 1000));
          const overdueHours = Math.floor(overdueMins / 60);
          const remainingMins = overdueMins % 60;
          slaText = overdueHours > 0
            ? `Breached (${overdueHours}h ${remainingMins}m overdue)`
            : `Breached (${remainingMins}m overdue)`;
        } else {
          const leftMs = slaThresholdMs - elapsedMs;
          const leftMins = Math.floor(leftMs / (60 * 1000));
          const leftHours = Math.floor(leftMins / 60);
          const remainingMins = leftMins % 60;
          slaText = leftHours > 0
            ? `${leftHours}h ${remainingMins}m left`
            : `${remainingMins}m left`;
        }

        // Time ago text
        const elapsedHours = Math.floor(elapsedMs / (60 * 60 * 1000));
        const elapsedDays = Math.floor(elapsedHours / 24);
        let timeAgoText = '';
        if (elapsedDays > 0) {
          timeAgoText = `${elapsedDays}d ago`;
        } else if (elapsedHours > 0) {
          timeAgoText = `${elapsedHours}h ago`;
        } else {
          const elapsedMins = Math.floor(elapsedMs / (60 * 1000));
          timeAgoText = `${Math.max(1, elapsedMins)}m ago`;
        }

        const item = {
          id: latestMissed.id,
          phoneNumber: latestMissed.phoneNumber,
          lead: latestMissed.lead,
          agent: latestMissed.user,
          missedCount: list.length,
          missedAt: latestMissed.startedAt,
          timeAgoText,
          callbackStatus,
          isBreached,
          slaText,
          attemptsCount: subsequentCalls.length,
          lastAttemptAt: subsequentCalls.length > 0 ? subsequentCalls[subsequentCalls.length - 1].startedAt : null,
          notes: latestMissed.notes,
        };

        if (status === 'all' || status === callbackStatus) {
          unresolvedItems.push(item);
        }
      }

      const windowLabel =
        range === 'last_24_hours'
          ? 'last 24 hours'
          : range === 'last_7_days'
          ? 'last 7 days'
          : range === 'last_30_days'
          ? 'last 30 days'
          : 'all time';

      res.status(200).json({
        stats: {
          total: notAttemptedCount + triedNoNextStepCount,
          notAttemptedCount,
          triedNoNextStepCount,
          breachedCount,
          windowLabel,
        },
        items: unresolvedItems,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch missed callbacks.' });
    }
  }

  /**
   * Mark a missed callback as manually resolved (e.g. contacted via WhatsApp or in person)
   */
  static async resolveMissedCallback(req: Request, res: Response): Promise<void> {
    try {
      const orgId = req.user!.orgId;
      const { callId } = req.params;

      const call = await prisma.call.findFirst({
        where: { id: callId, orgId },
      });

      if (!call) {
        res.status(404).json({ error: 'Call record not found.' });
        return;
      }

      if (req.user!.role === Role.AGENT && call.userId !== req.user!.id) {
        res.status(403).json({ error: 'Access denied: You can only resolve your own callbacks.' });
        return;
      }

      const existingTags = call.tags ? call.tags.split(',') : [];
      if (!existingTags.includes('resolved_callback')) {
        existingTags.push('resolved_callback');
      }

      await prisma.call.update({
        where: { id: callId },
        data: { tags: existingTags.join(',') },
      });

      res.status(200).json({ message: 'Callback marked as resolved.', callId });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to resolve callback.' });
    }
  }

  // ==========================================
  // Remote Web-to-Phone Calling Queue
  // ==========================================
  private static pendingDials = new Map<string, { id: string; phoneNumber: string; requestedAt: number }>();

  static async requestDial(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const orgId = req.user!.orgId;
      const { phoneNumber, targetUserId } = req.body;
      if (!phoneNumber) {
        res.status(400).json({ error: 'Phone number is required.' });
        return;
      }
      if (req.user!.role === Role.AGENT && targetUserId && targetUserId !== userId) {
        res.status(403).json({ error: 'Access denied: Agents cannot request dials on behalf of other users.' });
        return;
      }
      const targetUser = targetUserId || userId;
      const dialId = `dial_${Date.now()}`;
      const payload = {
        id: dialId,
        phoneNumber: String(phoneNumber).trim(),
        requestedAt: Date.now(),
        orgId,
        userId: targetUser,
      };
      CallController.pendingDials.set(targetUser, payload);
      if (orgId) {
        CallController.pendingDials.set(`org_${orgId}`, payload);
      }
      console.log(`[RemoteDial] Queued dial request for user ${targetUser} / org ${orgId}: ${payload.phoneNumber}`);
      res.status(200).json({ message: 'Remote dial requested successfully.', dialId, phoneNumber });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to request remote dial.' });
    }
  }

  static async getPendingDial(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const orgId = req.user!.orgId;
      let pending = CallController.pendingDials.get(userId);
      if (!pending && orgId) {
        pending = CallController.pendingDials.get(`org_${orgId}`);
      }
      // Auto-expire after 60 seconds
      if (pending && (Date.now() - pending.requestedAt < 60000)) {
        res.status(200).json({ pendingDial: pending });
      } else {
        if (pending) {
          CallController.pendingDials.delete(userId);
          if (orgId) CallController.pendingDials.delete(`org_${orgId}`);
        }
        res.status(200).json({ pendingDial: null });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to get pending dial.' });
    }
  }

  static async completeDial(req: Request, res: Response): Promise<void> {
    try {
      const userId = req.user!.id;
      const orgId = req.user!.orgId;
      CallController.pendingDials.delete(userId);
      if (orgId) CallController.pendingDials.delete(`org_${orgId}`);
      res.status(200).json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to complete dial.' });
    }
  }
}

