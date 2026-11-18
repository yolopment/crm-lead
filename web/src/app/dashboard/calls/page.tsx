'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search, Calendar, Users, Filter, Download, ArrowUpRight, ArrowDownLeft,
  Phone, PhoneOff, Plus, RefreshCw, X, CheckCircle2, Circle, Clock,
  Smartphone, Shield, Settings, SlidersHorizontal, ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import AudioPlayer from '@/components/AudioPlayer';
import { fetchWithAuth } from '@/lib/api';
import { StatCardSkeleton, TableRowSkeleton, Toast, Badge } from '@/components/ui';

interface CallStats {
  totalCalls: number;
  connectedCalls: number;
  connectRate: number;
  talkTimeFormatted: string;
  uniqueCalls: number;
  longCalls: number;
}

interface Agent {
  id: string;
  name: string;
  email: string;
  stats: { totalCalls: number; connectRate: number; totalTalkTimeFormatted: string; missedCalls: number };
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
  const [showSetupBanner, setShowSetupBanner] = useState(true);
  const [stats, setStats] = useState<CallStats | null>(null);
  const [team, setTeam] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState('last_7_days');
  const [selectedAgent, setSelectedAgent] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [noteModal, setNoteModal] = useState<NoteModal | null>(null);
  const [noteText, setNoteText] = useState('');
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const params = new URLSearchParams({ range: dateRange, agentId: selectedAgent });
      if (searchTerm) params.set('search', searchTerm);

