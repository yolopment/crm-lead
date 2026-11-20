'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  MessageSquare,
  QrCode,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Send,
  Loader2,
  Unlink,
  Search,
  User,
  Clock,
  Sparkles,
  Phone,
  Check,
  CheckCheck,
  ExternalLink,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

interface WhatsAppStatus {
  isConnected: boolean;
  status: 'DISCONNECTED' | 'SCAN_QR' | 'CONNECTING' | 'CONNECTED';
  phoneNumber: string | null;
  pushName: string | null;
  qrCode: string | null;
  lastConnectedAt: string | null;
}

interface Conversation {
  remoteJid: string;
  phoneNumber: string;
  formattedPhone?: string;
  leadName: string;
  leadId: string | null;
  leadStage: string | null;
  lastMessage: string;
  lastMessageTime: string;
  fromMe: boolean;
}

interface ChatMessage {
  id: string;
  remoteJid: string;
  senderPhone: string;
  senderName: string | null;
  fromMe: boolean;
  body: string;
  mediaUrl: string | null;
  mediaType: string | null;
  status: string;
  timestamp: string;
}

const TEMPLATES = [
  'Hi {{name}}, thank you for reaching out to us! How can we assist you today?',
  'Hello {{name}}, following up on our recent phone call. Please let me know if you have any questions!',
  'Hi {{name}}, sharing the pricing proposal and details as discussed. Looking forward to your feedback.',
  'Hello {{name}}, would you be available for a brief 10-minute demo call tomorrow?',
];

