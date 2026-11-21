'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  Search,
  Filter,
  Building2,
  Users,
  HardDrive,
  Calendar,
  MoreVertical,
  CheckCircle2,
  Ban,
  Clock,
  Trash2,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Plus,
  X,
  ShieldCheck,
  Check,
  HelpCircle,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Phone,
  Sparkles,
  CreditCard,
  ExternalLink,
} from 'lucide-react';
import { fetchSaasApi } from '@/lib/saas-api';

interface OrgCount {
  users: number;
  leads: number;
  calls: number;
}

interface Subscription {
  id: string;
  planTier: string;
  status: string;
  trialEnd?: string | null;
  plan?: {
    id: string;
    name: string;
    displayName: string;
    maxUsers: number;
    maxLeads: number;
    storageQuotaBytes: number;
  };
}

interface Organization {
  id: string;
  name: string;
  slug: string;
  phone?: string | null;
  website?: string | null;
  orgStatus: 'TRIAL' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' | 'DELETED';
  planTier: 'FREE' | 'STARTER' | 'PRO' | 'ENTERPRISE';
  trialEndsAt?: string | null;
  maxUsers: number;
  maxLeads: number;
  storageQuotaBytes: number;
  storageUsedBytes: number;
  orgStorageDriver: string;
  createdAt: string;
  customPriceMonthly?: number | null;
  customPriceYearly?: number | null;
  billingCycle?: string | null;
  activatedAt?: string | null;
  billingNotes?: string | null;
  _count?: OrgCount;
  subscription?: Subscription | null;
}

interface PaginationData {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SuperAdminOrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [pagination, setPagination] = useState<PaginationData>({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  });

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Active dropdown menu state
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modal States
  const [extendTrialOrg, setExtendTrialOrg] = useState<Organization | null>(null);
  const [extendDays, setExtendDays] = useState<number>(14);

  const [deleteConfirmOrg, setDeleteConfirmOrg] = useState<Organization | null>(null);

  // Storage Quota Modal
  const [quotaOrg, setQuotaOrg] = useState<Organization | null>(null);
  const [quotaGB, setQuotaGB] = useState<number>(15);
  const [savingQuota, setSavingQuota] = useState<boolean>(false);

  // Onboard New Organization Modal State
  const [showAddOrgModal, setShowAddOrgModal] = useState<boolean>(false);
  const [submittingAddOrg, setSubmittingAddOrg] = useState<boolean>(false);
  const [showNewPassword, setShowNewPassword] = useState<boolean>(false);
  const [newOrgForm, setNewOrgForm] = useState({
    name: '',
    slug: '',
    phone: '',
    website: '',
    adminName: '',
    adminEmail: '',
    adminPassword: 'Admin@123',
    maxUsers: 2,
    maxLeads: 1000000000,
    storageQuotaMB: 500,
  });

