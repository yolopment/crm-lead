'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Search, Plus, Users, Download, ChevronDown, Phone, Mail, Tag, X, Loader2, Edit2 } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { Toast, Badge, TableRowSkeleton } from '@/components/ui';

const STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'] as const;
type Stage = typeof STAGES[number];

const STAGE_COLORS: Record<Stage, 'slate' | 'blue' | 'green' | 'yellow' | 'green' | 'red'> = {
  NEW: 'slate', CONTACTED: 'blue', QUALIFIED: 'green', PROPOSAL_SENT: 'yellow', WON: 'green', LOST: 'red',
};
const STAGE_LABELS: Record<Stage, string> = {
  NEW: 'New', CONTACTED: 'Contacted', QUALIFIED: 'Qualified', PROPOSAL_SENT: 'Proposal Sent', WON: 'Won', LOST: 'Lost',
};

interface Lead {
  id: string;
  fullName: string | null;
  phone: string;
  email: string | null;
  source: string;
  campaignName: string | null;
  stage: Stage;
  tags: string | null;
  createdAt: string;
  assignedTo: { id: string; name: string; email: string } | null;
  _count: { calls: number; notes: number };
}

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('all');
  const [total, setTotal] = useState(0);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ fullName: '', phone: '', email: '', source: 'manual', tags: '' });
  const [createLoading, setCreateLoading] = useState(false);
  const [updatingLeadId, setUpdatingLeadId] = useState<string | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', phone: '', email: '', tags: '' });
  const [editLoading, setEditLoading] = useState(false);

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
      const members = Array.isArray(teamData) ? teamData : (teamData?.members || []);
      setTeam(members);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [search, stageFilter, agentFilter]);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  const updateStage = async (leadId: string, stage: Stage) => {
    setUpdatingLeadId(leadId);
    try {
      await fetchWithAuth(`/leads/${leadId}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) });
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, stage } : l));
      setToast({ message: 'Lead stage updated', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setUpdatingLeadId(null);
    }
  };

  const handleSaveLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editLead) return;
    setEditLoading(true);
    try {
      const updated = await fetchWithAuth(`/leads/${editLead.id}`, {
        method: 'PATCH',
        body: JSON.stringify(editForm),
      });
      setLeads(prev => prev.map(l => l.id === editLead.id ? { ...l, ...updated } : l));
      setToast({ message: 'Lead updated successfully!', type: 'success' });
      setEditLead(null);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setEditLoading(false);
    }
  };

  const createLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.phone) return;
    setCreateLoading(true);
    try {
      await fetchWithAuth('/leads', { method: 'POST', body: JSON.stringify(createForm) });
      setShowCreateModal(false);
      setCreateForm({ fullName: '', phone: '', email: '', source: 'manual', tags: '' });
      setToast({ message: 'Lead created & assigned to available agent', type: 'success' });
      loadLeads();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setCreateLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Name', 'Phone', 'Email', 'Source', 'Stage', 'Campaign', 'Tags', 'Assigned To', 'Calls', 'Created'];
    const rows = leads.map(l => [
      l.fullName || '', l.phone, l.email || '', l.source, l.stage,
      l.campaignName || '', l.tags || '', l.assignedTo?.name || '',
      l._count.calls, new Date(l.createdAt).toLocaleDateString('en-IN'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `leads-${Date.now()}.csv`;
    a.click();
  };

  // Stage counts for summary cards
  const stageCounts = STAGES.reduce((acc, s) => ({ ...acc, [s]: leads.filter(l => l.stage === s).length }), {} as Record<Stage, number>);

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Leads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {loading ? '...' : `${total} leads total`} · distributed via round-robin to available agents
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-50">
            <Download className="w-3.5 h-3.5" /><span>Export</span>
          </button>
          <button onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm">
            <Plus className="w-3.5 h-3.5" /><span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Stage Pipeline Summary Cards */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {STAGES.map(stage => (
          <button key={stage} onClick={() => setStageFilter(stageFilter === stage ? 'all' : stage)}
            className={`bg-white border rounded-xl p-3 text-center shadow-sm hover:shadow transition cursor-pointer ${
              stageFilter === stage ? 'border-blue-400 ring-1 ring-blue-400' : 'border-slate-200'
            }`}>
            <div className="text-xl font-extrabold text-slate-900">{loading ? '·' : stageCounts[stage]}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mt-1">{STAGE_LABELS[stage]}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input type="text" placeholder="Search by name, phone, email..." value={search}
            onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadLeads()}
            className="w-full pl-9 pr-4 py-1.5 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400" />
        </div>

        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Stages</option>
          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
        </select>

        <select value={agentFilter} onChange={e => setAgentFilter(e.target.value)}
          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="all">All Agents</option>
          {(Array.isArray(team) ? team : []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>

      {/* Leads Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto" role="region" aria-labelledby="leads-table-caption" tabIndex={0}>
          <table className="w-full text-left text-sm">
            <caption id="leads-table-caption" className="sr-only">Lead management table</caption>
            <thead className="bg-slate-50/75 text-[11px] font-bold uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th scope="col" className="py-3 px-6">Lead</th>
                <th scope="col" className="py-3 px-6">Source</th>
                <th scope="col" className="py-3 px-6">Stage</th>
                <th scope="col" className="py-3 px-6">Assigned To</th>
                <th scope="col" className="py-3 px-6">Tags</th>
                <th scope="col" className="py-3 px-6">Calls</th>
                <th scope="col" className="py-3 px-6">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? [1,2,3,4,5].map(i => <TableRowSkeleton key={i} cols={7} />)
                : leads.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-400 font-medium">No leads found</p>
                      <p className="text-xs text-slate-300 mt-1">Create a lead manually or connect Meta Ads webhook</p>
                    </td>
                  </tr>
                ) : leads.map(lead => (
                  <tr key={lead.id} className="hover:bg-slate-50/50 transition">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <div className="font-semibold text-slate-900">{lead.fullName || 'Unknown'}</div>
                        <button
                          onClick={() => {
                            setEditLead(lead);
                            setEditForm({
                              fullName: lead.fullName || '',
                              phone: lead.phone,
                              email: lead.email || '',
                              tags: lead.tags || '',
                            });
                          }}
                          className="text-slate-400 hover:text-blue-600 p-0.5 rounded transition"
                          title="Edit Lead Details"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{lead.phone}</span>
                        {lead.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{lead.email}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-xs capitalize text-slate-600 font-medium bg-slate-100 px-2 py-0.5 rounded">
                        {lead.source.replace('_', ' ')}
                      </span>
                      {lead.campaignName && (
                        <div className="text-[10px] text-slate-400 mt-1 max-w-[120px] truncate">{lead.campaignName}</div>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="relative inline-block">
                        <select
                          value={lead.stage}
                          onChange={e => updateStage(lead.id, e.target.value as Stage)}
                          disabled={updatingLeadId === lead.id}
                          className="appearance-none pr-6 pl-2 py-1 rounded-lg text-xs font-semibold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-60 bg-white"
                        >
                          {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                        </select>
                        {updatingLeadId === lead.id
                          ? <Loader2 className="w-3 h-3 absolute right-1.5 top-1.5 animate-spin text-slate-400" />
                          : <ChevronDown className="w-3 h-3 absolute right-1.5 top-1.5 text-slate-400 pointer-events-none" />
                        }
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {lead.assignedTo ? (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[10px] font-bold">
                            {lead.assignedTo.name.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                          </div>
                          <span className="text-xs font-medium text-slate-700">{lead.assignedTo.name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">Unassigned</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.split(',').filter(Boolean).map(tag => (
                          <span key={tag} className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">{tag.trim()}</span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm font-semibold text-slate-700">{lead._count.calls}</span>
                      <span className="text-xs text-slate-400 ml-1">calls</span>
                    </td>
                    <td className="py-4 px-6 text-xs text-slate-500">
                      {new Date(lead.createdAt).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Lead Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowCreateModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-900">Create New Lead</h3>
                <p className="text-xs text-slate-400 mt-0.5">Will be auto-assigned to next available agent</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={createLead} className="space-y-4">
              {[
                { label: 'Full Name', name: 'fullName', type: 'text', placeholder: 'Rahul Sharma', required: false },
                { label: 'Phone Number *', name: 'phone', type: 'tel', placeholder: '+919XXXXXXXXX', required: true },
                { label: 'Email', name: 'email', type: 'email', placeholder: 'rahul@email.com', required: false },
                { label: 'Tags', name: 'tags', type: 'text', placeholder: 'hot, interested, callback', required: false },
              ].map(field => (
                <div key={field.name}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{field.label}</label>
                  <input type={field.type} required={field.required}
                    value={(createForm as any)[field.name]}
                    onChange={e => setCreateForm({ ...createForm, [field.name]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Source</label>
                <select value={createForm.source} onChange={e => setCreateForm({ ...createForm, source: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="manual">Manual Entry</option>
                  <option value="meta_ads">Meta / Facebook Ads</option>
                  <option value="google_ads">Google Ads</option>
                  <option value="website">Website / Landing Page</option>
                  <option value="inbound_call">Inbound Call</option>
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={createLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
                  {createLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {createLoading ? 'Creating...' : 'Create Lead'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Lead Modal */}
      {editLead && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setEditLead(null)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-900">Edit Lead</h3>
                <p className="text-xs text-slate-400 mt-0.5">Update saved name, phone or contact details</p>
              </div>
              <button onClick={() => setEditLead(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLead} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.fullName}
                  onChange={e => setEditForm({ ...editForm, fullName: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={e => setEditForm({ ...editForm, phone: e.target.value })}
                  placeholder="+919XXXXXXXXX"
                  required
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={e => setEditForm({ ...editForm, email: e.target.value })}
                  placeholder="rahul@example.com"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tags</label>
                <input
                  type="text"
                  value={editForm.tags}
                  onChange={e => setEditForm({ ...editForm, tags: e.target.value })}
                  placeholder="hot, interested, VIP"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditLead(null)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5"
                >
                  {editLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {editLoading ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

