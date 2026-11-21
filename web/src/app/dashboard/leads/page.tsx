'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  Plus,
  Users,
  Download,
  ChevronDown,
  Phone,
  Mail,
  Tag,
  X,
  Loader2,
  Edit2,
  MessageCircle,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Calendar,
  Building,
  Briefcase,
  MapPin,
  Clock,
  Play,
  Pause,
  Volume2,
  Trash2,
  RefreshCw,
  FileCheck,
  CheckCircle2,
  Upload,
  Filter,
  CheckSquare,
  FileText,
  Send,
  ExternalLink,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { Toast, Badge, TableRowSkeleton } from '@/components/ui';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const;
type Stage = (typeof STAGES)[number];

const STAGE_COLORS: Record<Stage, { badge: string; dot: string; label: string }> = {
  NEW: { badge: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400', label: 'Fresh' },
  CONTACTED: { badge: 'bg-blue-50 text-blue-700 border-blue-200', dot: 'bg-blue-500', label: 'Contacted' },
  QUALIFIED: { badge: 'bg-purple-50 text-purple-700 border-purple-200', dot: 'bg-purple-500', label: 'Qualified' },
  PROPOSAL_SENT: { badge: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500', label: 'Proposal' },
  WON: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', label: 'Won' },
  LOST: { badge: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500', label: 'Lost' },
};

const LEAD_SOURCES = [
  'Website',
  'Referral',
  'Cold Call',
  'Walk-in',
  'Event',
  'Social Media',
  'Meta Lead Ads',
  'Google Ads',
  'Other',
];

interface Lead {
  id: string;
  fullName: string | null;
  phone: string;
  alternatePhone?: string | null;
  email: string | null;
  company?: string | null;
  jobTitle?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  streetAddress?: string | null;
  streetAddress2?: string | null;
  postalCode?: string | null;
  source: string;
  campaignName: string | null;
  stage: Stage;
  stageName?: string | null;
  tags: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  _count?: { calls?: number; notes?: number; followUps?: number };
  calls?: any[];
}

interface TimelineEvent {
  id: string;
  type: 'lead_created' | 'call_logged' | 'note_added' | 'stage_changed' | 'payment';
  title: string;
  subtitle?: string;
  content?: string;
  author: string;
  platform?: string;
  audioPath?: string;
  callId?: string;
  tags?: string;
  timestamp: string;
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modals & Drawers
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [detailTimeline, setDetailTimeline] = useState<TimelineEvent[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [hideEmptyDetails, setHideEmptyDetails] = useState(false);
  const [detailTab, setDetailTab] = useState<'activity' | 'calls' | 'workflow' | 'tasks' | 'revenue'>('activity');
  const [activityFilter, setActivityFilter] = useState('all');

  // Quick Action form states inside drawer
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Follow-up scheduling modal inside drawer
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [leadFollowups, setLeadFollowups] = useState<any[]>([]);
  const [followupForm, setFollowupForm] = useState({
    type: 'CALL' as 'CALL' | 'TODO' | 'MEETING',
    title: 'Follow-up Call',
    scheduledAt: '',
    note: '',
    priority: 'NORMAL',
  });
  const [savingFollowup, setSavingFollowup] = useState(false);

  // Single Add Lead Form
  const [addForm, setAddForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    source: 'Website',
    assignedToId: '',
    company: '',
    jobTitle: '',
  });
  const [addingLead, setAddingLead] = useState(false);

  // Bulk Upload state
  const [bulkText, setBulkText] = useState('');
  const [bulkUploading, setBulkUploading] = useState(false);

  // Audio Player in Activity
  const [playingCallId, setPlayingCallId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Load leads list
  const loadLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (stageFilter !== 'all') params.set('stage', stageFilter);
      if (agentFilter !== 'all') params.set('assignedToId', agentFilter);
      params.set('limit', '100');

      const [leadsData, teamData] = await Promise.all([
        fetchWithAuth(`/leads?${params}`),
        fetchWithAuth('/team'),
      ]);
      setLeads(leadsData?.leads || []);
      setTotal(leadsData?.pagination?.total || 0);
      const members = Array.isArray(teamData) ? teamData : teamData?.members || [];
      setTeam(members);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, agentFilter]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle URL action parameters (e.g. ?action=add-single)
  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'add-single') setShowAddDrawer(true);
    if (action === 'bulk-upload') setShowBulkModal(true);
  }, [searchParams]);

  // Load Lead Detail for Slide-Over Drawer
  const openLeadDetail = async (lead: Lead) => {
    setSelectedLead(lead);
    setLoadingDetail(true);
    setShowNoteInput(false);
    try {
      const [data, followupsData] = await Promise.all([
        fetchWithAuth(`/leads/${lead.id}`),
        fetchWithAuth(`/followups?search=${encodeURIComponent(lead.phone)}&status=open`),
      ]);
      if (data?.lead) {
        setSelectedLead(data.lead);
        setDetailTimeline(data.timeline || []);
      }
      if (followupsData?.items) {
        setLeadFollowups(followupsData.items);
      }
    } catch (err: any) {
      setToast({ message: 'Failed to load lead timeline', type: 'error' });
    } finally {
      setLoadingDetail(false);
    }
  };

  const updateStage = async (leadId: string, stage: Stage) => {
    try {
      await fetchWithAuth(`/leads/${leadId}/stage`, {
        method: 'PATCH',
        body: JSON.stringify({ stage }),
      });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, stage });
      }
      setToast({ message: 'Lead stage updated', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const updateOwner = async (leadId: string, assignedToId: string) => {
    try {
      const updated = await fetchWithAuth(`/leads/${leadId}`, {
        method: 'PATCH',
        body: JSON.stringify({ assignedToId }),
      });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, ...updated } : l)));
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead({ ...selectedLead, ...updated });
      }
      setToast({ message: 'Lead owner updated', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Remote Call Web-to-Phone
  const triggerRemoteDial = async (phoneNumber: string, name?: string | null) => {
    if (!phoneNumber) {
      setToast({ message: 'Lead has no phone number to dial', type: 'error' });
      return;
    }
    try {
      await fetchWithAuth('/calls/dial-request', {
        method: 'POST',
        body: JSON.stringify({
          phoneNumber,
          targetUserId: selectedLead?.assignedTo?.id,
        }),
      });
      setToast({
        message: `📞 Dial command sent to your phone for ${name || phoneNumber}!`,
        type: 'success',
      });
    } catch (err: any) {
      setToast({ message: err?.message || 'Unable to trigger remote call.', type: 'error' });
    }
  };

  // Create Single Lead
  const handleAddLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.phone) return;
    setAddingLead(true);
    try {
      await fetchWithAuth('/leads', {
        method: 'POST',
        body: JSON.stringify(addForm),
      });
      setShowAddDrawer(false);
      setAddForm({ fullName: '', email: '', phone: '', source: 'Website', assignedToId: '', company: '', jobTitle: '' });
      setToast({ message: 'Lead created successfully!', type: 'success' });
      loadLeads();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setAddingLead(false);
    }
  };

  // Bulk Upload (CSV / Lines)
  const handleBulkUpload = async () => {
    if (!bulkText.trim()) return;
    setBulkUploading(true);
    try {
      const lines = bulkText.split('\n').filter(Boolean);
      const items = lines.map((line) => {
        const parts = line.split(',').map((p) => p.trim());
        return {
          fullName: parts[0] || null,
          phone: parts[1] || parts[0] || '',
          email: parts[2] || null,
          company: parts[3] || null,
        };
      });

      const res = await fetchWithAuth('/leads/bulk-upload', {
        method: 'POST',
        body: JSON.stringify({ leads: items }),
      });
      if (res?.count) {
        setToast({ message: `Imported ${res.count} leads successfully!`, type: 'success' });
        setShowBulkModal(false);
        setBulkText('');
        loadLeads();
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Bulk upload failed', type: 'error' });
    } finally {
      setBulkUploading(false);
    }
  };

  // Add Note to Selected Lead
  const handleAddNote = async () => {
    if (!noteText.trim() || !selectedLead) return;
    setSavingNote(true);
    try {
      const res = await fetchWithAuth(`/leads/${selectedLead.id}/notes`, {
        method: 'POST',
        body: JSON.stringify({ content: noteText }),
      });
      setNoteText('');
      setShowNoteInput(false);
      setToast({ message: 'Note saved!', type: 'success' });
      openLeadDetail(selectedLead);
    } catch (err: any) {
      setToast({ message: 'Failed to add note', type: 'error' });
    } finally {
      setSavingNote(false);
    }
  };

  // Open Follow-up Modal for Selected Lead
  const openFollowupForLead = (defaultType: 'CALL' | 'TODO' | 'MEETING' = 'CALL') => {
    if (!selectedLead) return;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(10, 0, 0, 0);
    const localIso = new Date(tomorrow.getTime() - tomorrow.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);

    setFollowupForm({
      type: defaultType,
      title:
        defaultType === 'CALL'
          ? `Follow-up call with ${selectedLead.fullName || 'Lead'}`
          : defaultType === 'TODO'
          ? `To-Do for ${selectedLead.fullName || 'Lead'}`
          : `Meeting with ${selectedLead.fullName || 'Lead'}`,
      scheduledAt: localIso,
      note: '',
      priority: 'NORMAL',
    });
    setShowFollowupModal(true);
  };

  // Save Follow-up for Selected Lead
  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead) return;
    setSavingFollowup(true);
    try {
      await fetchWithAuth('/followups', {
        method: 'POST',
        body: JSON.stringify({
          leadId: selectedLead.id,
          ...followupForm,
        }),
      });
      setToast({ message: 'Follow-up scheduled successfully!', type: 'success' });
      setShowFollowupModal(false);
      openLeadDetail(selectedLead);
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to schedule follow-up', type: 'error' });
    } finally {
      setSavingFollowup(false);
    }
  };

  // Complete a Follow-up from within Lead Drawer
  const handleCompleteLeadFollowup = async (followupId: string) => {
    try {
      await fetchWithAuth(`/followups/${followupId}/complete`, { method: 'PATCH' });
      setToast({ message: 'Task marked as completed!', type: 'success' });
      if (selectedLead) openLeadDetail(selectedLead);
    } catch (err: any) {
      setToast({ message: err?.message || 'Failed to complete task', type: 'error' });
    }
  };

  // Audio Playback Handler
  const togglePlayAudio = (callId: string, audioPath?: string) => {
    if (playingCallId === callId) {
      audioRef.current?.pause();
      setPlayingCallId(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = `/api/v1/calls/${callId}/audio`;
        audioRef.current.play();
        setPlayingCallId(callId);
      }
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <audio ref={audioRef} onEnded={() => setPlayingCallId(null)} className="hidden" />
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Top Header Bar matching Screenshot 4 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold text-slate-900">All Leads</h1>
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
              {total}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Bulk Upload</span>
          </button>

          <button
            onClick={() => setShowAddDrawer(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Search & Action Filters Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, email, company, phone or lead ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && loadLeads()}
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white placeholder:text-slate-400 transition"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* Stage Filter */}
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All Stages</option>
            {STAGES.map((s) => (
              <option key={s} value={s}>
                {STAGE_COLORS[s].label}
              </option>
            ))}
          </select>

          {/* Refresh Button */}
          <button
            onClick={loadLeads}
            className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* All Leads Table matching Screenshot 4 */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4 w-10">
                  <input type="checkbox" className="rounded text-blue-600 border-slate-300" />
                </th>
                <th className="py-3 px-4">Name ⇅</th>
                <th className="py-3 px-4">Lead Owner ⇅</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Phone</th>
                <th className="py-3 px-4">Stage ⇅</th>
                <th className="py-3 px-4">Lead Source</th>
                <th className="py-3 px-4">Created ↓</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td colSpan={9} className="py-4 px-4">
                      <div className="h-4 bg-slate-100 rounded-md w-full" />
                    </td>
                  </tr>
                ))
              ) : leads.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                    <p className="font-semibold text-slate-600">No leads found</p>
                    <p className="text-[11px] mt-0.5">Add a lead or upload a CSV to get started.</p>
                  </td>
                </tr>
              ) : (
                leads.map((lead) => {
                  const stageInfo = STAGE_COLORS[lead.stage] || STAGE_COLORS.NEW;
                  return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDetail(lead)}
                      className="hover:bg-slate-50/80 cursor-pointer transition select-none group"
                    >
                      <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" className="rounded text-blue-600 border-slate-300" />
                      </td>

                      <td className="py-3.5 px-4 font-bold text-slate-900 group-hover:text-blue-600 transition">
                        {lead.fullName || 'Unnamed Lead'}
                      </td>

                      <td className="py-3.5 px-4">
                        {lead.assignedTo ? (
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">
                              {lead.assignedTo.name[0]}
                            </div>
                            <span className="font-medium text-slate-700">{lead.assignedTo.name}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 font-mono text-[11px]">
                        {lead.email || '—'}
                      </td>

                      <td className="py-3.5 px-4 text-slate-800 font-mono text-[11px] font-semibold">
                        {lead.phone}
                      </td>

                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${stageInfo.badge}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${stageInfo.dot}`} />
                          <span>{stageInfo.label}</span>
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-600 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span>{lead.source}</span>
                      </td>

                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {new Date(lead.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => triggerRemoteDial(lead.phone, lead.fullName)}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg text-[11px] font-semibold transition"
                            title="Call on Phone"
                          >
                            <Smartphone className="w-3 h-3 text-blue-600" />
                            <span>Call</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Pagination */}
        <div className="py-3 px-6 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing 1-{leads.length} of {total} leads
          </span>
          <div className="flex items-center gap-2">
            <button className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40" disabled>
              ‹ Prev
            </button>
            <span className="font-semibold text-slate-700">Page 1 of 1</span>
            <button className="px-2.5 py-1 rounded-lg border border-slate-200 disabled:opacity-40" disabled>
              Next ›
            </button>
          </div>
        </div>
      </div>

      {/* ─── SLIDE-OVER DRAWER 1: ADD SINGLE LEAD matching Screenshot 3 ─── */}
      {showAddDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">+ Add Lead</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Add a lead directly to your CRM. No form submission required.
                </p>
              </div>
              <button
                onClick={() => setShowAddDrawer(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddLead} className="p-5 flex-1 overflow-y-auto space-y-4">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Fields</div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  placeholder="Lead's full name (extracted from form fields)"
                  value={addForm.fullName}
                  onChange={(e) => setAddForm({ ...addForm, fullName: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Email</label>
                <input
                  type="email"
                  placeholder="Primary contact email"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Primary Phone *</label>
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 px-2.5 py-2 border border-slate-200 bg-slate-50 rounded-xl text-xs font-medium text-slate-600">
                    🇮🇳 +91
                  </span>
                  <input
                    type="tel"
                    required
                    placeholder="Primary contact phone"
                    value={addForm.phone}
                    onChange={(e) => setAddForm({ ...addForm, phone: e.target.value })}
                    className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Lead Source</label>
                <select
                  value={addForm.source}
                  onChange={(e) => setAddForm({ ...addForm, source: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assign to (optional)</label>
                <select
                  value={addForm.assignedToId}
                  onChange={(e) => setAddForm({ ...addForm, assignedToId: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  <option value="">Auto-assign round robin</option>
                  {team.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    placeholder="Acme Inc."
                    value={addForm.company}
                    onChange={(e) => setAddForm({ ...addForm, company: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="Managing Director"
                    value={addForm.jobTitle}
                    onChange={(e) => setAddForm({ ...addForm, jobTitle: e.target.value })}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-6 border-t border-slate-200 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAddDrawer(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingLead}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  {addingLead && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>+ Add Lead</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL: BULK UPLOAD (CSV / XLSX) ─── */}
      {showBulkModal && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <h3 className="text-base font-bold text-slate-900">Bulk Upload Leads</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <p className="text-xs text-slate-500">
                Paste your CSV lines or contacts below (Format: <code>Name, Phone, Email, Company</code>):
              </p>
              <textarea
                rows={6}
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="Rahul Sharma, 9876543210, rahul@example.com, Tata Group&#10;Priya Sen, 8765432109, priya@gmail.com, Infosys"
                className="w-full p-3 text-xs font-mono border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleBulkUpload}
                  disabled={bulkUploading || !bulkText.trim()}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  {bulkUploading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Import Leads</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── SLIDE-OVER DRAWER 2: LEAD DETAIL INSPECTION PANEL matching Screenshot 5 ─── */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Top Toolbar matching Screenshot 5 */}
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <button className="p-1 rounded text-slate-400 hover:text-slate-700">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button className="p-1 rounded text-slate-400 hover:text-slate-700">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => openLeadDetail(selectedLead)}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingDetail ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={async () => {
                    if (confirm('Delete this lead?')) {
                      await fetchWithAuth(`/leads/${selectedLead.id}`, { method: 'DELETE' });
                      setSelectedLead(null);
                      loadLeads();
                      setToast({ message: 'Lead deleted', type: 'info' });
                    }
                  }}
                  className="text-xs font-medium text-rose-600 hover:text-rose-700 flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>

                <button
                  onClick={() => setSelectedLead(null)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Lead Name & Status Header */}
            <div className="p-6 border-b border-slate-100 bg-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-slate-900">{selectedLead.fullName || 'Unnamed Lead'}</h2>

                  {/* Stage & Owner Pickers */}
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {/* Stage Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedLead.stage}
                        onChange={(e) => updateStage(selectedLead.id, e.target.value as Stage)}
                        className={`appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-bold border cursor-pointer focus:outline-none ${
                          STAGE_COLORS[selectedLead.stage]?.badge || 'bg-slate-100'
                        }`}
                      >
                        {STAGES.map((s) => (
                          <option key={s} value={s}>
                            ● {STAGE_COLORS[s].label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2 pointer-events-none opacity-60" />
                    </div>

                    {/* Owner Dropdown */}
                    <div className="relative">
                      <select
                        value={selectedLead.assignedTo?.id || ''}
                        onChange={(e) => updateOwner(selectedLead.id, e.target.value)}
                        className="appearance-none pl-3 pr-7 py-1 rounded-full text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700 cursor-pointer focus:outline-none"
                      >
                        <option value="">Unassigned</option>
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="w-3 h-3 absolute right-2 top-2 pointer-events-none text-slate-400" />
                    </div>
                  </div>
                </div>

                {/* KPI counter badges matching Screenshot 10 */}
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => openFollowupForLead('CALL')}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Follow-up</span>
                  </button>

                  <button
                    onClick={() => setDetailTab('calls')}
                    className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1 transition"
                  >
                    <Phone className="w-3 h-3 text-slate-500" />
                    <span>{(selectedLead._count?.calls ?? selectedLead.calls?.length ?? 0)} calls</span>
                  </button>
                </div>
              </div>

              {/* Collapsible LEAD DETAILS Card */}
              <div className="mt-5 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  <span>Lead Details</span>
                  <button
                    onClick={() => setHideEmptyDetails(!hideEmptyDetails)}
                    className="text-blue-600 hover:underline capitalize font-semibold"
                  >
                    {hideEmptyDetails ? 'Show all' : 'Hide empty'}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Phone</span>
                    <span className="font-bold text-slate-800 font-mono">🇮🇳 {selectedLead.phone}</span>
                  </div>

                  {(!hideEmptyDetails || selectedLead.email) && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Email</span>
                      <span className="font-medium text-slate-700 font-mono">{selectedLead.email || '—'}</span>
                    </div>
                  )}

                  {(!hideEmptyDetails || selectedLead.company) && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Company</span>
                      <span className="font-medium text-slate-700">{selectedLead.company || '—'}</span>
                    </div>
                  )}

                  {(!hideEmptyDetails || selectedLead.jobTitle) && (
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">Job Title</span>
                      <span className="font-medium text-slate-700">{selectedLead.jobTitle || '—'}</span>
                    </div>
                  )}

                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold block uppercase">Lead Source</span>
                    <span className="font-semibold text-slate-700">{selectedLead.source}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Subtabs matching Screenshot 5 (Activity, Calls, Workflow, Tasks, Revenue) */}
            <div className="border-b border-slate-200 px-6 flex items-center gap-6 text-xs font-bold text-slate-500 bg-white">
              {(['activity', 'calls', 'tasks'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setDetailTab(tab)}
                  className={`py-3 capitalize transition-all border-b-2 ${
                    detailTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab Body: Activity Timeline or Tasks */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 space-y-4">
              {showNoteInput && (
                <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm space-y-2 animate-in fade-in">
                  <h4 className="text-xs font-bold text-slate-800">Add a note for this lead</h4>
                  <textarea
                    rows={3}
                    placeholder="E.g. Discussed proposal, follow up tomorrow at 3pm..."
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    className="w-full p-2.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setShowNoteInput(false)}
                      className="px-3 py-1.5 text-xs text-slate-600 font-semibold hover:bg-slate-50 rounded-lg"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddNote}
                      disabled={savingNote}
                      className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg hover:bg-blue-700"
                    >
                      {savingNote ? 'Saving...' : 'Save Note'}
                    </button>
                  </div>
                </div>
              )}

              {detailTab === 'tasks' ? (
                /* Tasks Tab matching Screenshot 10 */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scheduled Tasks & Follow-ups</h4>
                    <button
                      onClick={() => openFollowupForLead('TODO')}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Task</span>
                    </button>
                  </div>

                  {leadFollowups.length === 0 ? (
                    <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                      No pending tasks or follow-ups for this lead.
                    </div>
                  ) : (
                    leadFollowups.map((f: any) => (
                      <div
                        key={f.id}
                        className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleCompleteLeadFollowup(f.id)}
                            className="w-5 h-5 rounded border border-slate-300 hover:bg-emerald-50 hover:border-emerald-500 text-transparent hover:text-emerald-600 flex items-center justify-center transition"
                            title="Mark as done"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{f.title}</span>
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-50 text-blue-700">
                                {f.type}
                              </span>
                            </div>
                            {f.note && <p className="text-[11px] text-slate-500 mt-0.5">{f.note}</p>}
                            <span className="text-[10px] text-slate-400 font-medium">
                              Due: {new Date(f.scheduledAt).toLocaleString()}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => handleCompleteLeadFollowup(f.id)}
                          className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold"
                        >
                          Complete
                        </button>
                      </div>
                    ))
                  )}
                </div>
              ) : loadingDetail ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                </div>
              ) : detailTimeline.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs">No activity logged yet.</div>
              ) : (
                <div className="space-y-3">
                  {detailTimeline.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs flex items-start gap-3.5"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                        {item.type === 'call_logged' ? (
                          <Phone className="w-4 h-4 text-emerald-600" />
                        ) : item.type === 'note_added' ? (
                          <FileText className="w-4 h-4 text-blue-600" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4 text-slate-600" />
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-bold text-slate-900">{item.title}</h4>
                          <span className="text-[10px] text-slate-400">
                            {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>

                        {item.subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{item.subtitle}</p>}
                        {item.content && (
                          <p className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 mt-2 font-mono">
                            {item.content}
                          </p>
                        )}

                        {/* Call Audio Player */}
                        {item.type === 'call_logged' && item.callId && (
                          <div className="mt-2.5 flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/80">
                            <button
                              onClick={() => togglePlayAudio(item.callId!)}
                              className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition"
                            >
                              {playingCallId === item.callId ? (
                                <Pause className="w-3 h-3" />
                              ) : (
                                <Play className="w-3 h-3 ml-0.5" />
                              )}
                            </button>
                            <span className="text-[11px] font-semibold text-slate-700">
                              {playingCallId === item.callId ? 'Playing call recording...' : 'Listen to call recording'}
                            </span>
                          </div>
                        )}

                        <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400 font-medium">
                          <span>By {item.author}</span>
                          <span>•</span>
                          <span>{item.platform || 'System'}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Sticky Action Bar matching Screenshot 10 */}
            <div className="p-3 border-t border-slate-200 bg-white flex items-center justify-around">
              <button
                onClick={() => triggerRemoteDial(selectedLead.phone, selectedLead.fullName)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-blue-600 hover:bg-blue-50 rounded-xl transition"
              >
                <Smartphone className="w-4 h-4 text-blue-600" />
                <span>Call on Phone</span>
              </button>

              <a
                href={`https://wa.me/${selectedLead.phone.replace(/[^0-9]/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded-xl transition"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600" />
                <span>WhatsApp</span>
              </a>

              <button
                onClick={() => setShowNoteInput(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 rounded-xl transition"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>Note</span>
              </button>

              <button
                onClick={() => openFollowupForLead('TODO')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-purple-600 hover:bg-purple-50 rounded-xl transition"
              >
                <CheckSquare className="w-4 h-4 text-purple-500" />
                <span>To-Do</span>
              </button>

              <button
                onClick={() => openFollowupForLead('CALL')}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-amber-600 hover:bg-amber-50 rounded-xl transition"
              >
                <Clock className="w-4 h-4 text-amber-500" />
                <span>Follow-up</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL: SCHEDULE FOLLOW-UP / TO-DO FOR SELECTED LEAD ─── */}
      {showFollowupModal && selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Schedule {followupForm.type}</h3>
                  <p className="text-[11px] text-slate-500">{selectedLead.fullName || selectedLead.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowFollowupModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveFollowup} className="space-y-4">
              {/* Type Switcher */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Type</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['CALL', 'TODO', 'MEETING'] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setFollowupForm({ ...followupForm, type: t })}
                      className={`py-1.5 px-2 rounded-xl text-xs font-bold border transition text-center ${
                        followupForm.type === t
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
                  required
                  value={followupForm.title}
                  onChange={(e) => setFollowupForm({ ...followupForm, title: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Scheduled Date */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Scheduled Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={followupForm.scheduledAt}
                  onChange={(e) => setFollowupForm({ ...followupForm, scheduledAt: e.target.value })}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Note (Optional)</label>
                <textarea
                  rows={2}
                  value={followupForm.note}
                  onChange={(e) => setFollowupForm({ ...followupForm, note: e.target.value })}
                  placeholder="Key talking points or agenda..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowFollowupModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFollowup}
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition"
                >
                  {savingFollowup ? 'Scheduling...' : 'Save Follow-up'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
