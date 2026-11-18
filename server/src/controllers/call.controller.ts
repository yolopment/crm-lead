import { Request, Response } from 'express';
import { prisma } from '../utils/prisma.js';
import { streamAudioFile } from '../services/storage.service.js';
import { CallDirection, CallStatus, LeadStage } from '@prisma/client';
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
              fullName: `Lead (${cleanPhone.slice(-4)})`,
              source: direction === 'INBOUND' ? 'inbound_call' : 'outbound_call',
              assignedToId: userId,
              stage: durationSec > 0 ? LeadStage.CONTACTED : LeadStage.NEW,
            },
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

      // Store relative path to recording file
      const relativePath = path.join(orgId, req.file.filename);

      const updatedCall = await prisma.call.update({
        where: { id: call.id },
        data: {
          audioPath: relativePath,
          audioSize: req.file.size,
        },
      });

      res.status(200).json({
        message: 'Audio recording successfully uploaded and attached to call.',
        callId: updatedCall.id,
        audioSize: updatedCall.audioSize,
        audioPath: updatedCall.audioPath,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to upload audio recording.' });
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

      streamAudioFile(call.audioPath, req, res);
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

      if (agentId && agentId !== 'all') {
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
        hasAudio: !!c.audioPath,
        audioUrl: c.audioPath ? `/api/v1/calls/${c.id}/audio` : null,
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
      if (agentId && agentId !== 'all') {
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
      if (agentId && agentId !== 'all') {
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
}