      const [statsData, teamData, callsData] = await Promise.all([
        fetchWithAuth(`/calls/stats?${params}`),
        fetchWithAuth('/team'),
        fetchWithAuth(`/calls?${params}&limit=50`),
      ]);
      setStats(statsData);
      setTeam(teamData);
      setCalls(callsData.calls || []);
    } catch (err: any) {
      if (!silent) setToast({ message: err.message || 'Failed to load data', type: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dateRange, selectedAgent, searchTerm]);

  useEffect(() => {
    loadData();
    // Auto-refresh every 30 seconds for live call updates
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONNECTED': return <Badge label="Connected" color="green" />;
      case 'MISSED': return <Badge label="Missed" color="red" />;
      case 'BUSY': return <Badge label="Busy" color="yellow" />;
      default: return <Badge label={status} />;
    }
  };

  // Filter calls based on active subtab
  const filteredCalls = calls.filter(call => {
    if (activeTab === 'missed') {
      return call.status === 'MISSED' || call.status === 'BUSY' || call.status === 'FAILED';
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Setup Progress Banner (LeadZam style) */}
      {showSetupBanner && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm relative">
          <button
            onClick={() => setShowSetupBanner(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-bold text-slate-900">Finish setting up your workspace</h2>
            <span className="text-xs text-slate-500 mr-8 font-medium">1 of 2 done</span>
          </div>
          <div className="w-full bg-slate-100 h-1 rounded-full overflow-hidden mb-4">
            <div className="bg-blue-600 h-full rounded-full" style={{ width: '50%' }} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1.5 text-xs">
              <div className="flex items-center gap-2.5 text-slate-700">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-50" />
                <span className="font-medium">Install CRM Calls companion on your phone</span>
              </div>
              <Link href="/dashboard/settings" className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
                <span>Pairing page</span>
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="flex items-center justify-between py-1.5 text-xs">
              <div className="flex items-center gap-2.5 text-slate-500">
                <Circle className="w-4 h-4 text-slate-300" />
                <span>See the whole Calls section once</span>
              </div>
              <button onClick={() => setShowSetupBanner(false)} className="text-blue-600 font-semibold hover:underline flex items-center gap-1">
                <span>Dismiss</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

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
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full text-xs font-semibold border border-emerald-200 transition"
            >
              <Smartphone className="w-3 h-3" />
              <span>Download app</span>
            </Link>
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
        <nav className="flex gap-6 overflow-x-auto">
          {SUBTABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 text-xs font-semibold transition border-b-2 whitespace-nowrap ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

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
              {team.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
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
        <span>{calls.length} calls synced</span>
        <span>·</span>
        <span>Nov 12 - Nov 18, 2026</span>
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
              Those calls involved {stats.uniqueCalls} {stats.uniqueCalls === 1 ? 'number' : 'numbers'}.
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

      {/* Team Section */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">Your team</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {team.length} {team.length === 1 ? 'caller' : 'callers'} with matching activity, ranked by call volume. Select one to apply the agent filter.
          </p>
        </div>
        <div className="overflow-x-auto" role="region" aria-labelledby="team-table-caption" tabIndex={0}>
          <table className="w-full text-left text-xs">
            <caption id="team-table-caption" className="sr-only">Team call performance</caption>
            <thead className="bg-slate-50/75 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
              <tr>
                <th scope="col" className="py-3 px-6">Caller</th>
                <th scope="col" className="py-3 px-6">Calls</th>
                <th scope="col" className="py-3 px-6 w-1/3">Connect Rate</th>
                <th scope="col" className="py-3 px-6">Talk Time</th>
                <th scope="col" className="py-3 px-6">Missed</th>
                <th scope="col" className="py-3 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                [1, 2].map(i => <TableRowSkeleton key={i} cols={6} />)
              ) : team.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-xs text-slate-400">
                    No team members found.
                  </td>
                </tr>
              ) : team.map((member, idx) => (
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
              {filteredCalls.length} {filteredCalls.length === 1 ? 'call' : 'calls'} in the same filtered population as the dashboard above.
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
                  <div className="h-8 bg-slate-100 rounded-full w-28" />
                </div>
              ))}
            </div>
          ) : filteredCalls.length === 0 ? (
            <div className="py-16 text-center">
              <Phone className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400 font-medium">No calls found</p>
              <p className="text-xs text-slate-300 mt-1">Calls will appear here once agents start syncing from their phones</p>
            </div>
          ) : filteredCalls.map((call) => (
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
                        : 'bg-blue-50 text-blue-600'
                      : 'bg-red-50 text-red-500'
                  }`}
                >
                  {call.status === 'CONNECTED' ? (
                    call.direction === 'OUTBOUND' ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownLeft className="w-4 h-4" />
                    )
                  ) : (
                    <PhoneOff className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-900 text-xs">
                      {call.lead?.fullName || call.phoneNumber}
                    </span>
                    {call.lead?.fullName && (
                      <span className="text-[11px] text-slate-400">{call.phoneNumber}</span>
                    )}
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      {call.status === 'CONNECTED' ? 'Connected' : call.status}
                    </span>
                    {call.lead?.tags && call.lead.tags.split(',').map((tag: string) => (
                      <span
                        key={tag}
                        className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium"
                      >
                        {tag.trim()}
                      </span>
                    ))}
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
                    {call.notes && (
                      <span className="italic text-slate-500">
                        &quot;{call.notes.slice(0, 40)}{call.notes.length > 40 ? '...' : ''}&quot;
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 self-end md:self-center">
                <button
                  onClick={() => {
                    setNoteModal({ callId: call.id, currentNote: call.notes || '' });
                    setNoteText(call.notes || '');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-900 font-medium flex items-center gap-1 px-2.5 py-1 rounded hover:bg-slate-100 transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{call.notes ? 'Edit note' : 'Add note'}</span>
                </button>

                {call.hasAudio ? (
                  <AudioPlayer
                    callId={call.id}
                    durationSec={call.durationSec}
                    durationFormatted={call.durationFormatted}
                  />
                ) : (
                  <span className="text-xs text-slate-400 font-medium px-3 py-1 bg-slate-50 rounded-full border border-slate-200">
                    {call.durationFormatted}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Note Modal */}
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
              <button
                onClick={() => setNoteModal(null)}
                className="text-slate-400 hover:text-slate-700"
              >
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
    </div>
  );
}
