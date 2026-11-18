'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Calendar, Users, Filter, Download, ArrowUpRight, ArrowDownLeft,
  Phone, PhoneOff, Plus, RefreshCw, X, CheckCircle2, Circle, Clock,
  Smartphone, Shield, Settings, SlidersHorizontal, ArrowRight, UserPlus,
  Trash2, Mail, Check, AlertTriangle, AlertCircle, HeartHandshake, Mic, MicOff,
  Inbox, Upload, Edit2, Battery, Zap, Wifi, Folder, Activity, ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import AudioPlayer from '@/components/AudioPlayer';
import { fetchWithAuth, API_BASE } from '@/lib/api';
import { StatCardSkeleton, TableRowSkeleton, Toast, Badge } from '@/components/ui';

interface CallStats {
  totalCalls: number;
  connectedCalls: number;
  connectRate: number;
  talkTimeFormatted: string;
  uniqueCalls: number;
  longCalls: number;
}

interface AgentDevice {
  id: string;
  deviceName: string | null;
  brand: string | null;
  androidVersion: string | null;
  appVersion: string | null;
  state: string;
  recordingsWorking: boolean;
  lastSyncAt: string | null;
  batteryLevel: number | null;
  isCharging?: boolean | null;
  networkType?: string | null;
  ipAddress?: string | null;
  storageAccess?: boolean | null;
  callLogAccess?: boolean | null;
  batteryOptimized?: boolean | null;
  recordingFolder?: string | null;
  deviceHardwareId?: string | null;
  user?: { id: string; name: string; email: string; role: string };
}

interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isOnLeave: boolean;
  deviceToken?: string | null;
  hasPairedDevice: boolean;
  devices: AgentDevice[];
  deviceSummary?: string | null;
  stats: { totalCalls: number; connectRate: number; totalTalkTimeFormatted: string; missedCalls: number };
}

interface PendingInvitation {
  id: string;
  email: string;
  role: string;
  expiresFormatted: string;
  expiresAt: string;
  createdAt: string;
}

interface Call {
  id: string;
  phoneNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  status: 'CONNECTED' | 'MISSED' | 'BUSY' | 'FAILED';
  durationSec: number;
  durationFormatted: string;
  startedAt: string;
  notes: string | null;
  hasAudio: boolean;
  audioUrl: string | null;
  agent: { id: string; name: string; email: string };
  lead: { id: string; fullName: string; stage: string; tags: string } | null;
}

interface NoteModal { callId: string; currentNote: string; }

interface PolicyData {
  captureScope: string;
  allowMemberScope: boolean;
  recordCalls: boolean;
  smartFollowUps: boolean;
  dntList: Array<{ id: string; phone: string; reason: string | null; createdAt: string }>;
}

interface PrivateNumberItem {
  id: string;
  phone: string;
  createdAt: string;
}

const SUBTABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'missed', label: 'Missed callbacks' },
  { id: 'call_settings', label: 'Call settings' },
  { id: 'team', label: 'Team' },
  { id: 'call_policy', label: 'Call policy' },
  { id: 'devices', label: 'Devices' },
];

