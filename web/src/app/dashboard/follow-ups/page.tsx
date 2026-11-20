'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Clock,
  CheckCircle2,
  Phone,
  Search,
  Users,
  Calendar,
  MessageCircle,
  Smartphone,
  CheckSquare,
  Plus,
  AlertCircle,
  CalendarDays,
  X,
  ChevronRight,
  MoreVertical,
  RotateCcw,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface FollowUpItem {
  id: string;
  isSuggestion?: boolean;
  leadId: string;
  lead: {
    id: string;
    fullName?: string;
    phone: string;
    company?: string;
    stage?: string;
    stageName?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email: string;
  };
  type: 'CALL' | 'TODO' | 'MEETING' | 'GENERAL';
  title: string;
  note?: string;
  scheduledAt?: string | null;
  completedAt?: string | null;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED';
  priority: string;
  createdAt?: string;
}

interface FollowUpCounts {
  overdue: number;
  today: number;
  upcoming: number;
  done: number;
  needsFollowUp: number;
}

export default function FollowupsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'call_followups' | 'todos' | 'needs_followup'>('call_followups');
  const [scope, setScope] = useState<'me' | 'team'>('me');
  const [statusFilter, setStatusFilter] = useState<'open' | 'completed'>('open');
  const [timeFilter, setTimeFilter] = useState<'this_week' | 'overdue' | 'today' | 'all'>('this_week');
  const [search, setSearch] = useState('');
  const [followups, setFollowups] = useState<FollowUpItem[]>([]);
  const [counts, setCounts] = useState<FollowUpCounts>({
    overdue: 0,
    today: 0,
    upcoming: 0,
    done: 0,
    needsFollowUp: 0,
  });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedItemForReschedule, setSelectedItemForReschedule] = useState<FollowUpItem | null>(null);

  // New Follow-up Form State
  const [leadsList, setLeadsList] = useState<any[]>([]);
  const [scheduleForm, setScheduleForm] = useState({
    leadId: '',
    type: 'CALL' as 'CALL' | 'TODO' | 'MEETING',
    title: '',
    scheduledAt: '',
    note: '',
    priority: 'NORMAL',
  });
  const [scheduling, setScheduling] = useState(false);

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [rescheduling, setRescheduling] = useState(false);

  // Fetch follow-ups from API
  const loadFollowups = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        tab: activeTab,
        scope,
        status: statusFilter,
        timeFilter,
        ...(search ? { search } : {}),
      });

      const res = await fetchWithAuth(`/followups?${params.toString()}`);
      if (res) {
        setFollowups(res.items || []);
        if (res.counts) setCounts(res.counts);
      }
    } catch (err: any) {
      console.error('Failed to load followups:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, scope, statusFilter, timeFilter, search]);

  useEffect(() => {
    loadFollowups();
  }, [loadFollowups]);

  // Load leads for modal dropdown
  const loadLeadsForModal = async () => {
    try {
      const data = await fetchWithAuth('/leads?limit=100');
      if (data?.leads) {
        setLeadsList(data.leads);
        if (data.leads.length > 0 && !scheduleForm.leadId) {
          setScheduleForm((prev) => ({ ...prev, leadId: data.leads[0].id }));
        }
      }
    } catch (err) {
      console.error('Failed to load leads for modal:', err);
    }
  };

  const handleOpenScheduleModal = (prefillLeadId?: string) => {
    // Default scheduled time: tomorrow at 10:00 AM
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setScheduleForm({
      leadId: prefillLeadId || '',
      type: activeTab === 'todos' ? 'TODO' : 'CALL',
      title: activeTab === 'todos' ? 'Follow up on proposal' : 'Follow-up phone call',
      scheduledAt: localIso,
      note: '',
      priority: 'NORMAL',
    });
    loadLeadsForModal();
    setShowScheduleModal(true);
  };

  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.leadId) {
      setToast({ message: 'Please select a lead', type: 'error' });
      return;
    }
    if (!scheduleForm.scheduledAt) {
      setToast({ message: 'Please select date and time', type: 'error' });
      return;
    }

    setScheduling(true);
    try {
      await fetchWithAuth('/followups', {
        method: 'POST',
        body: JSON.stringify(scheduleForm),
      });
      setToast({ message: 'Follow-up scheduled successfully!', type: 'success' });
      setShowScheduleModal(false);
      loadFollowups();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to schedule follow-up', type: 'error' });
    } finally {
      setScheduling(false);
    }
  };

  const handleComplete = async (item: FollowUpItem) => {
    try {
      await fetchWithAuth(`/followups/${item.id}/complete`, { method: 'PATCH' });
      setToast({ message: `Marked "${item.title}" as completed!`, type: 'success' });
      loadFollowups();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to complete', type: 'error' });
    }
  };

  const handleOpenReschedule = (item: FollowUpItem) => {
    setSelectedItemForReschedule(item);
    const defaultDate = item.scheduledAt ? new Date(item.scheduledAt) : new Date();
    defaultDate.setDate(defaultDate.getDate() + 1);
    const localIso = new Date(defaultDate.getTime() - defaultDate.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    setRescheduleDate(localIso);
    setRescheduleNote('');
    setShowRescheduleModal(true);
  };

  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItemForReschedule) return;

    setRescheduling(true);
    try {
      await fetchWithAuth(`/followups/${selectedItemForReschedule.id}/reschedule`, {
        method: 'PATCH',
        body: JSON.stringify({
          scheduledAt: rescheduleDate,
          note: rescheduleNote || undefined,
        }),
      });
      setToast({ message: 'Follow-up rescheduled!', type: 'success' });
      setShowRescheduleModal(false);
      loadFollowups();
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to reschedule', type: 'error' });
    } finally {
      setRescheduling(false);
    }
  };

  // Remote phone dial
  const triggerRemoteDial = async (phone: string, leadName?: string) => {
    try {
      await fetchWithAuth('/calls/dial-request', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber: phone, leadName: leadName || 'Lead' }),
      });
      setToast({
        message: `Dial command sent to phone for ${leadName || phone}!`,
        type: 'success',
      });
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to trigger call on phone', type: 'error' });
    }
  };

  // Quick preset helper
  const applyPreset = (hoursFromNow: number) => {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setScheduleForm((prev) => ({ ...prev, scheduledAt: localIso }));
  };

  // Check if date is overdue
  const isOverdue = (dateStr?: string | null) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date();
  };

  // Format schedule text
  const formatScheduled = (dateStr?: string | null) => {
    if (!dateStr) return 'Needs scheduling';
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isTomorrow =
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1).toDateString() === d.toDateString();

    const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (isToday) return `Today at ${time}`;
    if (isTomorrow) return `Tomorrow at ${time}`;
    return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`;
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-2xl shadow-lg border flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-top-2 ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top Header Matching Screenshot 6 & 7 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Good morning, {user?.name || 'Aftab Sk'}</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {counts.overdue > 0 ? (
              <span className="text-rose-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 inline" /> {counts.overdue} follow-up
                {counts.overdue > 1 ? 's' : ''} overdue — take action today
              </span>
            ) : counts.today > 0 ? (
              <span className="text-blue-600 font-semibold">
                {counts.today} follow-up{counts.today > 1 ? 's' : ''} scheduled for today
              </span>
            ) : (
              "nothing pending — you're all caught up"
            )}
          </p>
        </div>

        {/* Right Action Bar */}
        <div className="flex items-center gap-3">
          {/* Scope Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setScope('me')}
              className={`px-3 py-1 rounded-lg transition ${
                scope === 'me' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Me
            </button>
            <button
              onClick={() => setScope('team')}
              className={`px-3 py-1 rounded-lg transition ${
                scope === 'team' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Team
            </button>
          </div>

          <Link
            href="/dashboard/reports"
            className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl transition shadow-xs"
          >
            Team report
          </Link>

          <button
            onClick={() => handleOpenScheduleModal()}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Schedule Follow-up</span>
          </button>
        </div>
      </div>

      {/* Quick Summary Counter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <button
          onClick={() => {
            setActiveTab('call_followups');
            setStatusFilter('open');
            setTimeFilter('overdue');
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            timeFilter === 'overdue' && statusFilter === 'open'
              ? 'bg-rose-50/80 border-rose-300 ring-2 ring-rose-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-rose-600 text-xs font-bold">
            <span>Overdue</span>
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{counts.overdue}</div>
        </button>

        <button
          onClick={() => {
            setActiveTab('call_followups');
            setStatusFilter('open');
            setTimeFilter('today');
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            timeFilter === 'today' && statusFilter === 'open'
              ? 'bg-blue-50/80 border-blue-300 ring-2 ring-blue-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-blue-600 text-xs font-bold">
            <span>Today</span>
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{counts.today}</div>
        </button>

        <button
          onClick={() => {
            setActiveTab('call_followups');
            setStatusFilter('open');
            setTimeFilter('all');
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            timeFilter === 'all' && statusFilter === 'open'
              ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-amber-600 text-xs font-bold">
            <span>Upcoming</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{counts.upcoming}</div>
        </button>

        <button
          onClick={() => {
            setStatusFilter('completed');
            setTimeFilter('all');
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            statusFilter === 'completed'
              ? 'bg-emerald-50/80 border-emerald-300 ring-2 ring-emerald-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-600 text-xs font-bold">
            <span>Done</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{counts.done}</div>
        </button>

        <button
          onClick={() => {
            setActiveTab('needs_followup');
            setStatusFilter('open');
          }}
          className={`p-3.5 rounded-2xl border text-left transition ${
            activeTab === 'needs_followup'
              ? 'bg-purple-50/80 border-purple-300 ring-2 ring-purple-500/20'
              : 'bg-white border-slate-200 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between text-purple-600 text-xs font-bold">
            <span>Needs Follow-up</span>
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-xl font-extrabold text-slate-900 mt-1">{counts.needsFollowUp}</div>
        </button>
      </div>

      {/* Tabs Row */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab('call_followups')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'call_followups' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Call follow-ups
        </button>
        <button
          onClick={() => setActiveTab('todos')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'todos' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          To-dos
        </button>
        <button
          onClick={() => setActiveTab('needs_followup')}
          className={`px-4 py-2 text-xs font-bold rounded-xl transition ${
            activeTab === 'needs_followup' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Needs follow-up
          {counts.needsFollowUp > 0 && (
            <span className="ml-1.5 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px]">
              {counts.needsFollowUp}
            </span>
          )}
        </button>
      </div>

      {/* Filter Row matching Screenshot 7 */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          {/* Open vs Completed */}
          <div className="bg-slate-100 p-0.5 rounded-xl flex items-center text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('open')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'open' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 rounded-lg transition ${
                statusFilter === 'completed' ? 'bg-white text-slate-800 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Completed
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, phone, company, or note..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>
        </div>

        {/* Time Filter Pills */}
        {activeTab !== 'needs_followup' && (
          <div className="flex items-center gap-1.5">
            {(['this_week', 'overdue', 'today', 'all'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                className={`px-3 py-1 rounded-full text-xs font-semibold capitalize transition ${
                  timeFilter === t ? 'bg-blue-600 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {t.replace('_', ' ')}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Follow-up Cards or Empty State */}
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-slate-400">Loading follow-ups...</p>
        </div>
      ) : followups.length === 0 ? (
        /* Empty State Card matching Screenshot 7 */
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center shadow-xs flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center mb-3">
            <CheckCircle2 className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-slate-900">You're all caught up</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">No follow-ups need you here right now.</p>
          <div className="mt-5 flex items-center gap-3">
            <Link
              href="/dashboard/leads"
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
            >
              Browse leads
            </Link>
            <button
              onClick={() => handleOpenScheduleModal()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
            >
              + Schedule a follow-up
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {followups.map((item) => {
            const overdue = item.status === 'PENDING' && isOverdue(item.scheduledAt);
            return (
              <div
                key={item.id}
                className={`p-4 bg-white rounded-2xl border transition shadow-xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                  overdue ? 'border-rose-300/80 bg-rose-50/20' : 'border-slate-200'
                }`}
              >
                {/* Left details */}
                <div className="flex items-start gap-3.5 min-w-0">
                  {/* Status checkbox button */}
                  {item.status === 'PENDING' ? (
                    <button
                      onClick={() => handleComplete(item)}
                      title="Mark as done"
                      className="mt-0.5 w-6 h-6 rounded-lg border-2 border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 text-transparent hover:text-emerald-600 flex items-center justify-center transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  ) : (
                    <div className="mt-0.5 w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/leads?search=${item.lead?.phone || ''}`}
                        className="text-sm font-bold text-slate-900 hover:text-blue-600 transition flex items-center gap-1"
                      >
                        {item.lead?.fullName || 'Unnamed Lead'}
                        <ArrowUpRight className="w-3.5 h-3.5 text-slate-400" />
                      </Link>

                      {/* Lead Stage badge */}
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        • {item.lead?.stageName || item.lead?.stage || 'Fresh'}
                      </span>

                      {/* Type badge */}
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          item.type === 'CALL'
                            ? 'bg-blue-50 text-blue-700'
                            : item.type === 'TODO'
                            ? 'bg-purple-50 text-purple-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {item.type}
                      </span>

                      {/* Overdue alert badge */}
                      {overdue && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> Overdue
                        </span>
                      )}
                    </div>

                    {/* Title & Note */}
                    <p className="text-xs font-semibold text-slate-800">{item.title}</p>
                    {item.note && <p className="text-xs text-slate-500 line-clamp-1">{item.note}</p>}

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 mt-1">
                      <span className="font-mono text-slate-600">{item.lead?.phone || 'No phone'}</span>
                      {item.lead?.company && <span>• {item.lead.company}</span>}
                      {item.assignedTo && <span>• Assigned: {item.assignedTo.name}</span>}
                      {item.scheduledAt && (
                        <span className={`font-semibold flex items-center gap-1 ${overdue ? 'text-rose-600' : 'text-slate-600'}`}>
                          <Clock className="w-3 h-3 inline" /> {formatScheduled(item.scheduledAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                  {item.isSuggestion ? (
                    <button
                      onClick={() => handleOpenScheduleModal(item.leadId)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Schedule Follow-up</span>
                    </button>
                  ) : (
                    <>
                      {/* Call on Phone */}
                      <button
                        onClick={() => triggerRemoteDial(item.lead?.phone || '', item.lead?.fullName)}
                        title="Dials immediately on your companion phone"
                        className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition"
                      >
                        <Smartphone className="w-3.5 h-3.5 text-blue-600" />
                        <span>Call on Phone</span>
                      </button>

                      {/* WhatsApp */}
                      <a
                        href={`https://wa.me/${(item.lead?.phone || '').replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold transition"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp</span>
                      </a>

                      {/* Reschedule Button */}
                      {item.status === 'PENDING' && (
                        <button
                          onClick={() => handleOpenReschedule(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Reschedule</span>
                        </button>
                      )}

                      {/* Complete Check */}
                      {item.status === 'PENDING' && (
                        <button
                          onClick={() => handleComplete(item)}
                          className="flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Done</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Schedule Follow-up Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <CalendarDays className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule Follow-up</h3>
                  <p className="text-[11px] text-slate-500">Add a scheduled call or task for your team</p>
                </div>
              </div>
              <button
                onClick={() => setShowScheduleModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFollowup} className="space-y-4">
              {/* Select Lead */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Select Lead *</label>
                <select
                  value={scheduleForm.leadId}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, leadId: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                >
                  <option value="" disabled>
                    -- Select lead --
                  </option>
                  {leadsList.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName || 'Unnamed'} ({lead.phone}) - {lead.stageName || lead.stage}
                    </option>
                  ))}
                </select>
              </div>

              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Follow-up Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CALL', 'TODO', 'MEETING'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, type: t })}
                      className={`py-2 px-3 rounded-xl text-xs font-bold border transition text-center ${
                        scheduleForm.type === t
                          ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {t === 'CALL' ? '📞 Call' : t === 'TODO' ? '✓ To-Do' : '🤝 Meeting'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Title / Agenda *</label>
                <input
                  type="text"
                  value={scheduleForm.title}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                  placeholder="e.g. Call to finalize quote"
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Date & Time with quick presets */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Scheduled Date & Time *</label>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => applyPreset(1)}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      +1 hr
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => applyPreset(24)}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      Tomorrow
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => applyPreset(72)}
                      className="text-[10px] text-blue-600 hover:underline font-semibold"
                    >
                      In 3 days
                    </button>
                  </div>
                </div>
                <input
                  type="datetime-local"
                  value={scheduleForm.scheduledAt}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, scheduledAt: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note (Optional)</label>
                <textarea
                  rows={2}
                  value={scheduleForm.note}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, note: e.target.value })}
                  placeholder="Context for what needs to be discussed..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Priority</label>
                <div className="flex items-center gap-2">
                  {['NORMAL', 'HIGH', 'URGENT'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setScheduleForm({ ...scheduleForm, priority: p })}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize border transition ${
                        scheduleForm.priority === p
                          ? 'bg-slate-900 border-slate-900 text-white'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {p.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowScheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={scheduling}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {scheduling ? 'Scheduling...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reschedule Modal */}
      {showRescheduleModal && selectedItemForReschedule && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Reschedule Follow-up</h3>
                  <p className="text-[11px] text-slate-500">{selectedItemForReschedule.lead.fullName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRescheduleModal(false)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleRescheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Date & Time *</label>
                <input
                  type="datetime-local"
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Reschedule Reason (Optional)</label>
                <textarea
                  rows={2}
                  value={rescheduleNote}
                  onChange={(e) => setRescheduleNote(e.target.value)}
                  placeholder="Client asked to call back next week..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowRescheduleModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={rescheduling}
                  className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl transition shadow-xs disabled:opacity-50"
                >
                  {rescheduling ? 'Saving...' : 'Update Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
