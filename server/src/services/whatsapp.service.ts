import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  WAMessage,
} from '@whiskeysockets/baileys';
import QRCode from 'qrcode';
import path from 'path';
import fs from 'fs';
import pino from 'pino';
import { prisma } from '../utils/prisma.js';

// Base directory for WhatsApp auth sessions per organization
const SESSIONS_DIR = path.resolve(process.env.WA_SESSIONS_DIR || './uploads/wa_sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// In-memory active sockets map by orgId
const activeSockets: Map<string, any> = new Map();

// In-flight initialization promises to avoid race conditions and duplicate concurrent sockets
const initInFlight: Map<string, Promise<any>> = new Map();

// Cache of LID -> real phone numbers
const lidToPhoneCache: Map<string, string> = new Map();

// Reconnection timer handles by orgId
const reconnectTimers: Map<string, NodeJS.Timeout> = new Map();

/**
 * Format phone number cleanly for human display
 * e.g. "916295925064" -> "+91 62959 25064"
 */
export function formatPhoneDisplay(phone: string): string {
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return phone;
  if (digits.startsWith('91') && digits.length === 12) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return `+${digits}`;
}

/**
 * Resolves an LID (e.g. "27672608542960" or "27672608542960@lid") to a real phone number
 * using Baileys' multi-file auth reverse mapping store.
 */
export function resolveLidToPhone(orgId: string, lidOrJid: string): string | null {
  const cleanLid = lidOrJid.replace(/[^0-9]/g, '');
  if (!cleanLid) return null;

  const cacheKey = `${orgId}:${cleanLid}`;
  if (lidToPhoneCache.has(cacheKey)) {
    return lidToPhoneCache.get(cacheKey)!;
  }

  const sessionPath = path.join(SESSIONS_DIR, orgId);
  const reverseFile = path.join(sessionPath, `lid-mapping-${cleanLid}_reverse.json`);
  if (fs.existsSync(reverseFile)) {
    try {
      const data = fs.readFileSync(reverseFile, 'utf8');
      const realPhone = JSON.parse(data);
      if (typeof realPhone === 'string' && realPhone.length > 0) {
        lidToPhoneCache.set(cacheKey, realPhone);
        return realPhone;
      }
    } catch {}
  }

  return null;
}

/**
 * Resolves a real phone number to its corresponding LID if known
 */
export function resolvePhoneToLid(orgId: string, phone: string): string | null {
  const cleanPhone = phone.replace(/[^0-9]/g, '');
  if (!cleanPhone) return null;

  const sessionPath = path.join(SESSIONS_DIR, orgId);
  const forwardFile = path.join(sessionPath, `lid-mapping-${cleanPhone}.json`);
  if (fs.existsSync(forwardFile)) {
    try {
      const data = fs.readFileSync(forwardFile, 'utf8');
      const lid = JSON.parse(data);
      if (typeof lid === 'string' && lid.length > 0) {
        return lid;
      }
    } catch {}
  }

  return null;
}

/**
 * Clean phone number to WhatsApp JID format
 * e.g. "+91 62959 25064" -> "916295925064@s.whatsapp.net"
 */
export function formatToWhatsAppJid(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '');
  if (cleaned.length === 10) {
    // Default to India (91) country code if 10-digit number is provided
    cleaned = `91${cleaned}`;
  }
  return `${cleaned}@s.whatsapp.net`;
}

/**
 * Wait until a socket connection is open and ready to transmit
 */
export async function waitForSocketReady(orgId: string, timeoutMs = 7000): Promise<any> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const sock = activeSockets.get(orgId);
    if (sock && (sock.ws?.isOpen || sock.user)) {
      return sock;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return activeSockets.get(orgId) || null;
}

/**
 * Get or initialize a WhatsApp multi-device socket for an organization
 */