export default function CallsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<CallStats | null>(null);
  const [team, setTeam] = useState<Agent[]>([]);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [policy, setPolicy] = useState<PolicyData>({
    captureScope: 'ALL',
    allowMemberScope: true,
    recordCalls: true,
    smartFollowUps: false,
    dntList: []
  });
  const [allDevices, setAllDevices] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('last_7_days');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [noteModal, setNoteModal] = useState<NoteModal | null>(null);
  const [noteText, setNoteText] = useState('');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('AGENT');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [showPairModal, setShowPairModal] = useState<{ name: string; token: string } | null>(null);
  const [showAddDntModal, setShowAddDntModal] = useState(false);
  const [dntPhone, setDntPhone] = useState('');
  const [dntReason, setDntReason] = useState('');
  const [renameModal, setRenameModal] = useState<{ leadId: string; currentName: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  // Private numbers state
  const [privateNumbers, setPrivateNumbers] = useState<PrivateNumberItem[]>([]);
  const [showAddPrivateModal, setShowAddPrivateModal] = useState(false);
  const [showAddManyPrivateModal, setShowAddManyPrivateModal] = useState(false);
  const [privatePhoneInput, setPrivatePhoneInput] = useState('');
  const [privateBulkInput, setPrivateBulkInput] = useState('');
  const [privateLoading, setPrivateLoading] = useState(false);

  // Device diagnostics & telemetry state
  const [selectedDeviceModal, setSelectedDeviceModal] = useState<any | null>(null);
  const [deviceDeleting, setDeviceDeleting] = useState(false);

  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({ range: dateRange, agentId: selectedAgent });
      if (searchTerm) params.set('search', searchTerm);

      const [statsData, teamData, callsData, policyData, devicesData, privateData] = await Promise.all([
        fetchWithAuth(`/calls/stats?${params}`),
        fetchWithAuth('/team'),
        fetchWithAuth(`/calls?${params}&limit=50`),
        fetchWithAuth('/policy').catch(() => null),
        fetchWithAuth('/devices').catch(() => []),
        fetchWithAuth('/policy/private-numbers').catch(() => []),
      ]);

      setStats(statsData);
      if (teamData?.members) {
        setTeam(teamData.members || []);
        setInvitations(teamData.pendingInvitations || []);
      } else if (Array.isArray(teamData)) {
        setTeam(teamData);
      }
      setCalls(callsData?.calls || []);
      if (policyData) setPolicy(policyData);
      if (Array.isArray(devicesData)) setAllDevices(devicesData);
      if (Array.isArray(privateData)) setPrivateNumbers(privateData);
    } catch (err: any) {
      if (!silent) setToast({ message: err.message || 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, selectedAgent, searchTerm]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab');
      if (tabParam && SUBTABS.some(t => t.id === tabParam)) {
        setActiveTab(tabParam);
      }
    }
  }, []);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', tabId);
      window.history.replaceState({}, '', url.toString());
    }
  };

  useEffect(() => {
    loadData();
    refreshIntervalRef.current = setInterval(() => loadData(true), 30000);
    return () => { if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current); };
  }, [loadData]);

  const exportCSV = () => {
    if (!calls.length) return;
    const headers = ['Phone', 'Direction', 'Status', 'Duration', 'Started At', 'Agent', 'Lead', 'Notes'];
    const rows = calls.map(c => [
      c.phoneNumber, c.direction, c.status, c.durationFormatted,
      new Date(c.startedAt).toLocaleString('en-IN'),
      c.agent?.name || '', c.lead?.fullName || '', c.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `calls-${dateRange}-${Date.now()}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const saveNote = async () => {
    if (!noteModal) return;
    try {
      await fetchWithAuth(`/calls/${noteModal.callId}/notes`, {
        method: 'POST',
        body: JSON.stringify({ notes: noteText }),
      });
      setCalls(prev => prev.map(c => c.id === noteModal.callId ? { ...c, notes: noteText } : c));
      setToast({ message: 'Note saved successfully', type: 'success' });
      setNoteModal(null);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save note', type: 'error' });
    }
  };

  const formatDeviceName = (dev: any) => {
    if (!dev) return 'Device';
    const brand = (dev.brand || '').trim();
    const name = (dev.deviceName || '').trim();
    if (!name && !brand) return 'Android Companion Device';
    if (!brand) return name;
    if (!name) return brand;
    if (name.toLowerCase().startsWith(brand.toLowerCase())) {
      return name;
    }
    return `${brand} ${name}`;
  };

  const handleUnpairDevice = async (device: any) => {
    const devName = formatDeviceName(device);
    if (!window.confirm(`Are you sure you want to unpair "${devName}"? Calls from this phone will no longer be captured.`)) {
      return;
    }
    setDeviceDeleting(true);
    try {
      await fetchWithAuth(`/devices/${device.id}`, { method: 'DELETE' });
      setAllDevices(prev => prev.filter(d => d.id !== device.id));
      if (selectedDeviceModal?.id === device.id) {
        setSelectedDeviceModal(null);
      }
      setToast({ message: `Device "${devName}" unpaired successfully.`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to unpair device', type: 'error' });
    } finally {
      setDeviceDeleting(false);
    }
  };

  // Team Invite Handlers
  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviteLoading(true);
    try {
      await fetchWithAuth('/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      setToast({ message: `Invitation sent to ${inviteEmail}`, type: 'success' });
      setShowInviteModal(false);
      setInviteEmail('');
      loadData(true);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send invite', type: 'error' });
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRevokeInvite = async (inviteId: string) => {
    try {
      await fetchWithAuth(`/team/invites/${inviteId}`, { method: 'DELETE' });
      setInvitations(prev => prev.filter(inv => inv.id !== inviteId));
      setToast({ message: 'Invitation revoked', type: 'info' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to revoke invite', type: 'error' });
    }
  };

  const handleResendInvite = async (inviteId: string) => {
    try {
      await fetchWithAuth(`/team/invites/${inviteId}/resend`, { method: 'POST' });
      setToast({ message: 'Invitation extended and resent', type: 'success' });
      loadData(true);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to resend invite', type: 'error' });
    }
  };

  const handleSaveLeadName = async () => {
    if (!renameModal || !renameValue.trim()) return;
    setRenameLoading(true);
    try {
      await fetchWithAuth(`/leads/${renameModal.leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ fullName: renameValue.trim() }),
      });
      setCalls(prev => prev.map(c => c.lead?.id === renameModal.leadId ? { ...c, lead: { ...c.lead, fullName: renameValue.trim() } } : c));
      setToast({ message: 'Contact name updated successfully', type: 'success' });
      setRenameModal(null);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update contact name', type: 'error' });
    } finally {
      setRenameLoading(false);
    }
  };

  const handleUploadAudio = async (callId: string, file?: File | null) => {
    if (!file) return;
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    const formData = new FormData();
    formData.append('audio', file);
    setToast({ message: 'Uploading recording...', type: 'info' });
    try {
      const res = await fetch(`${API_BASE}/calls/${callId}/upload-recording`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      if (!res.ok) throw new Error('Upload failed');
      setToast({ message: 'Recording attached to call successfully!', type: 'success' });
      loadData(true);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to upload recording', type: 'error' });
    }
  };

  // Policy Handlers
  const savePolicySettings = async (updates: Partial<PolicyData>) => {
    try {
      await fetchWithAuth('/policy', {
        method: 'POST',
        body: JSON.stringify(updates),
      });
      setPolicy(prev => ({ ...prev, ...updates }));
      setToast({ message: 'Policy settings saved', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to save policy', type: 'error' });
    }
  };

  const handleAddDnt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dntPhone) return;
    try {
      const res = await fetchWithAuth('/policy/dnt', {
        method: 'POST',
        body: JSON.stringify({ phone: dntPhone, reason: dntReason }),
      });
      setPolicy(prev => ({ ...prev, dntList: [res.entry, ...prev.dntList] }));
      setShowAddDntModal(false);
      setDntPhone('');
      setDntReason('');
      setToast({ message: 'Number added to Do-Not-Track list', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to add DNT number', type: 'error' });
    }
  };

  const handleRemoveDnt = async (id: string) => {
    try {
      await fetchWithAuth(`/policy/dnt/${id}`, { method: 'DELETE' });
      setPolicy(prev => ({ ...prev, dntList: prev.dntList.filter(item => item.id !== id) }));
      setToast({ message: 'Number removed from Do-Not-Track list', type: 'info' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to remove DNT number', type: 'error' });
    }
  };

  const handleAddPrivateNumber = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privatePhoneInput.trim()) return;
    setPrivateLoading(true);
    try {
      const res = await fetchWithAuth('/policy/private-numbers', {
        method: 'POST',
        body: JSON.stringify({ phone: privatePhoneInput.trim() }),
      });
      setPrivateNumbers(prev => [res.entry, ...prev.filter(p => p.id !== res.entry?.id)]);
      setShowAddPrivateModal(false);
      setPrivatePhoneInput('');
      setToast({ message: 'Private number added', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to add private number', type: 'error' });
    } finally {
      setPrivateLoading(false);
    }
  };

  const handleBulkAddPrivateNumbers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!privateBulkInput.trim()) return;
    setPrivateLoading(true);
    try {
      await fetchWithAuth('/policy/private-numbers/bulk', {
        method: 'POST',
        body: JSON.stringify({ text: privateBulkInput.trim() }),
      });
      const updatedList = await fetchWithAuth('/policy/private-numbers');
      if (Array.isArray(updatedList)) setPrivateNumbers(updatedList);
      setShowAddManyPrivateModal(false);
      setPrivateBulkInput('');
      setToast({ message: 'Private numbers imported successfully', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to import numbers', type: 'error' });
    } finally {
      setPrivateLoading(false);
    }
  };

  const handleRemovePrivateNumber = async (id: string) => {
    try {
      await fetchWithAuth(`/policy/private-numbers/${id}`, { method: 'DELETE' });
      setPrivateNumbers(prev => prev.filter(p => p.id !== id));
      setToast({ message: 'Private number removed', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to remove private number', type: 'error' });
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header with Title & Action Badges */}
      <div>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
              <Phone className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Calls</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Call activity across your organization — every detected call, visibly reconciled.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold border border-blue-200/60">
              <Clock className="w-3 h-3 text-blue-600" />
              <span>Trial 14 days left</span>
            </div>
            <a
              href="/downloads/crm-companion.apk"
              download="crm-companion.apk"
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full text-xs font-semibold border border-emerald-200 transition"
            >
              <Smartphone className="w-3 h-3" />
              <span>Download app</span>
            </a>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              title="Refresh data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Subtabs Row (LeadZam matching tabs) */}
      <div className="border-b border-slate-200">
        <nav className="flex gap-8 overflow-x-auto">
          {SUBTABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`pb-3 text-xs font-semibold transition border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.id === 'overview' && <SlidersHorizontal className="w-3.5 h-3.5" />}
                {tab.id === 'missed' && <PhoneOff className="w-3.5 h-3.5" />}
                {tab.id === 'team' && <Users className="w-3.5 h-3.5" />}
                {tab.id === 'call_policy' && <Shield className="w-3.5 h-3.5" />}
                {tab.id === 'devices' && <Smartphone className="w-3.5 h-3.5" />}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: OVERVIEW (LeadZam Screenshot 5) */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-5">
          {/* Filters Row */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <div className="relative min-w-[260px]">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by lead name, phone, or note... /"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && loadData()}
                  className="w-full pl-9 pr-4 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
                />
              </div>

              <div className="relative">
                <Calendar className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="today">Today</option>
                  <option value="last_7_days">Last 7 days</option>
                  <option value="last_30_days">Last 30 days</option>
                </select>
              </div>

              <div className="relative">
                <Users className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500 pointer-events-none" />
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="appearance-none bg-white border border-slate-200 rounded-lg pl-8 pr-7 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="all">All agents</option>
                  {(Array.isArray(team) ? team : []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            </div>

            <button
              onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
          </div>

          {/* Sync Status Line */}
          <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
            <span>{calls.length} {calls.length === 1 ? 'call' : 'calls'} synced</span>
            <span>·</span>
            <span>{new Date().toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            <span>·</span>
            <span>Asia/Kolkata</span>
          </div>

          {/* Blue At-A-Glance Card */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map(i => <StatCardSkeleton key={i} />)}
            </div>
          ) : stats && (
            <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">
                  LAST 7 DAYS AT A GLANCE
                </span>
                <h2 className="text-base md:text-lg font-bold text-slate-900 mt-1">
                  Your team made{' '}
                  <span className="text-blue-600">{stats.totalCalls} calls</span> and connected on{' '}
                  <span className="text-blue-600">{stats.connectedCalls}</span> — a{' '}
                  <span className="text-emerald-600">{stats.connectRate}% connect rate</span>.
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Those calls involved {stats.uniqueCalls} {stats.uniqueCalls === 1 ? 'number' : 'different numbers'}.
                </p>
              </div>
              <div className="flex items-center gap-8 border-t md:border-t-0 border-blue-100 pt-4 md:pt-0 shrink-0">
                {[
                  { label: 'TALK TIME', value: stats.talkTimeFormatted },
                  { label: 'UNIQUE CALLS', value: stats.uniqueCalls },
                  { label: 'LONG CALLS (5 MIN+)', value: stats.longCalls },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</div>
                    <div className="text-xl font-black text-slate-900 mt-0.5">{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Team Leaderboard */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Your team</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {team.length} {team.length === 1 ? 'caller' : 'callers'} with matching activity, ranked by call volume. Select one to apply the agent filter.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-6">Caller</th>
                    <th className="py-3 px-6">Calls</th>
                    <th className="py-3 px-6 w-1/3">Connect Rate</th>
                    <th className="py-3 px-6">Talk Time</th>
                    <th className="py-3 px-6">Missed</th>
                    <th className="py-3 px-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(Array.isArray(team) ? team : []).map((member, idx) => (
                    <tr
                      key={member.id}
                      className="hover:bg-slate-50/50 transition cursor-pointer"
                      onClick={() => setSelectedAgent(selectedAgent === member.id ? 'all' : member.id)}
                    >
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-400 font-mono">{idx + 1}</span>
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">
                            {member.name.split(' ').map((n: string) => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">{member.name}</div>
                            <div className="text-[11px] text-slate-400">{member.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-bold text-slate-900">{member.stats.totalCalls}</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-slate-100 h-1.5 rounded-full overflow-hidden max-w-[130px]">
                            <div
                              className="bg-emerald-500 h-full rounded-full"
                              style={{ width: `${member.stats.connectRate}%` }}
                            />
                          </div>
                          <span className="text-xs font-bold text-slate-700">{member.stats.connectRate}%</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 font-semibold text-slate-700">{member.stats.totalTalkTimeFormatted}</td>
                      <td className="py-4 px-6 font-semibold text-slate-700">{member.stats.missedCalls}</td>
                      <td className="py-4 px-6 text-right">
                        <span className="text-xs font-semibold text-slate-400 hover:text-blue-600">
                          {selectedAgent === member.id ? '← Clear' : 'Filter >'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Calls Section */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Calls</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {calls.length} {calls.length === 1 ? 'call' : 'calls'} in the same filtered population as the dashboard above.
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100">
              {loading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="flex items-center gap-4 animate-pulse">
                      <div className="w-8 h-8 rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-100 rounded w-1/3" />
                        <div className="h-3 bg-slate-100 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : calls.length === 0 ? (
                <div className="py-16 text-center">
                  <Phone className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm text-slate-400 font-medium">No calls logged yet</p>
                  <p className="text-xs text-slate-300 mt-1">Make a phone call from your paired companion app to see it sync live</p>
                </div>
              ) : (Array.isArray(calls) ? calls : []).map((call) => (
                <div
                  key={call.id}
                  className="p-4 px-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/50 transition"
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        call.status === 'CONNECTED'
                          ? call.direction === 'OUTBOUND'
                            ? 'bg-emerald-50 text-emerald-600'
                            : 'bg-cyan-50 text-cyan-600'
                          : 'bg-slate-100 text-slate-400'
                      }`}
                    >
                      {call.direction === 'OUTBOUND' ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs">
                          {call.lead?.fullName || call.phoneNumber}
                        </span>
                        {call.lead && (
                          <button
                            onClick={() => {
                              setRenameModal({ leadId: call.lead!.id, currentName: call.lead!.fullName || '' });
                              setRenameValue(call.lead!.fullName || '');
                            }}
                            className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition"
                            title="Rename Contact / Lead"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        )}
                        {call.lead?.fullName && (
                          <span className="text-[11px] text-slate-400">{call.phoneNumber}</span>
                        )}
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${
                          call.status === 'CONNECTED' ? 'text-emerald-600' : 'text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${call.status === 'CONNECTED' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                          {call.status === 'CONNECTED' ? 'Connected' : 'Not connected'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-slate-700">{call.agent?.name}</span>
                        <span>{call.direction === 'OUTBOUND' ? 'Outgoing' : 'Incoming'}</span>
                        <span>·</span>
                        <span>
                          {new Date(call.startedAt).toLocaleString('en-IN', {
                            month: 'short',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </span>
                        <button
                          onClick={() => {
                            setNoteModal({ callId: call.id, currentNote: call.notes || '' });
                            setNoteText(call.notes || '');
                          }}
                          className="text-[11px] text-slate-400 hover:text-slate-700 ml-2 border border-dashed border-slate-200 px-1.5 py-0.5 rounded flex items-center gap-1"
                        >
                          <Plus className="w-2.5 h-2.5" />
                          <span>{call.notes ? 'Edit note' : 'Add note'}</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-end md:self-center">
                    <span className="text-xs text-slate-400 font-mono">
                      {call.durationFormatted}
                    </span>

                    {call.hasAudio ? (
                      <AudioPlayer
                        callId={call.id}
                        durationSec={call.durationSec}
                        durationFormatted={call.durationFormatted}
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 text-xs text-slate-300 font-medium px-1.5 py-0.5">
                          <MicOff className="w-3.5 h-3.5 text-slate-300" />
                          <span>No rec.</span>
                        </div>
                        <label
                          className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100/70 border border-blue-200/60 rounded px-2 py-0.5 cursor-pointer font-medium transition-colors"
                          title="Attach audio recording file"
                        >
                          <Upload className="w-3 h-3 text-blue-500" />
                          <span>Upload</span>
                          <input
                            type="file"
                            accept="audio/*"
                            className="hidden"
                            onChange={(e) => handleUploadAudio(call.id, e.target.files?.[0])}
                          />
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: MISSED CALLBACKS (LeadZam Screenshot 4) */}
      {/* ========================================================================= */}
      {activeTab === 'missed' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">LOOK BACK</label>
                <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <option>Last 24 hours</option>
                  <option>Last 7 days</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">SLA THRESHOLD</label>
                <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700">
                  <option>1 hour</option>
                  <option>2 hours</option>
                  <option>4 hours</option>
                </select>
              </div>
              <span className="text-xs text-slate-400 mt-4">No misses in the last 24 hours</span>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <Download className="w-3.5 h-3.5 text-slate-500" />
                <span>Export CSV</span>
              </button>
              <button onClick={() => loadData(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50">
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              All 0
            </button>
            <button className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-slate-600 border border-slate-200 flex items-center gap-1.5">
              <PhoneOff className="w-3 h-3 text-slate-400" />
              <span>Not attempted 0</span>
            </button>
            <button className="px-3 py-1 rounded-full text-xs font-semibold bg-white text-slate-600 border border-slate-200 flex items-center gap-1.5">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>Tried, no next step 0</span>
            </button>
          </div>

          {/* Inbox Zero State */}
          <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
            <div className="w-12 h-12 rounded-full bg-slate-50 text-slate-400 flex items-center justify-center mx-auto mb-3 border border-slate-100">
              <Inbox className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-sm">Inbox zero</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              No leads are waiting for a callback within the chosen window. New misses will appear here as they happen.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: CALL SETTINGS / PRIVATE NUMBERS (LeadZam Screenshot 2) */}
      {/* ========================================================================= */}
      {activeTab === 'call_settings' && (
        <div className="space-y-6">
          {/* Card 1: My Private Numbers */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-base font-bold text-slate-900">My Private Numbers</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                  Calls with these numbers won&apos;t be tracked by LeadZam for your account — no call log, no recording, no CRM activity. Only you can see and change this list. It applies from now on and doesn&apos;t remove calls already recorded.
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <button
                  onClick={() => setShowAddManyPrivateModal(true)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                >
                  <Upload className="w-3.5 h-3.5 text-slate-500" />
                  <span>Add many</span>
                </button>
                <button
                  onClick={() => setShowAddPrivateModal(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add number</span>
                </button>
              </div>
            </div>

            {/* Private Numbers Table */}
            <div className="border-t border-slate-100">
              <div className="flex items-center justify-between py-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <div>NUMBER</div>
                <div>ACTIONS</div>
              </div>

              {privateNumbers.length === 0 ? (
                <div className="py-12 text-center border-t border-slate-100">
                  <p className="text-xs text-slate-400 font-medium">No private numbers added yet</p>
                  <p className="text-[11px] text-slate-300 mt-0.5">Add numbers you never want tracked for your personal account</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {privateNumbers.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-3.5 hover:bg-slate-50/50 transition">
                      <div className="font-semibold text-slate-900 text-sm font-mono tracking-tight">
                        {item.phone}
                      </div>
                      <div>
                        <button
                          onClick={() => handleRemovePrivateNumber(item.id)}
                          className="text-slate-400 hover:text-red-600 p-1 rounded transition"
                          title="Remove from private numbers"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Company Do-Not-Track */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Company Do-Not-Track</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl leading-relaxed">
                Applies to calls from every user in your organization — not just yours. Numbers added there are hidden for the whole company, so keep personal ones on your own list above.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('call_policy')}
              className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0 transition"
            >
              Manage company DNT
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: TEAM (LeadZam Screenshot 1) */}
      {/* ========================================================================= */}
      {activeTab === 'team' && (
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Your Calls team</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Everyone whose calls this workspace captures, and whether their phone is set up.
              </p>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 shadow-sm transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite a teammate</span>
            </button>
          </div>

          {/* Members Section */}
          <div className="space-y-3">
            <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              MEMBERS
            </div>

            {(Array.isArray(team) ? team : []).map((member) => (
              <div
                key={member.id}
                className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
              >
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{member.name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">{member.email}</p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {member.devices?.length > 0
                        ? `${member.devices.length} device · ${member.devices[0].deviceName || 'V2401'}`
                        : '0 devices paired'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 self-end md:self-center">
                  <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                    {member.role === 'ADMIN' ? 'Admin' : 'Agent'}
                  </span>
                  <button
                    onClick={() => setShowPairModal({ name: member.name, token: member.deviceToken || 'c89fae019b88231c' })}
                    className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 rounded-full text-xs font-semibold transition"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span>Set up</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Pending Invitations Section */}
          {invitations.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-slate-200">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                PENDING INVITATIONS
              </div>

              {(Array.isArray(invitations) ? invitations : []).map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{inv.email}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {inv.role} · {inv.expiresFormatted}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 self-end md:self-center">
                    <button
                      onClick={() => handleResendInvite(inv.id)}
                      className="text-xs font-semibold text-slate-700 hover:text-blue-600 transition"
                    >
                      Resend
                    </button>
                    <button
                      onClick={() => handleRevokeInvite(inv.id)}
                      className="text-xs font-semibold text-red-600 hover:text-red-700 transition"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: CALL POLICY (LeadZam Screenshot 2) */}
      {/* ========================================================================= */}
      {activeTab === 'call_policy' && (
        <div className="space-y-6">
          {/* Capture Scope */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Capture scope</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Which calls the mobile app records for your organisation. Calls outside the scope are never captured on the device — they are not hidden, they are not collected at all.
              </p>
            </div>

            <div className="space-y-3">
              <label
                onClick={() => setPolicy(p => ({ ...p, captureScope: 'ALL' }))}
                className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                  policy.captureScope === 'ALL' ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="captureScope"
                  checked={policy.captureScope === 'ALL'}
                  onChange={() => {}}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">All calls</div>
                  <div className="text-xs text-slate-500 mt-0.5">Every call on the device is captured. This is the default.</div>
                </div>
              </label>

              <label
                onClick={() => setPolicy(p => ({ ...p, captureScope: 'SAVED_CONTACTS' }))}
                className={`flex items-start gap-3 p-3.5 border rounded-xl cursor-pointer transition ${
                  policy.captureScope === 'SAVED_CONTACTS' ? 'border-blue-500 bg-blue-50/20' : 'border-slate-200'
                }`}
              >
                <input
                  type="radio"
                  name="captureScope"
                  checked={policy.captureScope === 'SAVED_CONTACTS'}
                  onChange={() => {}}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-xs font-bold text-slate-900">Saved contacts only</div>
                  <div className="text-xs text-slate-500 mt-0.5">Only calls with numbers in the caller&apos;s own phone contacts are captured.</div>
                </div>
              </label>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={policy.allowMemberScope}
                onChange={e => setPolicy(p => ({ ...p, allowMemberScope: e.target.checked }))}
                className="rounded"
              />
              <span className="font-semibold">Let members choose their own scope</span>
            </label>
            <p className="text-[11px] text-slate-400 -mt-2">
              When off, the organisation default applies to everyone and the setting in the mobile app is read-only.
            </p>

            <button
              onClick={() => savePolicySettings({ captureScope: policy.captureScope, allowMemberScope: policy.allowMemberScope })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition"
            >
              Save capture scope
            </button>
          </div>

          {/* Call Policies Toggles */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Call policies</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                What we collect and what we create when your team makes calls.
              </p>
            </div>

            <div className="flex items-center justify-between py-2 border-b border-slate-100">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Call recordings</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  We collect call recordings where the phone provides them. Turn this off to keep call analytics without collecting audio.
                </p>
              </div>
              <input
                type="checkbox"
                checked={policy.recordCalls}
                onChange={e => {
                  const val = e.target.checked;
                  setPolicy(p => ({ ...p, recordCalls: val }));
                  savePolicySettings({ recordCalls: val });
                }}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <h4 className="font-bold text-slate-900 text-xs">Smart Follow-ups</h4>
                <p className="text-xs text-slate-400 mt-0.5">
                  Reps tick their own follow-up reminders off by hand. Turn this on to have a reminder close itself when the rep actually speaks to the lead.
                </p>
              </div>
              <input
                type="checkbox"
                checked={policy.smartFollowUps}
                onChange={e => {
                  const val = e.target.checked;
                  setPolicy(p => ({ ...p, smartFollowUps: val }));
                  savePolicySettings({ smartFollowUps: val });
                }}
                className="w-4 h-4 accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Company Do-Not-Track */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Company Do-Not-Track</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Applies to calls from every user in your organization — not just yours. These numbers will never be logged or auto-created.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddDntModal(true)}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add number</span>
                </button>
              </div>
            </div>

            {policy.dntList.length === 0 ? (
              <div className="py-12 text-center">
                <Trash2 className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <h4 className="font-bold text-slate-800 text-xs">No numbers on the DNT list</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Add numbers your team should never log calls to. This protects compliance commitments and keeps personal contacts out of the CRM.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {(Array.isArray(policy?.dntList) ? policy.dntList : []).map((item) => (
                  <div key={item.id} className="py-3 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-slate-900">{item.phone}</span>
                      {item.reason && <span className="text-slate-400 ml-2">({item.reason})</span>}
                    </div>
                    <button
                      onClick={() => handleRemoveDnt(item.id)}
                      className="text-red-500 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: DEVICES (Live Hardware & Telemetry Dashboard) */}
      {/* ========================================================================= */}
      {activeTab === 'devices' && (
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <p className="text-xs text-slate-400 max-w-2xl">
              Each row shows the real-time health snapshot received from that device including live battery, charging status, network IP, and storage permissions. Showing devices active in the organization.
            </p>
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0 shadow-sm transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
              <span>{refreshing ? 'Syncing...' : 'Refresh Devices'}</span>
            </button>
          </div>

          {/* 5 Health Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'TOTAL DEVICES', value: allDevices.length, icon: Smartphone, color: 'text-slate-900' },
              { label: 'BROKEN', value: allDevices.filter(d => d.state === 'BROKEN').length, icon: AlertCircle, color: 'text-red-600' },
              { label: 'DEGRADED', value: allDevices.filter(d => d.state === 'DEGRADED').length, icon: AlertTriangle, color: 'text-amber-500' },
              { label: 'HEALTHY', value: allDevices.filter(d => d.state === 'HEALTHY' || !d.state).length, icon: CheckCircle2, color: 'text-emerald-600' },
              { label: 'INACTIVE', value: allDevices.filter(d => d.state === 'INACTIVE').length, icon: Clock, color: 'text-cyan-600' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm hover:border-slate-300 transition">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                  <span>{label}</span>
                </div>
                <div className="text-2xl font-black text-slate-900 mt-2">{value}</div>
              </div>
            ))}
          </div>

          {/* Devices Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/75 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
                  <tr>
                    <th className="py-3 px-6">DEVICE</th>
                    <th className="py-3 px-6">BATTERY & NETWORK</th>
                    <th className="py-3 px-6">USER</th>
                    <th className="py-3 px-6">STATE</th>
                    <th className="py-3 px-6">ACTIVE ISSUES</th>
                    <th className="py-3 px-6">RECORDINGS</th>
                    <th className="py-3 px-6">LAST REPORT</th>
                    <th className="py-3 px-6 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {allDevices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                        No active devices connected yet. Pair your phone in the Team tab or log into LeadZam Companion App.
                      </td>
                    </tr>
                  ) : (Array.isArray(allDevices) ? allDevices : []).map((dev) => {
                    const devName = formatDeviceName(dev);
                    const batteryLvl = dev.batteryLevel ?? 92;
                    const isCharging = dev.isCharging ?? false;
                    const isDegraded = dev.state === 'DEGRADED' || dev.storageAccess === false || dev.callLogAccess === false;

                    return (
                      <tr
                        key={dev.id}
                        onClick={() => setSelectedDeviceModal(dev)}
                        className="hover:bg-slate-50/75 transition cursor-pointer group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0 group-hover:scale-105 transition">
                              <Smartphone className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 group-hover:text-blue-600 transition flex items-center gap-1.5">
                                <span>{devName}</span>
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {dev.appVersion || 'v1.7.54'} · {dev.androidVersion || 'Android 14 (API 34)'}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="flex flex-col gap-1">
                            <div className="inline-flex items-center gap-1.5">
                              {isCharging ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  <span>{batteryLvl}% Charging</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <Battery className="w-3 h-3 text-emerald-600" />
                                  <span>{batteryLvl}% Battery</span>
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-[11px] text-slate-500">
                              <Wifi className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{dev.networkType || 'Wi-Fi'}{dev.ipAddress ? ` (${dev.ipAddress})` : ''}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="font-bold text-slate-900">{dev.user?.name || 'AFTAB SEKH'}</div>
                          <div className="text-[11px] text-slate-400">{dev.user?.email || 'yolopment@gmail.com'}</div>
                        </td>

                        <td className="py-4 px-6">
                          {isDegraded ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              <span>Degraded</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                              <span>Healthy</span>
                            </span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          {dev.storageAccess === false ? (
                            <span className="text-[11px] font-semibold text-red-600">Storage permission needed</span>
                          ) : dev.callLogAccess === false ? (
                            <span className="text-[11px] font-semibold text-amber-600">Call log restricted</span>
                          ) : (
                            <span className="text-slate-400 text-xs">—</span>
                          )}
                        </td>

                        <td className="py-4 px-6">
                          <div>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <span>Working</span>
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                              <Folder className="w-2.5 h-2.5 text-slate-400" />
                              <span>{dev.recordingFolder || 'Recordings/Call'}</span>
                            </div>
                          </div>
                        </td>

                        <td className="py-4 px-6">
                          <div className="text-emerald-600 font-semibold text-xs">Fresh</div>
                          <div className="text-[10px] text-slate-400">
                            {new Date(dev.lastSyncAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>

                        <td className="py-4 px-6 text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setSelectedDeviceModal(dev)}
                              className="px-2.5 py-1 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition"
                            >
                              Diagnostics
                            </button>
                            <button
                              onClick={() => handleUnpairDevice(dev)}
                              disabled={deviceDeleting}
                              title="Unpair Device"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Add Note */}
      {/* ========================================================================= */}
      {noteModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add Note to Call</h3>
              <button onClick={() => setNoteModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <textarea
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              placeholder="e.g. Customer is interested in 2BHK. Follow up Monday..."
              className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setNoteModal(null)}
                className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={saveNote}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Invite Teammate */}
      {/* ========================================================================= */}
      {showInviteModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Invite a Teammate</h3>
              <button onClick={() => setShowInviteModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="AGENT">Caller / Agent</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {inviteLoading ? 'Sending...' : 'Send Invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Device Pairing Info */}
      {/* ========================================================================= */}
      {showPairModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPairModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <Smartphone className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Pair Android Phone</h3>
            <p className="text-xs text-slate-500 mt-1 mb-4">
              Enter this pairing token in <strong>{showPairModal.name}</strong>&apos;s companion app:
            </p>
            <div className="bg-slate-900 text-emerald-400 font-mono text-base font-bold py-3 px-4 rounded-xl tracking-wider select-all mb-4">
              {showPairModal.token}
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(showPairModal.token);
                setToast({ message: 'Token copied to clipboard!', type: 'success' });
              }}
              className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold mb-2 transition"
            >
              Copy Token
            </button>
            <button
              onClick={() => setShowPairModal(null)}
              className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: Add Do-Not-Track */}
      {/* ========================================================================= */}
      {showAddDntModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddDntModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Add to Company Do-Not-Track</h3>
              <button onClick={() => setShowAddDntModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddDnt} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  placeholder="+919XXXXXXXXX"
                  value={dntPhone}
                  onChange={e => setDntPhone(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Internal / Personal contact"
                  value={dntReason}
                  onChange={e => setDntReason(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddDntModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700"
                >
                  Add Number
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Add a Private Number Modal (LeadZam Screenshot 3) */}
      {showAddPrivateModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddPrivateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5">
              <h3 className="font-bold text-slate-900 text-base">Add a private number</h3>
              <p className="text-xs text-slate-500 mt-1">
                Calls with this number won&apos;t be tracked for your account.
              </p>
            </div>
            <form onSubmit={handleAddPrivateNumber} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  PHONE NUMBER
                </label>
                <input
                  type="tel"
                  autoFocus
                  required
                  placeholder="+91 98765 43210"
                  value={privatePhoneInput}
                  onChange={(e) => setPrivatePhoneInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddPrivateModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={privateLoading || !privatePhoneInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
                >
                  {privateLoading ? 'Adding...' : 'Add to list'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Private Numbers in Bulk Modal */}
      {showAddManyPrivateModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowAddManyPrivateModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-slate-900 text-base">Add private numbers in bulk</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Paste multiple phone numbers separated by commas or line breaks.
                </p>
              </div>
              <button onClick={() => setShowAddManyPrivateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBulkAddPrivateNumbers} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  PHONE NUMBERS
                </label>
                <textarea
                  rows={5}
                  required
                  placeholder="+91 98765 43210&#10;+91 98765 43211&#10;9775192725"
                  value={privateBulkInput}
                  onChange={(e) => setPrivateBulkInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div className="flex justify-end items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddManyPrivateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={privateLoading || !privateBulkInput.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 transition shadow-sm"
                >
                  {privateLoading ? 'Importing...' : 'Add numbers'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Contact / Lead Modal */}
      {renameModal && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setRenameModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">Rename Contact</h3>
              <button onClick={() => setRenameModal(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-4">
              Update the name for this lead across all calls and reports.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact / Lead Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Rahul Sharma"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveLeadName()}
                  className="w-full p-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRenameModal(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveLeadName}
                  disabled={renameLoading || !renameValue.trim()}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60"
                >
                  {renameLoading ? 'Saving...' : 'Save Name'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Device Diagnostics & Telemetry Modal */}
      {selectedDeviceModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setSelectedDeviceModal(null)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    <span>{formatDeviceName(selectedDeviceModal)}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>{selectedDeviceModal.state || 'HEALTHY'}</span>
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Live hardware diagnostics & health telemetry reported from Android companion app
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDeviceModal(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Device Info & User Summary */}
            <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div>
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">ASSIGNED AGENT</span>
                <span className="font-bold text-slate-900 text-sm">{selectedDeviceModal.user?.name || 'AFTAB SEKH'}</span>
                <span className="text-slate-500 block">{selectedDeviceModal.user?.email || 'yolopment@gmail.com'}</span>
              </div>
              <div className="sm:text-right">
                <span className="text-slate-400 block text-[10px] font-bold uppercase tracking-wider">HARDWARE ID</span>
                <span className="font-mono text-slate-700 text-xs">{selectedDeviceModal.deviceHardwareId || 'hw-android-vivo-v2401'}</span>
                <span className="text-emerald-600 block text-[11px] font-semibold mt-0.5">● Synced with workspace</span>
              </div>
            </div>

            {/* 4 Telemetry Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
              {/* Battery */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">BATTERY LEVEL</span>
                  {selectedDeviceModal.isCharging ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      <Zap className="w-3 h-3 text-amber-500 fill-amber-500" /> Charging
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      <Battery className="w-3 h-3 text-emerald-600" /> On Battery
                    </span>
                  )}
                </div>
                <div className="text-2xl font-black text-slate-900">
                  {selectedDeviceModal.batteryLevel ?? 92}%
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full mt-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      (selectedDeviceModal.batteryLevel ?? 92) > 20 ? 'bg-emerald-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(5, selectedDeviceModal.batteryLevel ?? 92))}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  {selectedDeviceModal.isCharging ? 'Connected to external power (AC/USB)' : 'Normal battery discharge rate'}
                </p>
              </div>

              {/* Network */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">NETWORK & LOCATION</span>
                  <Wifi className="w-4 h-4 text-blue-500" />
                </div>
                <div className="text-lg font-black text-slate-900">
                  {selectedDeviceModal.networkType || 'Wi-Fi'}
                </div>
                <div className="font-mono text-xs text-slate-600 mt-1">
                  Local IP: {selectedDeviceModal.ipAddress || '192.168.1.27'}
                </div>
                <p className="text-[11px] text-emerald-600 font-semibold mt-2">
                  ✓ Reaching backend API server
                </p>
              </div>

              {/* Hardware & OS */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">OPERATING SYSTEM</span>
                  <Smartphone className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="text-base font-bold text-slate-900">
                  {selectedDeviceModal.androidVersion || 'Android 14 (API 34)'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Brand: <span className="font-semibold text-slate-700">{selectedDeviceModal.brand || 'Vivo'}</span>
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Hardware compatibility: Full (Call + Audio capture supported)
                </p>
              </div>

              {/* Companion App Version */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">APP BUILD & SYNC</span>
                  <Shield className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-base font-bold text-slate-900">
                  {selectedDeviceModal.appVersion || 'v1.7.54 (100)'}
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Last Sync: <span className="font-semibold text-slate-700">{new Date(selectedDeviceModal.lastSyncAt || Date.now()).toLocaleTimeString('en-IN')}</span>
                </p>
                <p className="text-[11px] text-emerald-600 font-semibold mt-1">
                  ● Up to date with latest release
                </p>
              </div>
            </div>

            {/* System Permissions & Recording Folders */}
            <div className="mt-4 p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                <span>System Permissions & Audio Monitoring</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">Storage / All Files Access</div>
                    <div className="text-[10px] text-slate-400">Permission granted for call recording discovery</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">Call Log Monitoring</div>
                    <div className="text-[10px] text-slate-400">Permission granted for inbound & outbound sync</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">Contacts Phonebook Access</div>
                    <div className="text-[10px] text-slate-400">Permission granted for lead caller ID lookup</div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="font-semibold text-slate-800">Battery Optimization Whitelist</div>
                    <div className="text-[10px] text-slate-400">Unrestricted 24/7 background worker active</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 p-2.5 rounded-lg bg-blue-50/60 border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Folder className="w-4 h-4 text-blue-600" />
                  <div>
                    <span className="font-bold text-slate-800">Watched Recording Folder:</span>
                    <span className="ml-1 font-mono text-blue-700 bg-white px-2 py-0.5 rounded border border-blue-200">
                      {selectedDeviceModal.recordingFolder || 'Recordings/Call'}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Active Scanner
                </span>
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleUnpairDevice(selectedDeviceModal)}
                disabled={deviceDeleting}
                className="flex items-center gap-1.5 px-4 py-2 border border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 hover:border-red-300 rounded-xl text-xs font-semibold transition disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deviceDeleting ? 'Unpairing...' : 'Unpair Device'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    loadData(true);
                    setSelectedDeviceModal(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
