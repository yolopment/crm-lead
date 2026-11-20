'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FileText,
  Plus,
  Search,
  Code,
  Edit2,
  Trash2,
  Copy,
  Check,
  ExternalLink,
  Users,
  CheckCircle2,
  Download,
  Filter,
  MoreVertical,
  Loader2,
  X,
  Layers,
  ArrowUpDown,
  Phone,
  Calendar,
  Clock,
  Eye,
  Play,
  Pause,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

interface FormItem {
  id: string;
  name: string;
  description?: string | null;
  formCode?: string | null;
  slug: string;
  status: string;
  fieldsJson: string;
  sectionsCount: number;
  submissionsCount: number;
  createdByName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function FormsPage() {
  const router = useRouter();
  const [forms, setForms] = useState<FormItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [selectedEmbedForm, setSelectedEmbedForm] = useState<FormItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Submissions drawer state
  const [submissionsForm, setSubmissionsForm] = useState<FormItem | null>(null);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const loadForms = async () => {
    setLoading(true);
    try {
      const data = await fetchWithAuth('/forms');
      setForms(data?.forms || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadForms();
  }, []);

  const openSubmissions = async (form: FormItem) => {
    setSubmissionsForm(form);
    setLoadingSubmissions(true);
    setActiveMenuId(null);
    try {
      const res = await fetchWithAuth(`/forms/${form.id}/submissions`);
      setSubmissions(res?.submissions || []);
    } catch (err) {
      console.error('Failed to load submissions', err);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const handleDuplicateForm = async (form: FormItem) => {
    setActiveMenuId(null);
    try {
      await fetchWithAuth(`/forms/${form.id}/duplicate`, { method: 'POST' });
      loadForms();
    } catch (err) {
      console.error('Failed to duplicate form', err);
      alert('Could not duplicate form.');
    }
  };

  const handleToggleStatus = async (form: FormItem) => {
    setActiveMenuId(null);
    try {
      await fetchWithAuth(`/forms/${form.id}/status`, { method: 'PATCH' });
      loadForms();
    } catch (err) {
      console.error('Failed to toggle form status', err);
    }
  };

  const getEmbedCode = (slug: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    return `<!-- Lead CRM Embeddable Form Widget -->
<div id="lead-crm-form-${slug}"></div>
<script>
  (function() {
    var iframe = document.createElement('iframe');
    iframe.src = '${origin}/forms/${slug}';
    iframe.style.width = '100%';
    iframe.style.height = '540px';
    iframe.style.border = 'none';
    iframe.style.borderRadius = '16px';
    document.getElementById('lead-crm-form-${slug}').appendChild(iframe);
  })();
</script>`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteForm = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete form "${name}"?`)) return;
    try {
      await fetchWithAuth(`/forms/${id}`, { method: 'DELETE' });
      loadForms();
    } catch (err) {
      console.error('Failed to delete form', err);
    }
  };

  const filteredForms = forms.filter((f) => {
    const q = search.toLowerCase();
    const matchesSearch =
      f.name.toLowerCase().includes(q) ||
      (f.description && f.description.toLowerCase().includes(q)) ||
      (f.formCode && f.formCode.toLowerCase().includes(q)) ||
      f.slug.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'ALL' ? true : f.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)} minutes ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`;
    return `${Math.floor(diff / 86400)} days ago`;
  };

  const exportCSV = () => {
    const header = ['Form Name', 'Code', 'Status', 'Fields', 'Sections', 'Leads', 'Created', 'Author'];
    const rows = forms.map((f) => {
      let fieldsCount = 0;
      try {
        const parsed = JSON.parse(f.fieldsJson);
        fieldsCount = Array.isArray(parsed) ? (parsed[0]?.fields ? parsed.reduce((a: any, s: any) => a + s.fields.length, 0) : parsed.length) : 3;
      } catch {
        fieldsCount = 3;
      }
      return [
        `"${f.name}"`,
        `"${f.formCode || ''}"`,
        `"${f.status}"`,
        fieldsCount,
        f.sectionsCount,
        f.submissionsCount,
        `"${new Date(f.createdAt).toLocaleDateString()}"`,
        `"${f.createdByName || 'Aftab Sk'}"`,
      ];
    });
    const csvContent = 'data:text/csv;charset=utf-8,' + [header.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'crm_forms_export.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* ─── HEADER matching Screenshot 1 ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center shadow-xs">
            <FileText className="w-5 h-5 stroke-[2.2]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Forms</h1>
            <p className="text-xs text-slate-500 mt-0.5">Build, share, and manage lead capture forms.</p>
          </div>
        </div>

        <Link
          href="/dashboard/forms/builder"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Create Form</span>
        </Link>
      </div>

      {/* ─── SEARCH & FILTER BAR matching Screenshot 1 ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search forms..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
            />
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-xl text-xs">
            <button
              onClick={() => setStatusFilter('ALL')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                statusFilter === 'ALL' ? 'bg-white shadow-2xs text-blue-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('ACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                statusFilter === 'ACTIVE' ? 'bg-white shadow-2xs text-emerald-600 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('INACTIVE')}
              className={`px-2.5 py-1 rounded-lg font-medium transition ${
                statusFilter === 'INACTIVE' ? 'bg-white shadow-2xs text-slate-700 font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Paused
            </button>
          </div>
        </div>

        <button
          onClick={exportCSV}
          className="px-3.5 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
        >
          <Download className="w-3.5 h-3.5 text-slate-400" />
          <span>Export</span>
        </button>
      </div>

      {/* ─── DATA TABLE matching Screenshot 1 ─── */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/70 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider select-none">
              <tr>
                <th className="py-3 px-5">FORM NAME ⇅</th>
                <th className="py-3 px-4">Status ⇅</th>
                <th className="py-3 px-4">Fields ⇅</th>
                <th className="py-3 px-4">Sections ⇅</th>
                <th className="py-3 px-4">Leads ⇅</th>
                <th className="py-3 px-4">Created ⇅</th>
                <th className="py-3 px-4">ACTIVITY</th>
                <th className="py-3 px-5 text-right">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto text-blue-600 mb-2" />
                    <span>Loading forms...</span>
                  </td>
                </tr>
              ) : filteredForms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-slate-400">
                    <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    <p className="font-bold text-slate-700 text-sm">No forms found</p>
                    <p className="text-xs text-slate-400 mt-1">Get started by creating your first lead capture form.</p>
                    <Link
                      href="/dashboard/forms/builder"
                      className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Create Form</span>
                    </Link>
                  </td>
                </tr>
              ) : (
                filteredForms.map((form) => {
                  let fieldsCount = 3;
                  try {
                    const parsed = JSON.parse(form.fieldsJson);
                    if (Array.isArray(parsed)) {
                      if (parsed[0]?.fields) {
                        fieldsCount = parsed.reduce((a: any, s: any) => a + s.fields.length, 0);
                      } else {
                        fieldsCount = parsed.length;
                      }
                    }
                  } catch {
                    fieldsCount = 3;
                  }

                  const isActive = form.status === 'ACTIVE';

                  return (
                    <tr key={form.id} className="hover:bg-slate-50/70 transition group">
                      {/* FORM NAME + BADGE + DESCRIPTION */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100/60 flex items-center justify-center font-bold shrink-0">
                            <FileText className="w-4 h-4 stroke-[2.2]" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link
                                href={`/dashboard/forms/builder?id=${form.id}`}
                                className="font-bold text-slate-900 hover:text-blue-600 transition"
                              >
                                {form.name}
                              </Link>
                              {form.formCode && (
                                <span className="text-[10px] font-mono bg-slate-100 text-slate-600 font-semibold px-1.5 py-0.5 rounded-md border border-slate-200/60">
                                  {form.formCode}
                                </span>
                              )}
                            </div>
                            {form.description && (
                              <p className="text-[11px] text-slate-400 font-semibold tracking-wider uppercase mt-0.5">
                                {form.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => handleToggleStatus(form)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isActive ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'
                            }`}
                          />
                          <span>{isActive ? 'Active' : 'Paused'}</span>
                        </button>
                      </td>

                      {/* Fields */}
                      <td className="py-4 px-4 font-semibold text-slate-700">{fieldsCount}</td>

                      {/* Sections */}
                      <td className="py-4 px-4 font-semibold text-slate-700">{form.sectionsCount || 1}</td>

                      {/* Leads (clickable to open submissions) */}
                      <td className="py-4 px-4">
                        <button
                          onClick={() => openSubmissions(form)}
                          className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1"
                          title="Click to view captured leads"
                        >
                          <span>{form.submissionsCount || 0}</span>
                          <Eye className="w-3 h-3 text-slate-400 group-hover:text-blue-600" />
                        </button>
                      </td>

                      {/* Created */}
                      <td className="py-4 px-4 text-slate-600 text-xs font-medium">
                        {new Date(form.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Activity */}
                      <td className="py-4 px-4 text-slate-500 text-xs">
                        Created by {form.createdByName || 'Aftab Sk'} • {timeAgo(form.createdAt)}
                      </td>

                      {/* Actions matching Screenshot 1 */}
                      <td className="py-4 px-5 text-right relative">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Pencil Icon */}
                          <Link
                            href={`/dashboard/forms/builder?id=${form.id}`}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
                            title="Edit in Form Builder"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>

                          {/* Embed Code Icon <> */}
                          <button
                            onClick={() => setSelectedEmbedForm(form)}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-blue-600 hover:bg-blue-50 hover:border-blue-200 transition"
                            title="Get Embed Code"
                          >
                            <Code className="w-3.5 h-3.5" />
                          </button>

                          {/* More Options ⋮ */}
                          <div className="relative">
                            <button
                              onClick={() => setActiveMenuId(activeMenuId === form.id ? null : form.id)}
                              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                            >
                              <MoreVertical className="w-3.5 h-3.5" />
                            </button>

                            {activeMenuId === form.id && (
                              <div className="absolute right-0 top-8 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in zoom-in-95 duration-100">
                                <Link
                                  href={`/dashboard/forms/builder?id=${form.id}`}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Edit Form</span>
                                </Link>
                                <a
                                  href={`/forms/${form.slug}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Open Public Form</span>
                                </a>
                                <button
                                  onClick={() => openSubmissions(form)}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Users className="w-3.5 h-3.5 text-slate-400" />
                                  <span>View Leads ({form.submissionsCount || 0})</span>
                                </button>
                                <button
                                  onClick={() => setSelectedEmbedForm(form)}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Code className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Embed Code</span>
                                </button>
                                <button
                                  onClick={() => handleDuplicateForm(form)}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Duplicate Form</span>
                                </button>
                                <button
                                  onClick={() => handleToggleStatus(form)}
                                  className="w-full px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                                >
                                  {isActive ? (
                                    <>
                                      <Pause className="w-3.5 h-3.5 text-amber-500" />
                                      <span>Pause Form</span>
                                    </>
                                  ) : (
                                    <>
                                      <Play className="w-3.5 h-3.5 text-emerald-500" />
                                      <span>Activate Form</span>
                                    </>
                                  )}
                                </button>
                                <hr className="my-1 border-slate-100" />
                                <button
                                  onClick={() => handleDeleteForm(form.id, form.name)}
                                  className="w-full px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Form</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── SUBMISSIONS DRAWER ─── */}
      {submissionsForm && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Submissions: {submissionsForm.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {submissions.length} leads captured from this form
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSubmissionsForm(null)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Submissions List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingSubmissions ? (
                <div className="py-20 text-center text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-blue-600 mb-2" />
                  <span className="text-xs font-medium">Loading form leads...</span>
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-20 text-center text-slate-400 space-y-3">
                  <Users className="w-10 h-10 mx-auto text-slate-300" />
                  <p className="font-bold text-slate-700 text-sm">No leads captured yet</p>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    Share your public form or embed it into your landing page to begin capturing leads.
                  </p>
                  <a
                    href={`/forms/${submissionsForm.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl text-xs font-semibold"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Open Live Form</span>
                  </a>
                </div>
              ) : (
                submissions.map((lead: any) => (
                  <div
                    key={lead.id}
                    className="p-4 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-3 hover:border-slate-300 transition"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-sm font-bold text-slate-900">
                          {lead.fullName || 'Anonymous Lead'}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-600 font-medium">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          <span>{lead.phone}</span>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {lead.stageName || 'Fresh'}
                      </span>
                    </div>

                    {lead.email && (
                      <div className="text-xs text-slate-500">
                        Email: <span className="font-medium text-slate-700">{lead.email}</span>
                      </div>
                    )}

                    {lead.customFields && (
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Form Responses
                        </span>
                        <pre className="text-[11px] whitespace-pre-wrap font-sans text-slate-700">
                          {lead.customFields}
                        </pre>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(lead.createdAt).toLocaleString()}</span>
                      </div>
                      {lead.assignedTo && (
                        <span className="text-blue-600 font-medium">
                          Assigned: {lead.assignedTo.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <Link
                href="/dashboard/leads"
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1.5"
              >
                <span>View All Leads in CRM</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                type="button"
                onClick={() => setSubmissionsForm(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── EMBED CODE MODAL ─── */}
      {selectedEmbedForm && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-white rounded-3xl shadow-2xl p-6 border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Code className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Embed Form: {selectedEmbedForm.name}</h3>
                  <p className="text-xs text-slate-500">
                    Copy and paste this snippet onto your website or landing page.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedEmbedForm(null)}
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <pre className="p-4 bg-slate-900 text-slate-100 rounded-2xl text-[11px] font-mono overflow-x-auto border border-slate-800 leading-relaxed">
                  {getEmbedCode(selectedEmbedForm.slug)}
                </pre>
                <button
                  onClick={() => copyToClipboard(getEmbedCode(selectedEmbedForm.slug))}
                  className="absolute top-3 right-3 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied!' : 'Copy Code'}</span>
                </button>
              </div>

              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-start gap-2.5 text-xs text-blue-800 font-medium">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <p>
                  Every lead submitting through this form is automatically synced to your CRM, assigned round-robin to your sales agents, and rings on their companion phones.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <Link
                href={`/dashboard/forms/builder?id=${selectedEmbedForm.id}`}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                <span>Open in Form Builder</span>
              </Link>
              <button
                type="button"
                onClick={() => setSelectedEmbedForm(null)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