  const handleAddOrgSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOrgForm.name.trim() || !newOrgForm.adminName.trim() || !newOrgForm.adminEmail.trim()) {
      setToastMessage({ text: 'Please fill in Company Name, Admin Name, and Admin Email.', type: 'error' });
      return;
    }

    try {
      setSubmittingAddOrg(true);
      const res = await fetchSaasApi('/organizations', {
        method: 'POST',
        body: JSON.stringify(newOrgForm),
      });

      setToastMessage({
        text: `Organization "${res?.organization?.name || newOrgForm.name}" onboarded successfully!`,
        type: 'success',
      });
      setShowAddOrgModal(false);
      setNewOrgForm({
        name: '',
        slug: '',
        phone: '',
        website: '',
        adminName: '',
        adminEmail: '',
        adminPassword: 'Admin@123',
        maxUsers: 2,
        maxLeads: 1000000000,
        storageQuotaMB: 500,
      });
      loadOrganizations();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to onboard organization.', type: 'error' });
    } finally {
      setSubmittingAddOrg(false);
    }
  };

  const handleUpdateQuota = async () => {
    if (!quotaOrg) return;
    try {
      setSavingQuota(true);
      const bytes = Math.round(quotaGB * 1024 * 1024 * 1024);
      await fetchSaasApi(`/storage/organizations/${quotaOrg.id}/quota`, {
        method: 'PUT',
        body: JSON.stringify({ storageQuotaBytes: bytes }),
      });
      setToastMessage({ text: `Updated storage quota for ${quotaOrg.name} to ${quotaGB} GB.`, type: 'success' });
      setQuotaOrg(null);
      loadOrganizations(pagination.page);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to update quota', type: 'error' });
    } finally {
      setSavingQuota(false);
    }
  };

  // Change Plan Modal State
  const [changePlanOrg, setChangePlanOrg] = useState<Organization | null>(null);
  const [targetPlanTier, setTargetPlanTier] = useState<string>('PRO');
  const [planBillingCycle, setPlanBillingCycle] = useState<string>('monthly');
  const [planMaxUsers, setPlanMaxUsers] = useState<number>(15);
  const [planMaxLeads, setPlanMaxLeads] = useState<number>(10000);
  const [planStorageGB, setPlanStorageGB] = useState<number>(25);
  const [planStatus, setPlanStatus] = useState<string>('ACTIVE');
  const [savingPlan, setSavingPlan] = useState<boolean>(false);

  // Activate Billing Modal State (new custom pricing model)
  const [activateBillingOrg, setActivateBillingOrg] = useState<Organization | null>(null);
  const [billingForm, setBillingForm] = useState({
    customPriceMonthly: '',   // in ₹ (displayed), converted to paise on submit
    customPriceYearly: '',
    billingCycle: 'monthly',
    maxUsers: 5,
    maxLeads: 2000,
    storageQuotaGB: 15,
    billingNotes: '',
    activateNow: true,
  });
  const [savingBilling, setSavingBilling] = useState(false);

  const handleOpenActivateBilling = (org: Organization) => {
    setActivateBillingOrg(org);
    setBillingForm({
      customPriceMonthly: org.customPriceMonthly ? String(org.customPriceMonthly / 100) : '',
      customPriceYearly: org.customPriceYearly ? String(org.customPriceYearly / 100) : '',
      billingCycle: org.billingCycle || 'monthly',
      maxUsers: org.maxUsers || 5,
      maxLeads: org.maxLeads || 2000,
      storageQuotaGB: Math.round(org.storageQuotaBytes / (1024 * 1024 * 1024)) || 15,
      billingNotes: org.billingNotes || '',
      activateNow: org.orgStatus === 'TRIAL',
    });
  };

  const handleActivateBillingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activateBillingOrg) return;
    try {
      setSavingBilling(true);
      await fetchSaasApi(`/organizations/${activateBillingOrg.id}/billing`, {
        method: 'PATCH',
        body: JSON.stringify({
          customPriceMonthly: billingForm.customPriceMonthly ? Math.round(parseFloat(billingForm.customPriceMonthly) * 100) : undefined,
          customPriceYearly: billingForm.customPriceYearly ? Math.round(parseFloat(billingForm.customPriceYearly) * 100) : undefined,
          billingCycle: billingForm.billingCycle,
          maxUsers: billingForm.maxUsers,
          maxLeads: billingForm.maxLeads,
          storageQuotaGB: billingForm.storageQuotaGB,
          billingNotes: billingForm.billingNotes,
          activateNow: billingForm.activateNow,
        }),
      });
      setToastMessage({
        text: billingForm.activateNow
          ? `${activateBillingOrg.name} subscription activated!`
          : `Billing details updated for ${activateBillingOrg.name}.`,
        type: 'success',
      });
      setActivateBillingOrg(null);
      loadOrganizations(pagination.page);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to update billing.', type: 'error' });
    } finally {
      setSavingBilling(false);
    }
  };

  const applyPlanDefaults = (tier: string) => {
    setTargetPlanTier(tier);
    if (tier === 'FREE') {
      setPlanMaxUsers(2);
      setPlanMaxLeads(200);
      setPlanStorageGB(5);
    } else if (tier === 'STARTER') {
      setPlanMaxUsers(5);
      setPlanMaxLeads(2000);
      setPlanStorageGB(15);
    } else if (tier === 'PRO') {
      setPlanMaxUsers(15);
      setPlanMaxLeads(10000);
      setPlanStorageGB(25);
    } else if (tier === 'ENTERPRISE') {
      setPlanMaxUsers(1000);
      setPlanMaxLeads(1000000);
      setPlanStorageGB(100);
    }
  };

  const handleOpenChangePlan = (org: Organization) => {
    setChangePlanOrg(org);
    applyPlanDefaults(org.planTier || 'STARTER');
    setPlanStatus(org.orgStatus || 'ACTIVE');
    setOpenDropdownId(null);
  };

  const handleChangePlanSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!changePlanOrg) return;
    try {
      setSavingPlan(true);
      await fetchSaasApi(`/organizations/${changePlanOrg.id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({
          planTier: targetPlanTier,
          maxUsers: planMaxUsers,
          maxLeads: planMaxLeads,
          storageQuotaGB: planStorageGB,
          orgStatus: planStatus,
          billingCycle: planBillingCycle,
        }),
      });

      setToastMessage({
        text: `Switched ${changePlanOrg.name} to ${targetPlanTier} plan successfully!`,
        type: 'success',
      });
      setChangePlanOrg(null);
      loadOrganizations(pagination.page);
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to change plan.', type: 'error' });
    } finally {
      setSavingPlan(false);
    }
  };

  // Impersonate Organization Handler
  const handleImpersonate = async (org: Organization) => {
    try {
      setActionInProgress(org.id);
      setOpenDropdownId(null);
      const res = await fetchSaasApi(`/organizations/${org.id}/impersonate`, {
        method: 'POST',
      });

      if (res?.token) {
        localStorage.setItem('crm_token', res.token);
        if (res.user) {
          localStorage.setItem('crm_user', JSON.stringify(res.user));
        }
        window.open('/dashboard/admin', '_blank');
        setToastMessage({
          text: `Opened tenant console for ${org.name} as ${res.user?.name || 'Admin'}.`,
          type: 'success',
        });
      }
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to impersonate organization.', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdownId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadOrganizations = async (pageToLoad = pagination.page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set('page', pageToLoad.toString());
      params.set('limit', pagination.limit.toString());
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter) params.set('orgStatus', statusFilter);
      if (planFilter) params.set('planTier', planFilter);

      const res = await fetchSaasApi<{
        organizations: Organization[];
        pagination: PaginationData;
      }>(`/organizations?${params.toString()}`);

      if (res?.organizations) {
        setOrganizations(res.organizations);
        setPagination(res.pagination);
      }
    } catch (err: any) {
      console.error('Failed to load organizations:', err);
      setToastMessage({ text: err.message || 'Failed to load organizations.', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch on filter changes
  useEffect(() => {
    const timer = setTimeout(() => {
      loadOrganizations(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter, planFilter]);

  // Handle Suspend
  const handleSuspend = async (org: Organization) => {
    try {
      setActionInProgress(org.id);
      setOpenDropdownId(null);
      await fetchSaasApi(`/organizations/${org.id}/suspend`, { method: 'PATCH' });
      setToastMessage({ text: `Suspended ${org.name} successfully.`, type: 'success' });
      loadOrganizations();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to suspend organization.', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Reactivate
  const handleReactivate = async (org: Organization) => {
    try {
      setActionInProgress(org.id);
      setOpenDropdownId(null);
      await fetchSaasApi(`/organizations/${org.id}/reactivate`, { method: 'PATCH' });
      setToastMessage({ text: `Reactivated ${org.name} successfully.`, type: 'success' });
      loadOrganizations();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to reactivate organization.', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Extend Trial Submit
  const handleExtendTrialSubmit = async () => {
    if (!extendTrialOrg) return;
    try {
      setActionInProgress(extendTrialOrg.id);
      await fetchSaasApi(`/organizations/${extendTrialOrg.id}/extend-trial`, {
        method: 'PATCH',
        body: JSON.stringify({ days: extendDays }),
      });
      setToastMessage({
        text: `Extended trial for ${extendTrialOrg.name} by ${extendDays} days.`,
        type: 'success',
      });
      setExtendTrialOrg(null);
      loadOrganizations();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to extend trial.', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!deleteConfirmOrg) return;
    try {
      setActionInProgress(deleteConfirmOrg.id);
      await fetchSaasApi(`/organizations/${deleteConfirmOrg.id}/delete`, {
        method: 'DELETE',
      });
      setToastMessage({
        text: `Organization ${deleteConfirmOrg.name} marked as DELETED.`,
        type: 'success',
      });
      setDeleteConfirmOrg(null);
      loadOrganizations();
    } catch (err: any) {
      setToastMessage({ text: err.message || 'Failed to delete organization.', type: 'error' });
    } finally {
      setActionInProgress(null);
    }
  };

  // Storage Formatter: Bytes -> MB / GB
  const formatBytesToGB = (bytes: number | bigint = 0) => {
    const b = Number(bytes);
    if (b === 0) return '0 MB';
    const mb = b / (1024 * 1024);
    if (mb < 1000) {
      return `${Math.round(mb)} MB`;
    }
    const gb = b / (1024 * 1024 * 1024);
    return `${gb.toFixed(2)} GB`;
  };

  // Storage Percentage Calculation
  const getStoragePercentage = (used: number | bigint = 0, quota: number | bigint = 1) => {
    const u = Number(used);
    const q = Math.max(Number(quota), 1);
    const pct = Math.round((u / q) * 100);
    return Math.min(Math.max(pct, 0), 100);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto" ref={dropdownRef}>
      {/* Toast Notification */}
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
            <span>Client Organizations</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              {pagination.total} Total
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage tenant subscriptions, user limits, quotas, and account lifecycles.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          <button
            onClick={() => loadOrganizations()}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-400' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddOrgModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white shadow-lg shadow-blue-600/30 transition duration-150"
          >
            <Plus className="w-4 h-4" />
            <span>+ Add Organization</span>
          </button>
        </div>
      </div>

      {/* Search & Filters Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company name or slug..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Status */}
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">All Statuses</option>
            <option value="TRIAL">🟡 TRIAL</option>
            <option value="ACTIVE">🟢 ACTIVE</option>
            <option value="SUSPENDED">🔴 SUSPENDED</option>
            <option value="CANCELLED">⚪ CANCELLED</option>
            <option value="DELETED">⚫ DELETED</option>
          </select>
        </div>

        {/* Filter Plan */}
        <div className="w-full sm:w-48">
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="w-full px-3.5 py-2 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-blue-500 transition"
          >
            <option value="">All Plans</option>
            <option value="FREE">FREE</option>
            <option value="STARTER">STARTER</option>
            <option value="PRO">PRO</option>
            <option value="ENTERPRISE">ENTERPRISE</option>
          </select>
        </div>
      </div>

      {/* Organizations Table Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Company</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Plan</th>
                <th className="py-3.5 px-4">Users</th>
                <th className="py-3.5 px-4">Leads</th>
                <th className="py-3.5 px-5 min-w-[160px]">Storage Used / Quota</th>
                <th className="py-3.5 px-4">Created Date</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {loading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-36 mb-1.5" />
                      <div className="h-3 bg-slate-800/60 rounded w-24" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-slate-800 rounded-full w-16" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-5 bg-slate-800 rounded-md w-14" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-12" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-10" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-28 mb-1.5" />
                      <div className="h-2 bg-slate-800 rounded-full w-full" />
                    </td>
                    <td className="py-4 px-4">
                      <div className="h-4 bg-slate-800 rounded w-20" />
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="h-7 w-7 bg-slate-800 rounded-lg ml-auto" />
                    </td>
                  </tr>
                ))
              ) : organizations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Building2 className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-base font-medium text-slate-400">No organizations found</p>
                    <p className="text-xs mt-1">Try adjusting your search criteria or filters.</p>
                  </td>
                </tr>
              ) : (
                organizations.map((org) => {
                  const storagePct = getStoragePercentage(
                    org.storageUsedBytes,
                    org.storageQuotaBytes
                  );

                  return (
                    <tr
                      key={org.id}
                      className="hover:bg-slate-850/40 transition-colors duration-100"
                    >
                      {/* Company Name & Slug */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white tracking-tight">
                          {org.name}
                        </div>
                        <div className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-slate-500">@{org.slug}</span>
                          {org.phone && (
                            <>
                              <span>•</span>
                              <span>{org.phone}</span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Status Badge: TRIAL=yellow, ACTIVE=green, SUSPENDED=red */}
                      <td className="py-4 px-4">
                        {org.orgStatus === 'ACTIVE' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            ACTIVE
                          </span>
                        )}
                        {org.orgStatus === 'TRIAL' && (
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                              TRIAL
                            </span>
                            {org.trialEndsAt && (
                              <p className="text-[10px] text-amber-400/60 mt-0.5">
                                {Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))} days left
                              </p>
                            )}
                          </div>
                        )}
                        {org.orgStatus === 'SUSPENDED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                            SUSPENDED
                          </span>
                        )}
                        {org.orgStatus === 'DELETED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/30 text-slate-400 border border-slate-700">
                            DELETED
                          </span>
                        )}
                        {org.orgStatus === 'CANCELLED' && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700/30 text-slate-400 border border-slate-700">
                            CANCELLED
                          </span>
                        )}
                      </td>

                      {/* Plan / Custom Pricing */}
                      <td className="py-4 px-4">
                        {org.customPriceMonthly || org.customPriceYearly ? (
                          <div>
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Custom
                            </span>
                            <p className="text-[10px] text-slate-500 mt-0.5">
                              {org.customPriceMonthly ? `₹${(org.customPriceMonthly / 100).toLocaleString('en-IN')}/mo` : ''}
                              {org.customPriceMonthly && org.customPriceYearly ? ' · ' : ''}
                              {org.customPriceYearly ? `₹${(org.customPriceYearly / 100).toLocaleString('en-IN')}/yr` : ''}
                            </p>
                          </div>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            {org.planTier || 'FREE'}
                          </span>
                        )}
                      </td>

                      {/* Users used / max */}
                      <td className="py-4 px-4 text-slate-200">
                        <span className="font-semibold text-white">
                          {org._count?.users ?? 0}
                        </span>
                        <span className="text-slate-500"> / {org.maxUsers}</span>
                      </td>

                      {/* Leads Count / Unlimited */}
                      <td className="py-4 px-4 text-slate-200">
                        <span className="font-semibold text-white">
                          {org._count?.leads?.toLocaleString() ?? 0}
                        </span>
                        <span className="text-[10px] text-slate-500 block">
                          {org.maxLeads >= 10000000 ? 'Unlimited' : `/ ${org.maxLeads.toLocaleString()}`}
                        </span>
                      </td>

                      {/* Storage used / quota with mini progress bar */}
                      <td className="py-4 px-5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-300">
                            {formatBytesToGB(org.storageUsedBytes)}
                          </span>
                          <span className="text-slate-500">
                            / {formatBytesToGB(org.storageQuotaBytes)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              storagePct > 90
                                ? 'bg-rose-500'
                                : storagePct > 75
                                ? 'bg-amber-500'
                                : 'bg-cyan-500'
                            }`}
                            style={{ width: `${storagePct}%` }}
                          />
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {new Date(org.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Actions Dropdown */}
                      <td className="py-4 px-4 text-right relative">
                        <div className="inline-block text-left">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === org.id ? null : org.id);
                            }}
                            disabled={actionInProgress === org.id}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                          >
                            {actionInProgress === org.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                            ) : (
                              <MoreVertical className="w-4 h-4" />
                            )}
                          </button>

                          {/* Dropdown Menu */}
                          {openDropdownId === org.id && (
                            <div className="absolute right-0 mt-2 w-48 rounded-xl bg-slate-900 border border-slate-750 shadow-2xl z-20 py-1 text-xs divide-y divide-slate-800">
                              <div className="py-1">
                                {org.orgStatus !== 'SUSPENDED' && org.orgStatus !== 'DELETED' && (
                                  <button
                                    onClick={() => handleSuspend(org)}
                                    className="w-full text-left px-3.5 py-2 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 flex items-center gap-2 transition"
                                  >
                                    <Ban className="w-3.5 h-3.5" />
                                    <span>Suspend Org</span>
                                  </button>
                                )}

                                {(org.orgStatus === 'SUSPENDED' || org.orgStatus === 'TRIAL') && (
                                  <button
                                    onClick={() => handleReactivate(org)}
                                    className="w-full text-left px-3.5 py-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-2 transition"
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Reactivate Org</span>
                                  </button>
                                )}

                                <button
                                  onClick={() => {
                                    setExtendTrialOrg(org);
                                    setExtendDays(14);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 flex items-center gap-2 transition"
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  <span>Extend Trial</span>
                                </button>

                                <button
                                  onClick={() => handleOpenChangePlan(org)}
                                  className="w-full text-left px-3.5 py-2 text-blue-400 hover:bg-blue-500/10 hover:text-blue-300 flex items-center gap-2 transition"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Change Plan...</span>
                                </button>

                                {/* New: Activate Subscription with custom pricing */}
                                <button
                                  onClick={() => {
                                    handleOpenActivateBilling(org);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300 flex items-center gap-2 transition"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                  <span>{org.orgStatus === 'TRIAL' ? 'Activate Subscription' : 'Edit Billing'}</span>
                                </button>

                                <button
                                  onClick={() => handleImpersonate(org)}
                                  className="w-full text-left px-3.5 py-2 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 flex items-center gap-2 transition"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                  <span>Login as Client</span>
                                </button>

                                <button
                                  onClick={() => {
                                    setQuotaOrg(org);
                                    setQuotaGB(Math.max(1, Math.round(Number(org.storageQuotaBytes) / (1024 * 1024 * 1024))));
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-cyan-400 hover:bg-cyan-500/10 hover:text-cyan-300 flex items-center gap-2 transition"
                                >
                                  <HardDrive className="w-3.5 h-3.5" />
                                  <span>Adjust Storage Quota</span>
                                </button>
                              </div>

                              <div className="py-1">
                                <button
                                  onClick={() => {
                                    setDeleteConfirmOrg(org);
                                    setOpenDropdownId(null);
                                  }}
                                  className="w-full text-left px-3.5 py-2 text-red-500 hover:bg-red-500/10 hover:text-red-400 flex items-center gap-2 transition font-medium"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete Org...</span>
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="bg-slate-950/80 border-t border-slate-800 px-5 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Showing{' '}
            <span className="font-semibold text-white">
              {pagination.total > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
            </span>{' '}
            to{' '}
            <span className="font-semibold text-white">
              {Math.min(pagination.page * pagination.limit, pagination.total)}
            </span>{' '}
            of <span className="font-semibold text-white">{pagination.total}</span> organizations
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => loadOrganizations(pagination.page - 1)}
              disabled={pagination.page <= 1 || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1 font-medium text-slate-200">
              Page {pagination.page} of {pagination.totalPages || 1}
            </span>

            <button
              onClick={() => loadOrganizations(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages || loading}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Modal: Extend Trial */}
      {extendTrialOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2.5 text-amber-400">
                <Clock className="w-5 h-5" />
                <h3 className="text-base font-semibold text-white">Extend Organization Trial</h3>
              </div>
              <button
                onClick={() => setExtendTrialOrg(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              Extend the trial period for{' '}
              <strong className="text-white">{extendTrialOrg.name}</strong>.
            </p>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Additional Days to Grant
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[7, 14, 30, 60].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setExtendDays(d)}
                    className={`py-2 text-xs font-semibold rounded-xl border transition ${
                      extendDays === d
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-white'
                    }`}
                  >
                    +{d} Days
                  </button>
                ))}
              </div>

              <input
                type="number"
                min="1"
                max="365"
                value={extendDays}
                onChange={(e) => setExtendDays(Math.max(1, parseInt(e.target.value || '1', 10)))}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setExtendTrialOrg(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExtendTrialSubmit}
                disabled={actionInProgress === extendTrialOrg.id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 transition"
              >
                {actionInProgress === extendTrialOrg.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Grant +{extendDays} Days</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Delete Confirmation */}
      {deleteConfirmOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-red-400 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">Delete Organization</h3>
                <p className="text-xs text-slate-400">Soft delete tenant organization</p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">
              Are you sure you want to mark{' '}
              <strong className="text-white font-semibold">{deleteConfirmOrg.name}</strong> as{' '}
              <span className="text-red-400 font-semibold">DELETED</span>?
            </p>
            <p className="text-xs text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
              This will deactivate access for all associated telecallers and administrators immediately.
            </p>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setDeleteConfirmOrg(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={actionInProgress === deleteConfirmOrg.id}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-red-600 hover:bg-red-500 transition shadow-lg shadow-red-600/30"
              >
                {actionInProgress === deleteConfirmOrg.id && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                )}
                <span>Confirm Deletion</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Adjust Storage Quota */}
      {quotaOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0">
                  <HardDrive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Adjust Storage Quota</h3>
                  <p className="text-xs text-slate-400">{quotaOrg.name}</p>
                </div>
              </div>
              <button
                onClick={() => setQuotaOrg(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Preset Quotas (GB)
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[15, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setQuotaGB(preset)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition ${
                        quotaGB === preset
                          ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400'
                          : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
                      }`}
                    >
                      {preset} GB
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5">
                  Or Custom Quota (Gigabytes)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={quotaGB}
                    onChange={(e) => setQuotaGB(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-hidden focus:border-cyan-500"
                  />
                  <span className="absolute right-3.5 top-2.5 text-xs font-medium text-slate-500">
                    GB
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  Current usage: {(Number(quotaOrg.storageUsedBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setQuotaOrg(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleUpdateQuota}
                disabled={savingQuota}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 transition disabled:opacity-50"
              >
                {savingQuota ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save Quota</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Onboard New Client Organization Modal */}
      {showAddOrgModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 shadow-2xl space-y-6 my-8 animate-scale-in">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Onboard New Client Organization</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Multi-Tenant
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Provision tenant workspace, primary administrator, subscription plan, and storage quota.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddOrgModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAddOrgSubmit} className="space-y-5">
              {/* Section 1: Company Profile */}
              <div className="space-y-3">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5" />
                  <span>1. Company Profile</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Organization / Company Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Apex Global Logistics"
                      value={newOrgForm.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        const autoSlug = val
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, '-')
                          .replace(/-+/g, '-')
                          .replace(/^-|-$/g, '');
                        setNewOrgForm((prev) => ({
                          ...prev,
                          name: val,
                          slug: prev.slug === '' || prev.slug === autoSlug.slice(0, -1) ? autoSlug : prev.slug,
                        }));
                      }}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Workspace Slug / Subdomain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. apex-logistics"
                      value={newOrgForm.slug}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+91 9876543210"
                      value={newOrgForm.phone}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Website URL
                    </label>
                    <input
                      type="text"
                      placeholder="https://apexlogistics.com"
                      value={newOrgForm.website}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, website: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Primary Administrator */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>2. Tenant Administrator Credentials</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Admin Full Name <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rahul Sharma"
                      value={newOrgForm.adminName}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, adminName: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Admin Login Email <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="admin@apexlogistics.com"
                      value={newOrgForm.adminEmail}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, adminEmail: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Initial Password
                    </label>
                    <div className="relative">
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        value={newOrgForm.adminPassword}
                        onChange={(e) => setNewOrgForm({ ...newOrgForm, adminPassword: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-3.5 pr-9 py-2 text-sm text-white focus:outline-none focus:border-blue-500 font-mono transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-500 hover:text-slate-300"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Trial & Resource Limits */}
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>3. Trial & Resource Limits</span>
                </div>

                {/* Trial info banner */}
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3 text-xs text-amber-300">
                  <Clock className="w-4 h-4 text-amber-400 shrink-0" />
                  <div>
                    <p className="font-semibold">7-Day Training Trial (2 Users · 500 MB Storage · Unlimited Leads)</p>
                    <p className="text-amber-400/70 mt-0.5">Every new client automatically starts on a 7-day evaluation trial. Pricing is customized and activated post-trial.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Max Users
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={newOrgForm.maxUsers}
                      onChange={(e) => setNewOrgForm({ ...newOrgForm, maxUsers: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Lead Management
                    </label>
                    <div className="w-full bg-slate-950 border border-emerald-500/30 rounded-xl px-3.5 py-2 text-sm text-emerald-400 font-semibold flex items-center justify-between">
                      <span>Unlimited Leads</span>
                      <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono">No Cap</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Storage Quota
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min="50"
                        step="50"
                        value={newOrgForm.storageQuotaMB}
                        onChange={(e) => setNewOrgForm({ ...newOrgForm, storageQuotaMB: Math.max(50, parseInt(e.target.value, 10) || 50) })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition"
                      />
                      <span className="absolute right-3.5 top-2 text-xs text-slate-500 font-mono">MB</span>
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 pt-1">
                  💡 After the 7-day trial, click <strong className="text-slate-400">Activate Subscription</strong> in the table to set custom negotiated monthly or yearly pricing.
                </p>
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddOrgModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAddOrg}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {submittingAddOrg ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Onboarding...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Create Client Organization</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Change Subscription Plan */}
      {changePlanOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
                  <CreditCard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>Change Subscription Plan</span>
                    <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      {changePlanOrg.planTier}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Update subscription tier, telecaller limits, and storage for <strong className="text-white">{changePlanOrg.name}</strong>.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setChangePlanOrg(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePlanSubmit} className="space-y-4">
              {/* Target Plan Selector */}
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-2">
                  Select New Plan Tier
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { tier: 'FREE', name: 'Free', users: '2 Users', leads: '200 Leads' },
                    { tier: 'STARTER', name: 'Starter', users: '5 Users', leads: '2k Leads' },
                    { tier: 'PRO', name: 'Pro', users: '15 Users', leads: '10k Leads' },
                    { tier: 'ENTERPRISE', name: 'Enterprise', users: '1k Users', leads: '1M Leads' },
                  ].map((p) => {
                    const isSelected = targetPlanTier === p.tier;
                    return (
                      <button
                        key={p.tier}
                        type="button"
                        onClick={() => applyPlanDefaults(p.tier)}
                        className={`p-3 rounded-xl border text-left transition ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white shadow-md shadow-blue-500/10'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="font-semibold text-xs text-slate-200">{p.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{p.users}</div>
                        <div className="text-[10px] text-slate-500">{p.leads}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Billing Cycle & Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Billing Cycle
                  </label>
                  <select
                    value={planBillingCycle}
                    onChange={(e) => setPlanBillingCycle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="monthly">Monthly Cycle (30 Days)</option>
                    <option value="yearly">Yearly Cycle (365 Days)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Account Status
                  </label>
                  <select
                    value={planStatus}
                    onChange={(e) => setPlanStatus(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="ACTIVE">Active (Standard)</option>
                    <option value="TRIAL">Trial Evaluation</option>
                  </select>
                </div>
              </div>

              {/* Granular Limit Overrides */}
              <div className="pt-2 border-t border-slate-800/80">
                <div className="text-xs font-semibold text-blue-400 uppercase tracking-wider mb-2.5">
                  Granular Limit Adjustments
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      max="10000"
                      value={planMaxUsers}
                      onChange={(e) => setPlanMaxUsers(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Max Leads</label>
                    <input
                      type="number"
                      min="10"
                      max="5000000"
                      value={planMaxLeads}
                      onChange={(e) => setPlanMaxLeads(parseInt(e.target.value, 10) || 10)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Storage Quota (GB)</label>
                    <input
                      type="number"
                      min="1"
                      max="5000"
                      value={planStorageGB}
                      onChange={(e) => setPlanStorageGB(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setChangePlanOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition shadow-lg shadow-blue-600/30 disabled:opacity-50"
                >
                  {savingPlan ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Plan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Save Plan Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Activate / Edit Billing (Custom Negotiated Pricing) */}
      {activateBillingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl p-6 shadow-2xl space-y-5 animate-scale-in">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">
                    {activateBillingOrg.orgStatus === 'TRIAL' ? 'Activate Subscription' : 'Edit Billing'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Custom negotiated pricing for <strong className="text-slate-200">{activateBillingOrg.name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActivateBillingOrg(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleActivateBillingSubmit} className="space-y-4">
              {/* Current status banner */}
              <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
                activateBillingOrg.orgStatus === 'TRIAL'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
              }`}>
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  Current status: <strong>{activateBillingOrg.orgStatus}</strong>
                  {activateBillingOrg.trialEndsAt && activateBillingOrg.orgStatus === 'TRIAL' && (
                    <> · Trial ends {new Date(activateBillingOrg.trialEndsAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</>
                  )}
                </span>
              </div>

              {/* Custom Pricing */}
              <div className="space-y-3">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Negotiated Pricing (₹)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Monthly Price (₹/month)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 2999"
                        value={billingForm.customPriceMonthly}
                        onChange={(e) => setBillingForm({ ...billingForm, customPriceMonthly: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Yearly Price (₹/year)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-slate-500">₹</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 29999"
                        value={billingForm.customPriceYearly}
                        onChange={(e) => setBillingForm({ ...billingForm, customPriceYearly: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-7 pr-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Billing Cycle</label>
                  <select
                    value={billingForm.billingCycle}
                    onChange={(e) => setBillingForm({ ...billingForm, billingCycle: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Resource Limits */}
              <div className="space-y-3 pt-2 border-t border-slate-800">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Resource Limits</p>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Users</label>
                    <input
                      type="number"
                      min="1"
                      value={billingForm.maxUsers}
                      onChange={(e) => setBillingForm({ ...billingForm, maxUsers: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Max Leads</label>
                    <input
                      type="number"
                      min="100"
                      step="100"
                      value={billingForm.maxLeads}
                      onChange={(e) => setBillingForm({ ...billingForm, maxLeads: parseInt(e.target.value, 10) || 100 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Storage (GB)</label>
                    <input
                      type="number"
                      min="1"
                      value={billingForm.storageQuotaGB}
                      onChange={(e) => setBillingForm({ ...billingForm, storageQuotaGB: parseInt(e.target.value, 10) || 1 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 transition"
                    />
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs text-slate-400 mb-1">Internal Billing Notes (optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Client negotiated ₹2500/mo, agreed on 15 users..."
                  value={billingForm.billingNotes}
                  onChange={(e) => setBillingForm({ ...billingForm, billingNotes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 transition resize-none"
                />
              </div>

              {/* Activate now toggle */}
              {activateBillingOrg.orgStatus === 'TRIAL' && (
                <div
                  className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl cursor-pointer"
                  onClick={() => setBillingForm((f) => ({ ...f, activateNow: !f.activateNow }))}
                >
                  <div className={`w-9 h-5 rounded-full flex items-center transition-colors ${billingForm.activateNow ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${billingForm.activateNow ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-emerald-300">Activate subscription now</p>
                    <p className="text-[11px] text-emerald-400/70">Turn off to save pricing details but keep client in trial.</p>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setActivateBillingOrg(null)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBilling}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition shadow-lg shadow-emerald-600/30 disabled:opacity-50"
                >
                  {savingBilling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>{billingForm.activateNow ? 'Activate Subscription' : 'Save Billing Details'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
