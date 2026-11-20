'use client';

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  IndianRupee,
  Calendar,
  Building2,
  FileText,
  CheckCircle2,
  Clock,
  RefreshCw,
  Layers,
  Sparkles,
  Edit2,
  X,
  Check,
  Loader2,
  Users,
  Target,
  HardDrive,
  Plus,
} from 'lucide-react';
import { fetchSaasApi } from '@/lib/saas-api';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxUsers: number;
  maxLeads: number;
  storageQuotaBytes: number;
  _count?: {
    subscriptions: number;
  };
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount?: number;
  totalAmount?: number;
  currency: string;
  status: 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED';
  paidAt?: string | null;
  dueDate?: string | null;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

export default function SuperAdminBillingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  // Edit Plan Modal State
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [editPriceRupees, setEditPriceRupees] = useState<number>(0);
  const [editUsers, setEditUsers] = useState<number>(5);
  const [editLeads, setEditLeads] = useState<number>(2000);
  const [editDescription, setEditDescription] = useState<string>('');
  const [savingPlan, setSavingPlan] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  const loadBillingData = async () => {
    try {
      setLoading(true);
      const [plansRes, invoicesRes] = await Promise.all([
        fetchSaasApi<{ plans: Plan[] }>('/plans').catch(() => ({ plans: [] })),
        fetchSaasApi<{ invoices: Invoice[] }>('/invoices').catch(() => ({ invoices: [] })),
      ]);

      if (plansRes?.plans) setPlans(plansRes.plans);
      if (invoicesRes?.invoices) setInvoices(invoicesRes.invoices);
    } catch (err) {
      console.error('Failed to load billing details:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBillingData();
  }, []);

  const handleOpenEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setEditPriceRupees(Math.round((plan.priceMonthly || 0) / 100));
    setEditUsers(plan.maxUsers);
    setEditLeads(plan.maxLeads);
    setEditDescription(plan.description || '');
  };

  const handleSavePlan = async () => {
    if (!editingPlan) return;
    try {
      setSavingPlan(true);
      await fetchSaasApi(`/plans/${editingPlan.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          priceMonthly: Math.round(editPriceRupees * 100),
          priceYearly: Math.round(editPriceRupees * 100 * 10), // 2 months free on yearly
          maxUsers: editUsers,
          maxLeads: editLeads,
          description: editDescription,
        }),
      });

      setToastMessage({ text: `Plan "${editingPlan.displayName}" updated successfully!`, type: 'success' });
      setEditingPlan(null);
      loadBillingData();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to update plan', type: 'error' });
    } finally {
      setSavingPlan(false);
    }
  };

  // Record Offline Payment Modal State
  const [showOfflineModal, setShowOfflineModal] = useState(false);
  const [submittingInvoice, setSubmittingInvoice] = useState(false);
  const [allOrgs, setAllOrgs] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [offlineForm, setOfflineForm] = useState({
    orgId: '',
    amountINR: 2499,
    paymentMethod: 'BANK_TRANSFER',
    referenceId: '',
    description: '',
    applyPlanUpgrade: false,
    targetPlanTier: 'PRO',
    billingCycle: 'monthly',
  });

  const handleOpenOfflineModal = async () => {
    setShowOfflineModal(true);
    try {
      const res = await fetchSaasApi<{ organizations: { id: string; name: string; slug: string }[] }>('/organizations?limit=100');
      if (res?.organizations) {
        setAllOrgs(res.organizations);
        if (res.organizations.length > 0 && !offlineForm.orgId) {
          setOfflineForm((prev) => ({ ...prev, orgId: res.organizations[0].id }));
        }
      }
    } catch (e) {
      console.error('Failed to load organizations for invoice modal', e);
    }
  };

  const handleRecordInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!offlineForm.orgId || !offlineForm.amountINR) {
      setToastMessage({ text: 'Organization and amount are required.', type: 'error' });
      return;
    }

    try {
      setSubmittingInvoice(true);
      const res = await fetchSaasApi('/invoices', {
        method: 'POST',
        body: JSON.stringify(offlineForm),
      });

      setToastMessage({
        text: `Recorded invoice ${res?.invoice?.invoiceNumber || ''} successfully!`,
        type: 'success',
      });
      setShowOfflineModal(false);
      setOfflineForm({
        orgId: allOrgs[0]?.id || '',
        amountINR: 2499,
        paymentMethod: 'BANK_TRANSFER',
        referenceId: '',
        description: '',
        applyPlanUpgrade: false,
        targetPlanTier: 'PRO',
        billingCycle: 'monthly',
      });
      loadBillingData();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to record invoice.', type: 'error' });
    } finally {
      setSubmittingInvoice(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-xl text-white text-sm font-medium shadow-2xl transition-all duration-200 animate-slide-up ${
            toastMessage.type === 'success'
              ? 'bg-emerald-600 border border-emerald-500'
              : 'bg-rose-600 border border-rose-500'
          }`}
        >
          <span>{toastMessage.text}</span>
          <button
            onClick={() => setToastMessage(null)}
            className="p-1 rounded-md hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Billing & Subscription Plans</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage SaaS tier pricing, subscriber allocations, and platform invoices.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={loadBillingData}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenOfflineModal}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>+ Record Offline Payment</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div>
        <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Layers className="w-4 h-4 text-blue-400" />
          <span>Available Platform Tiers</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {loading
            ? Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 animate-pulse space-y-4"
                >
                  <div className="h-5 bg-slate-800 rounded w-24" />
                  <div className="h-8 bg-slate-800 rounded w-32" />
                  <div className="h-4 bg-slate-800 rounded w-48" />
                </div>
              ))
            : plans.map((plan) => (
                <div
                  key={plan.id}
                  className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-bold text-white text-lg">
                        {plan.displayName || plan.name}
                      </span>
                      <span className="text-[11px] font-semibold uppercase px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {plan.name}
                      </span>
                    </div>

                    <div className="flex items-baseline gap-1 my-4">
                      <span className="text-3xl font-extrabold text-white">
                        {inrFormatter.format((plan.priceMonthly || 0) / 100)}
                      </span>
                      <span className="text-xs text-slate-400">/ month</span>
                    </div>

                    <p className="text-xs text-slate-400 mb-5 leading-relaxed">
                      {plan.description || 'Standard multi-tenant CRM allocation tier.'}
                    </p>

                    <div className="space-y-2.5 text-xs text-slate-300 border-t border-slate-800/80 pt-4">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Max Telecallers:</span>
                        <span className="font-medium text-white">{plan.maxUsers} Users</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Leads Capacity:</span>
                        <span className="font-medium text-white">
                          {plan.maxLeads.toLocaleString()} Leads
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Included Storage:</span>
                        <span className="font-medium text-white">
                          {(plan.storageQuotaBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <div>
                      <span>Subscriptions: </span>
                      <span className="font-semibold text-emerald-400">
                        {plan._count?.subscriptions || 0}
                      </span>
                    </div>

                    <button
                      onClick={() => handleOpenEditPlan(plan)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 hover:text-cyan-300 border border-slate-700 transition"
                    >
                      Edit Plan
                    </button>
                  </div>
                </div>
              ))}
        </div>
      </div>

      {/* Invoices List */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-400" />
            <h2 className="text-base font-semibold text-white">Platform Invoices</h2>
          </div>
          <span className="text-xs text-slate-400">{invoices.length} Recent Records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Invoice #</th>
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Amount</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-24" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-36" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-20" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-16" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-24" />
                    </td>
                  </tr>
                ))
              ) : invoices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No billing invoices generated yet.</p>
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-850/40">
                    <td className="py-4 px-5 font-mono text-xs text-white">
                      {inv.invoiceNumber || inv.id.substring(0, 8)}
                    </td>
                    <td className="py-4 px-5">
                      <div className="font-medium text-white">{inv.organization?.name || 'N/A'}</div>
                      <div className="text-xs text-slate-500">@{inv.organization?.slug}</div>
                    </td>
                    <td className="py-4 px-5 font-semibold text-emerald-400">
                      {inrFormatter.format(((inv.amount || inv.totalAmount || 0) / 100))}
                    </td>
                    <td className="py-4 px-5">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          inv.status === 'PAID'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-4 px-5 text-xs text-slate-400">
                      {new Date(inv.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Plan Modal */}
      {editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Edit Plan Configuration</h3>
                  <p className="text-xs text-slate-400">{editingPlan.displayName}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingPlan(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 font-medium mb-1.5">
                  Monthly Price (INR ₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-2.5 text-slate-500 font-semibold">₹</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={editPriceRupees}
                    onChange={(e) => setEditPriceRupees(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-4 py-2.5 text-white focus:outline-hidden focus:border-cyan-500 font-medium"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">
                    Max Telecallers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={editUsers}
                    onChange={(e) => setEditUsers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-cyan-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-medium mb-1.5">
                    Leads Capacity
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={editLeads}
                    onChange={(e) => setEditLeads(Math.max(10, parseInt(e.target.value, 10) || 10))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2.5 text-white focus:outline-hidden focus:border-cyan-500 font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-medium mb-1.5">
                  Plan Description
                </label>
                <textarea
                  rows={2}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-hidden focus:border-cyan-500 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingPlan(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSavePlan}
                disabled={savingPlan}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {savingPlan ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Plan</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Record Offline Payment */}
      {showOfflineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 animate-scale-in my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    Record Offline B2B Payment
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Generate an official invoice for bank transfers, cash, or cheques.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOfflineModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordInvoiceSubmit} className="space-y-4">
              {/* Organization Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Client Organization <span className="text-rose-400">*</span>
                </label>
                <select
                  required
                  value={offlineForm.orgId}
                  onChange={(e) => setOfflineForm({ ...offlineForm, orgId: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                >
                  {allOrgs.length === 0 ? (
                    <option value="">Loading organizations...</option>
                  ) : (
                    allOrgs.map((org) => (
                      <option key={org.id} value={org.id}>
                        {org.name} ({org.slug})
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Amount & Method */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Amount Received (₹ INR) <span className="text-rose-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="1"
                      step="1"
                      value={offlineForm.amountINR}
                      onChange={(e) => setOfflineForm({ ...offlineForm, amountINR: parseInt(e.target.value, 10) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3.5 py-2 text-sm text-white font-mono focus:outline-none focus:border-blue-500"
                    />
                    <span className="absolute left-3 top-2.5 text-xs text-slate-500">₹</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={offlineForm.paymentMethod}
                    onChange={(e) => setOfflineForm({ ...offlineForm, paymentMethod: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="BANK_TRANSFER">Bank Wire / NEFT / RTGS</option>
                    <option value="UPI">UPI / Direct QR</option>
                    <option value="CHEQUE">Cheque / Demand Draft</option>
                    <option value="CASH">Cash / Offline Handover</option>
                  </select>
                </div>
              </div>

              {/* Reference ID & Memo */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    UTR / Reference ID
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UTR-982147104"
                    value={offlineForm.referenceId}
                    onChange={(e) => setOfflineForm({ ...offlineForm, referenceId: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Invoice Description / Memo
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Pro Plan Annual Renewal"
                    value={offlineForm.description}
                    onChange={(e) => setOfflineForm({ ...offlineForm, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Plan Upgrade Option */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-200">
                  <input
                    type="checkbox"
                    checked={offlineForm.applyPlanUpgrade}
                    onChange={(e) => setOfflineForm({ ...offlineForm, applyPlanUpgrade: e.target.checked })}
                    className="w-4 h-4 rounded text-blue-600 border-slate-700 bg-slate-900 focus:ring-0"
                  />
                  <span>Automatically update client's subscription plan with this payment?</span>
                </label>

                {offlineForm.applyPlanUpgrade && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-850">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Target Plan</label>
                      <select
                        value={offlineForm.targetPlanTier}
                        onChange={(e) => setOfflineForm({ ...offlineForm, targetPlanTier: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="STARTER">Starter Tier (5 Users, 2k Leads)</option>
                        <option value="PRO">Pro Tier (15 Users, 10k Leads)</option>
                        <option value="ENTERPRISE">Enterprise (1,000 Users, 1M Leads)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Billing Cycle</label>
                      <select
                        value={offlineForm.billingCycle}
                        onChange={(e) => setOfflineForm({ ...offlineForm, billingCycle: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                      >
                        <option value="monthly">Monthly Cycle (30 Days)</option>
                        <option value="yearly">Yearly Cycle (365 Days)</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowOfflineModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInvoice}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {submittingInvoice ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Record Payment & Issue Invoice</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-medium border ${
              toastMessage.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80'
                : 'bg-rose-950/90 text-rose-200 border-rose-800/80'
            }`}
          >
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