export async function initWhatsAppSession(orgId: string): Promise<any> {
  // If socket is already active and healthy, return it directly
  if (activeSockets.has(orgId)) {
    const existing = activeSockets.get(orgId);
    if (existing?.ws?.isOpen || existing?.user) {
      return existing;
    }
  }

  // Deduplicate concurrent initialization requests for the same org
  if (initInFlight.has(orgId)) {
    return initInFlight.get(orgId);
  }

  const initPromise = (async () => {
    // Clear any pending reconnection timer
    if (reconnectTimers.has(orgId)) {
      clearTimeout(reconnectTimers.get(orgId)!);
      reconnectTimers.delete(orgId);
    }

    // Clean up any stale or lingering socket for this org
    const oldSock = activeSockets.get(orgId);
    if (oldSock) {
      try {
        oldSock.ev?.removeAllListeners?.();
        oldSock.ws?.close?.();
      } catch {}
      activeSockets.delete(orgId);
    }

    const sessionPath = path.join(SESSIONS_DIR, orgId);
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const { version } = await fetchLatestBaileysVersion();

    // Create quiet logger
    const logger = pino({ level: 'silent' });

    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      auth: state,
      browser: ['CRM-LEAD Web', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    activeSockets.set(orgId, sock);

    // Handle credentials updates
    sock.ev.on('creds.update', saveCreds);

    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        try {
          const qrDataUrl = await QRCode.toDataURL(qr);
          await prisma.whatsAppSession.upsert({
            where: { orgId },
            create: {
              orgId,
              status: 'SCAN_QR',
              qrCode: qrDataUrl,
            },
            update: {
              status: 'SCAN_QR',
              qrCode: qrDataUrl,
            },
          });
          console.log(`📱 [WhatsApp Org ${orgId}] New QR Code generated. Waiting for Linked Device scan.`);
        } catch (err) {
          console.error('Failed to convert WhatsApp QR to Data URL:', err);
        }
      }

      if (connection === 'open') {
        const userJid = sock.user?.id || '';
        const rawPhone = userJid.split(':')[0] || userJid.split('@')[0];
        const pushName = sock.user?.name || '';

        await prisma.whatsAppSession.upsert({
          where: { orgId },
          create: {
            orgId,
            phoneNumber: rawPhone,
            pushName,
            status: 'CONNECTED',
            qrCode: null,
            lastConnectedAt: new Date(),
          },
          update: {
            phoneNumber: rawPhone,
            pushName,
            status: 'CONNECTED',
            qrCode: null,
            lastConnectedAt: new Date(),
          },
        });

        console.log(`✅ [WhatsApp Org ${orgId}] Linked Device connected! Phone: ${rawPhone} (${pushName})`);
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        activeSockets.delete(orgId);

        if (statusCode === DisconnectReason.loggedOut) {
          // Device unlinked by user from their phone
          try {
            fs.rmSync(sessionPath, { recursive: true, force: true });
          } catch {}

          await prisma.whatsAppSession.updateMany({
            where: { orgId },
            data: {
              status: 'DISCONNECTED',
              qrCode: null,
              phoneNumber: null,
              pushName: null,
            },
          });
          console.log(`🔌 [WhatsApp Org ${orgId}] Device logged out / unlinked.`);
        } else if (statusCode === DisconnectReason.connectionReplaced) {
          // Another socket connection replaced this one. DO NOT loop-reconnect!
          console.log(`⚠️ [WhatsApp Org ${orgId}] Session connection replaced (440). Standing by.`);
        } else {
          // Temporary network blip or restart required. Reconnect after 4s
          console.log(`🔄 [WhatsApp Org ${orgId}] Connection closed (${statusCode}). Reconnecting in 4s...`);
          if (reconnectTimers.has(orgId)) {
            clearTimeout(reconnectTimers.get(orgId)!);
          }
          const timer = setTimeout(() => {
            reconnectTimers.delete(orgId);
            initWhatsAppSession(orgId).catch(console.error);
          }, 4000);
          reconnectTimers.set(orgId, timer);
        }
      }
    });

    // Handle incoming messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message || msg.key.remoteJid === 'status@broadcast') continue;

        const rawRemoteJid = msg.key.remoteJid || '';
        const fromMe = !!msg.key.fromMe;

        // Resolve LID to real phone number if WhatsApp sent an LID
        let realPhone = rawRemoteJid.replace(/[^0-9]/g, '');
        if (rawRemoteJid.endsWith('@lid') || realPhone.length >= 13) {
          const resolved = resolveLidToPhone(orgId, rawRemoteJid);
          if (resolved) {
            realPhone = resolved;
          }
        }

        // Canonical JID
        const canonicalJid = `${realPhone}@s.whatsapp.net`;

        // Extract message text body
        let body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          '';

        if (!body) {
          if (msg.message.imageMessage) body = '📷 [Image]';
          else if (msg.message.documentMessage) body = '📄 [Document]';
          else if (msg.message.audioMessage) body = '🎵 [Voice Note]';
          else if (msg.message.contactMessage) body = '👤 [Contact Card]';
          else body = '💬 [Media message]';
        }

        // Try finding corresponding lead in CRM
        let matchedLeadId: string | null = null;
        let leadFullName: string | null = null;
        try {
          const lead = await prisma.lead.findFirst({
            where: {
              orgId,
              phone: { contains: realPhone.slice(-10) },
            },
            select: { id: true, fullName: true },
          });
          if (lead) {
            matchedLeadId = lead.id;
            leadFullName = lead.fullName;
          }
        } catch {}

        // Determine friendly sender name
        let finalSenderName = leadFullName;
        if (!finalSenderName) {
          if (msg.pushName && msg.pushName.toLowerCase() !== 'whatsapp') {
            finalSenderName = msg.pushName;
          } else {
            finalSenderName = formatPhoneDisplay(realPhone);
          }
        }

        try {
          await prisma.whatsAppMessage.create({
            data: {
              orgId,
              leadId: matchedLeadId,
              remoteJid: canonicalJid,
              senderPhone: realPhone,
              senderName: finalSenderName,
              fromMe,
              body,
              status: fromMe ? 'SENT' : 'RECEIVED',
              timestamp: new Date((Number(msg.messageTimestamp) || Date.now() / 1000) * 1000),
            },
          });
        } catch (saveErr) {
          console.error('Failed to save incoming WhatsApp message to database:', saveErr);
        }
      }
    });

    return sock;
  })();

  initInFlight.set(orgId, initPromise);
  try {
    const sock = await initPromise;
    return sock;
  } finally {
    initInFlight.delete(orgId);
  }
}