export default function WhatsAppPage() {
  const [status, setStatus] = useState<WhatsAppStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingQr, setRefreshingQr] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  // Chat states
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedChat, setSelectedChat] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Poll status when scanning QR code
  const loadStatus = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await fetchWithAuth('/whatsapp/status');
      setStatus(data);
    } catch (err: any) {
      console.error('Failed to load WhatsApp status:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const loadConversations = async () => {
    try {
      const res = await fetchWithAuth('/whatsapp/conversations');
      setConversations(res.conversations || []);
    } catch (err) {
      console.error('Failed to load conversations:', err);
    }
  };

  const loadMessages = async (phone: string) => {
    try {
      setLoadingMessages(true);
      const res = await fetchWithAuth(`/whatsapp/conversations/${phone}/messages`);
      setMessages(res.messages || []);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err) {
      console.error('Failed to load messages:', err);
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadStatus();
  }, []);

  // Set up polling while in SCAN_QR or CONNECTING mode
  useEffect(() => {
    if (!status?.isConnected) {
      const interval = setInterval(() => {
        loadStatus(true);
      }, 3000);
      return () => clearInterval(interval);
    } else {
      loadConversations();
      const interval = setInterval(() => {
        loadConversations();
        if (selectedChat) {
          loadMessages(selectedChat.phoneNumber);
        }
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [status?.isConnected, selectedChat]);

  const handleRefreshQr = async () => {
    try {
      setRefreshingQr(true);
      const data = await fetchWithAuth('/whatsapp/refresh-qr', { method: 'POST' });
      setStatus(data);
      setToast({ message: 'QR code refreshed. Point your phone camera to scan.', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to refresh QR code', type: 'error' });
    } finally {
      setRefreshingQr(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to unlink your WhatsApp device?')) return;
    try {
      setDisconnecting(true);
      await fetchWithAuth('/whatsapp/disconnect', { method: 'POST' });
      setToast({ message: 'WhatsApp unlinked successfully.', type: 'success' });
      setSelectedChat(null);
      setMessages([]);
      loadStatus();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to unlink device', type: 'error' });
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !inputText.trim() || sending) return;
    const textToSend = inputText.trim();
    setInputText('');

    try {
      setSending(true);
      await fetchWithAuth('/whatsapp/send', {
        method: 'POST',
        body: JSON.stringify({
          toPhone: selectedChat.phoneNumber,
          message: textToSend,
          leadId: selectedChat.leadId || undefined,
        }),
      });

      // Optimistically append message
      const tempMsg: ChatMessage = {
        id: `temp_${Date.now()}`,
        remoteJid: selectedChat.remoteJid,
        senderPhone: selectedChat.phoneNumber,
        senderName: 'Me',
        fromMe: true,
        body: textToSend,
        mediaUrl: null,
        mediaType: 'text',
        status: 'SENT',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, tempMsg]);
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 50);

      loadConversations();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send message', type: 'error' });
    } finally {
      setSending(false);
    }
  };

  const filteredConversations = (conversations || []).filter((c) => {
    if (!c) return false;
    const q = (searchQuery || '').toLowerCase().trim();
    if (!q) return true;
    const name = (c.leadName || '').toLowerCase();
    const phone = (c.phoneNumber || '').toString();
    const formatted = (c.formattedPhone || '').toString();
    const msg = (c.lastMessage || '').toLowerCase();
    return name.includes(q) || phone.includes(q) || formatted.includes(q) || msg.includes(q);
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto h-[calc(100vh-140px)] flex flex-col">
      {/* Toast Alert */}
      {toast && (
        <div
          className={`flex items-center justify-between p-3.5 rounded-xl border text-xs ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-4 font-bold text-slate-400 hover:text-slate-600">
            ×
          </button>
        </div>
      )}

      {/* Main Container */}
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-2xl border border-slate-200 shadow-xs">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-3" />
          <span className="text-xs text-slate-500 font-medium">Initializing WhatsApp connection...</span>
        </div>
      ) : !status?.isConnected ? (
        /* DISCONNECTED / SCAN QR STATE matching WhatsApp Web UI */
        <div className="flex-1 flex items-center justify-center p-4 bg-slate-50 rounded-2xl border border-slate-200">
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xl max-w-2xl w-full p-8 md:p-10 space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between pb-6 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Connect WhatsApp Web</h1>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scan the QR code with your phone to link your WhatsApp to the CRM.
                  </p>
                </div>
              </div>

              <button
                onClick={handleRefreshQr}
                disabled={refreshingQr}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${refreshingQr ? 'animate-spin text-emerald-600' : ''}`} />
                <span>Refresh QR</span>
              </button>
            </div>

            {/* Content: Instructions + QR Code */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              {/* Instructions */}
              <div className="space-y-4 text-xs text-slate-600">
                <h3 className="text-sm font-bold text-slate-900">How to link your phone:</h3>
                <ol className="space-y-3 pl-2">
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      1
                    </span>
                    <span>Open <strong>WhatsApp</strong> on your mobile phone.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      2
                    </span>
                    <span>
                      Tap <strong>Menu (⋮)</strong> on Android or <strong>Settings (⚙️)</strong> on iPhone.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      3
                    </span>
                    <span>
                      Tap <strong>Linked Devices</strong> and then tap <strong>Link a Device</strong>.
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">
                      4
                    </span>
                    <span>Point your phone at this screen to scan the QR code.</span>
                  </li>
                </ol>

                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200/60 text-[11px] text-emerald-800 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Works with any regular WhatsApp or WhatsApp Business number! 100% Free.</span>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-slate-200 rounded-2xl relative">
                {status?.qrCode ? (
                  <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-200">
                    <img
                      src={status.qrCode}
                      alt="WhatsApp QR Code"
                      className="w-56 h-56 rounded-xl object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-56 h-56 rounded-2xl bg-white border border-slate-200 flex flex-col items-center justify-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                    <span className="text-[11px] text-slate-500 font-medium">Generating QR Code...</span>
                  </div>
                )}
                <span className="text-[11px] text-slate-400 mt-3 font-medium flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Waiting for phone scan...
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* CONNECTED STATE: FULL IN-CRM WHATSAPP INBOX */
        <div className="flex-1 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {/* Top Bar */}
          <div className="py-3 px-6 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white font-bold text-xs">
                WA
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xs font-bold text-slate-900">
                    +{status.phoneNumber} {status.pushName ? `(${status.pushName})` : ''}
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Online
                  </span>
                </div>
                <p className="text-[10px] text-slate-500">
                  Connected via Linked Device • Synced with your mobile phone
                </p>
              </div>
            </div>

            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:border-rose-300 bg-white hover:bg-rose-50 text-xs font-semibold text-rose-600 transition"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
              <span>Unlink Phone</span>
            </button>
          </div>

          {/* Inbox Split Pane */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Column: Conversations List */}
            <div className="w-80 border-r border-slate-200 flex flex-col bg-slate-50/50">
              {/* Search */}
              <div className="p-3 border-b border-slate-200 bg-white">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search chats or phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* Chat List */}
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
                {filteredConversations.length === 0 ? (
                  <div className="py-12 text-center text-xs text-slate-400 p-4">
                    <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                    <p className="font-medium text-slate-600">No active chats yet</p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Incoming WhatsApp messages or outgoing chats to leads will appear here.
                    </p>
                  </div>
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = selectedChat?.remoteJid === conv.remoteJid;
                    return (
                      <div
                        key={conv.remoteJid}
                        onClick={() => {
                          setSelectedChat(conv);
                          loadMessages(conv.phoneNumber);
                        }}
                        className={`p-3.5 flex items-start gap-3 cursor-pointer transition ${
                          isSelected ? 'bg-emerald-50/60 border-l-4 border-l-emerald-600' : 'hover:bg-slate-100/60'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center shrink-0 text-xs">
                          {conv.leadName ? conv.leadName[0].toUpperCase() : '👤'}
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {conv.leadName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {conv.lastMessageTime
                                ? new Date(conv.lastMessageTime).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-400 font-mono">
                            {conv.formattedPhone || (conv.phoneNumber ? `+${conv.phoneNumber}` : '')}
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span className="truncate pr-2">
                              {conv.fromMe && <span className="text-emerald-600 mr-1">You:</span>}
                              {conv.lastMessage}
                            </span>
                            {conv.leadStage && (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-semibold bg-slate-200 text-slate-700 shrink-0">
                                {conv.leadStage}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Right Column: Chat View */}
            {selectedChat ? (
              <div className="flex-1 flex flex-col bg-white">
                {/* Chat Header */}
                <div className="py-3 px-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/60">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center text-xs">
                      {selectedChat.leadName ? selectedChat.leadName[0].toUpperCase() : '👤'}
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                        <span>{selectedChat.leadName}</span>
                        {selectedChat.leadStage && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                            {selectedChat.leadStage}
                          </span>
                        )}
                      </h3>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {selectedChat.formattedPhone || (selectedChat.phoneNumber ? `+${selectedChat.phoneNumber}` : '')}
                      </span>
                    </div>
                  </div>

                  {selectedChat.leadId && (
                    <a
                      href={`/dashboard/leads?highlight=${selectedChat.leadId}`}
                      className="text-xs text-blue-600 hover:text-blue-700 font-semibold inline-flex items-center gap-1"
                    >
                      <span>View Lead Profile</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {/* Messages Body */}
                <div className="flex-1 p-5 overflow-y-auto space-y-3 bg-[#e5ddd5]/20">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400">
                      No previous chat history. Send a message to start the conversation!
                    </div>
                  ) : (
                    messages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.fromMe ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-md rounded-2xl p-3 shadow-xs text-xs space-y-1 relative ${
                            msg.fromMe
                              ? 'bg-emerald-600 text-white rounded-br-none'
                              : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                          }`}
                        >
                          <p className="whitespace-pre-wrap leading-relaxed">{msg.body}</p>
                          <div
                            className={`flex items-center justify-end gap-1 text-[10px] font-mono ${
                              msg.fromMe ? 'text-emerald-100' : 'text-slate-400'
                            }`}
                          >
                            <span>
                              {msg.timestamp
                                ? new Date(msg.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })
                                : ''}
                            </span>
                            {msg.fromMe && <CheckCheck className="w-3 h-3 text-emerald-200" />}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Templates & Canned Replies Bar */}
                <div className="px-4 py-2 border-t border-slate-200 bg-slate-50 flex items-center gap-2 overflow-x-auto text-[11px]">
                  <span className="text-slate-400 font-semibold uppercase text-[10px] shrink-0">
                    Quick Templates:
                  </span>
                  {TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      onClick={() =>
                        setInputText(tmpl.replace('{{name}}', selectedChat.leadName || 'there'))
                      }
                      className="px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 border border-slate-200 shrink-0 transition"
                    >
                      Template #{idx + 1}
                    </button>
                  ))}
                </div>

                {/* Message Input Box */}
                <div className="p-3 border-t border-slate-200 bg-white flex items-center gap-3">
                  <textarea
                    rows={1}
                    placeholder="Type a WhatsApp message (Press Enter to send)..."
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />

                  <button
                    onClick={handleSendMessage}
                    disabled={!inputText.trim() || sending}
                    className="p-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white transition flex items-center justify-center shrink-0 shadow-xs"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              /* No Chat Selected State */
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4 text-emerald-600">
                  <MessageSquare className="w-8 h-8" />
                </div>
                <h3 className="text-base font-bold text-slate-800">WhatsApp Web Active</h3>
                <p className="text-xs text-slate-500 max-w-sm text-center mt-1">
                  Select a chat from the left panel, or click "WhatsApp" on any lead in the All Leads table to start chatting.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