/**
 * Get connection status and QR code for an organization
 */
export async function getWhatsAppStatus(orgId: string) {
  let session = await prisma.whatsAppSession.findUnique({
    where: { orgId },
  });

  const isSocketAlive = activeSockets.has(orgId);

  // If no session exists or status is disconnected, trigger initialization to generate QR
  if (!session || (!isSocketAlive && session.status !== 'CONNECTED')) {
    initWhatsAppSession(orgId).catch(console.error);
    session = await prisma.whatsAppSession.findUnique({ where: { orgId } });
  }

  return {
    isConnected: session?.status === 'CONNECTED',
    status: session?.status || 'DISCONNECTED',
    phoneNumber: session?.phoneNumber || null,
    pushName: session?.pushName || null,
    qrCode: session?.status === 'SCAN_QR' ? session.qrCode : null,
    lastConnectedAt: session?.lastConnectedAt || null,
  };
}

/**
 * Send a WhatsApp text message to a lead or phone number
 */
export async function sendWhatsAppMessage(
  orgId: string,
  toPhone: string,
  messageText: string,
  leadId?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  // Ensure socket is active and wait for connection ready
  let sock = activeSockets.get(orgId);
  if (!sock || !sock.ws?.isOpen) {
    sock = await initWhatsAppSession(orgId);
  }
  sock = await waitForSocketReady(orgId, 6000);

  const session = await prisma.whatsAppSession.findUnique({ where: { orgId } });
  if (session?.status !== 'CONNECTED') {
    throw new Error('WhatsApp is not connected. Please scan the QR code to link your phone.');
  }

  // Resolve LID if passed as toPhone
  let cleanPhone = toPhone.replace(/[^0-9]/g, '');
  if (toPhone.endsWith('@lid') || cleanPhone.length >= 13) {
    const resolved = resolveLidToPhone(orgId, toPhone);
    if (resolved) {
      cleanPhone = resolved;
    }
  }

  const jid = formatToWhatsAppJid(cleanPhone);

  try {
    await sock.sendMessage(jid, { text: messageText });

    // Look up lead if not passed
    let matchedLeadId = leadId || null;
    let leadFullName: string | null = null;
    if (!matchedLeadId) {
      try {
        const lead = await prisma.lead.findFirst({
          where: {
            orgId,
            phone: { contains: cleanPhone.slice(-10) },
          },
          select: { id: true, fullName: true },
        });
        if (lead) {
          matchedLeadId = lead.id;
          leadFullName = lead.fullName;
        }
      } catch {}
    }

    // Save to CRM WhatsApp chat history
    const record = await prisma.whatsAppMessage.create({
      data: {
        orgId,
        leadId: matchedLeadId,
        remoteJid: jid,
        senderPhone: cleanPhone,
        senderName: leadFullName || formatPhoneDisplay(cleanPhone),
        fromMe: true,
        body: messageText,
        status: 'SENT',
        timestamp: new Date(),
      },
    });

    return { success: true, messageId: record.id };
  } catch (err: any) {
    console.error(`Failed to send WhatsApp message to ${toPhone}:`, err);
    throw new Error(err.message || 'Failed to send WhatsApp message.');
  }
}

/**
 * Disconnect and unlink WhatsApp device for an organization
 */
export async function disconnectWhatsApp(orgId: string): Promise<boolean> {
  const sock = activeSockets.get(orgId);
  if (sock) {
    try {
      sock.ev?.removeAllListeners?.();
      await sock.logout();
    } catch {}
    activeSockets.delete(orgId);
  }

  if (reconnectTimers.has(orgId)) {
    clearTimeout(reconnectTimers.get(orgId)!);
    reconnectTimers.delete(orgId);
  }

  const sessionPath = path.join(SESSIONS_DIR, orgId);
  try {
    if (fs.existsSync(sessionPath)) {
      fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  } catch {}

  await prisma.whatsAppSession.updateMany({
    where: { orgId },
    data: {
      status: 'DISCONNECTED',
      qrCode: null,
      phoneNumber: null,
      pushName: null,
    },
  });

  return true;
}

/**
 * List WhatsApp chat conversations for an organization
 */
export async function listWhatsAppConversations(orgId: string) {
  const session = await prisma.whatsAppSession.findUnique({
    where: { orgId },
    select: { phoneNumber: true },
  });
  const ownPhone = session?.phoneNumber || '';

  // Retrieve recent messages
  const recentMessages = await prisma.whatsAppMessage.findMany({
    where: { orgId },
    orderBy: { timestamp: 'desc' },
    take: 200,
  });

  // Group by canonical phone number
  const conversationMap = new Map<string, any>();

  for (const msg of recentMessages) {
    // Resolve any LID in remoteJid or senderPhone to canonical phone
    let canonicalPhone = msg.senderPhone.replace(/[^0-9]/g, '');
    if (msg.remoteJid.endsWith('@lid') || canonicalPhone.length >= 13) {
      const resolved = resolveLidToPhone(orgId, msg.remoteJid) || resolveLidToPhone(orgId, msg.senderPhone);
      if (resolved) {
        canonicalPhone = resolved;
      }
    }

    if (!conversationMap.has(canonicalPhone)) {
      conversationMap.set(canonicalPhone, {
        canonicalPhone,
        remoteJid: `${canonicalPhone}@s.whatsapp.net`,
        phoneNumber: canonicalPhone,
        formattedPhone: formatPhoneDisplay(canonicalPhone),
        leadId: msg.leadId,
        rawSenderName: msg.senderName,
        lastMessage: msg.body,
        lastMessageTime: msg.timestamp,
        fromMe: msg.fromMe,
      });
    }
  }

  const conversations = Array.from(conversationMap.values());
  if (conversations.length === 0) return [];

  // Batch resolve matching leads from CRM
  const phoneSuffixes = conversations.map((c) => c.canonicalPhone.slice(-10));
  const matchingLeads = await prisma.lead.findMany({
    where: {
      orgId,
      OR: phoneSuffixes.map((s) => ({ phone: { contains: s } })),
    },
    select: {
      id: true,
      fullName: true,
      phone: true,
      stage: true,
      stageName: true,
    },
  });

  const leadBySuffix = new Map<string, any>();
  for (const lead of matchingLeads) {
    const s = lead.phone.replace(/[^0-9]/g, '').slice(-10);
    if (s) leadBySuffix.set(s, lead);
  }

  // Populate lead details into conversations
  return conversations.map((conv) => {
    const lead = leadBySuffix.get(conv.canonicalPhone.slice(-10));
    let leadName = lead?.fullName;

    if (!leadName) {
      if (ownPhone && conv.canonicalPhone === ownPhone) {
        leadName = 'You (Self / Notes)';
      } else if (conv.rawSenderName && conv.rawSenderName.toLowerCase() !== 'whatsapp') {
        leadName = conv.rawSenderName;
      } else {
        leadName = conv.formattedPhone;
      }
    }

    return {
      remoteJid: conv.remoteJid,
      phoneNumber: conv.phoneNumber,
      formattedPhone: conv.formattedPhone,
      leadName,
      leadId: lead?.id || conv.leadId || null,
      leadStage: lead?.stageName || lead?.stage || null,
      lastMessage: conv.lastMessage,
      lastMessageTime: conv.lastMessageTime,
      fromMe: conv.fromMe,
      unreadCount: 0,
    };
  });
}

/**
 * Get message history for a specific conversation / lead
 */
export async function getConversationMessages(orgId: string, remoteJidOrPhone: string) {
  let cleanPhone = remoteJidOrPhone.replace(/[^0-9]/g, '');

  // Check if an LID was passed
  if (remoteJidOrPhone.endsWith('@lid') || cleanPhone.length >= 13) {
    const resolved = resolveLidToPhone(orgId, remoteJidOrPhone);
    if (resolved) {
      cleanPhone = resolved;
    }
  }

  // Find any associated LID for this phone number
  const associatedLid = resolvePhoneToLid(orgId, cleanPhone);

  const targetPhones = [cleanPhone];
  const targetJids = [`${cleanPhone}@s.whatsapp.net`];

  if (associatedLid) {
    targetPhones.push(associatedLid);
    targetJids.push(`${associatedLid}@lid`);
  }

  const messages = await prisma.whatsAppMessage.findMany({
    where: {
      orgId,
      OR: [
        { senderPhone: { in: targetPhones } },
        { remoteJid: { in: targetJids } },
      ],
    },
    orderBy: { timestamp: 'asc' },
    take: 300,
  });

  return messages;
}

/**
 * Restore all active WhatsApp sessions across organizations on server boot
 */
export async function restoreActiveWhatsAppSessions(): Promise<void> {
  try {
    const activeSessions = await prisma.whatsAppSession.findMany({
      where: { status: 'CONNECTED' },
    });

    console.log(`📱 [WhatsApp Auto-Restore] Found ${activeSessions.length} active session(s) to connect.`);
    for (const session of activeSessions) {
      initWhatsAppSession(session.orgId).catch((err) => {
        console.error(`Failed to restore WhatsApp session for org ${session.orgId}:`, err);
      });
    }
  } catch (err) {
    console.error('Error during WhatsApp auto-restore:', err);
  }
}
