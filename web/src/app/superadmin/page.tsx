'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  IndianRupee,
  Building2,
  Clock,
  Ban,
  Users,
  PhoneCall,
  UserCheck,
  HardDrive,
  Sparkles,
  RefreshCw,
  ArrowRight,
  TrendingUp,
  AlertCircle,
  Database,
  Layers,
  Download,
  AlertTriangle,
  CreditCard,
  Camera,
} from 'lucide-react';
import { fetchSaasApi } from '@/lib/saas-api';
import { getApiBase } from '@/lib/api';

interface DashboardStats {
  totalOrgs: number;
  activeOrgs: number;
  trialOrgs: number;
  suspendedOrgs: number;
  payingOrgs?: number;
  totalUsers: number;
  totalCalls: number;
  totalLeads: number;
  totalStorageUsedBytes: number;
  monthlyRevenue: number;
  mrr?: number;
  arr?: number;
  arpu?: number;
  newOrgsThisMonth: number;
  systemAlerts?: {
    trialsExpiringCount: number;
    quotaAlertsCount: number;
    suspendedOrgsCount: number;
  };
}

export default function SuperAdminDashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [exporting, setExporting] = useState<string | null>(null);

  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  const numFormatter = new Intl.NumberFormat('en-IN');

  const fetchStats = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError('');

      const res = await fetchSaasApi<DashboardStats>('/dashboard/stats');
      setStats(res);
    } catch (err: any) {
      console.error('Failed to load superadmin stats:', err);
      setError(err.message || 'Unable to retrieve dashboard analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleExport = async (type: 'organizations' | 'invoices' | 'storage') => {
    try {
      setExporting(type);
      const token = localStorage.getItem('saas_token');
      const res = await fetch(`${getApiBase()}/superadmin/export/${type}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${Date.now()}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      alert(`Export error: ${err.message}`);
    } finally {
      setExporting(null);
    }
  };

  const handleRunSnapshot = async () => {
    try {
      const res: any = await fetchSaasApi('/cron/daily-storage-snapshot', { method: 'POST' });
      alert(res.message || 'Snapshot completed!');
      fetchStats(true);
    } catch (err: any) {
      alert(err.message || 'Failed to capture snapshot');
    }
  };

  const formatStorageGB = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 0.01 && bytes > 0) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${gb.toFixed(2)} GB`;
  };

  const hasAlerts =
    stats?.systemAlerts &&
    (stats.systemAlerts.trialsExpiringCount > 0 ||
      stats.systemAlerts.quotaAlertsCount > 0 ||
      stats.systemAlerts.suspendedOrgsCount > 0);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>SaaS Platform Control Center</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              MRR {inrFormatter.format(stats?.mrr || 0)}
            </span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Real-time financial analytics, multi-tenant usage, and system health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-xl">
            <button
              onClick={() => handleExport('organizations')}
              disabled={!!exporting}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Orgs CSV</span>
            </button>
            <button
              onClick={() => handleExport('invoices')}
              disabled={!!exporting}
              className="px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Invoices CSV</span>
            </button>
          </div>

          <button
            onClick={handleRunSnapshot}
            title="Trigger daily storage snapshot now"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <Camera className="w-3.5 h-3.5 text-cyan-400" />
            <span>Snapshot</span>
          </button>

          <button
            onClick={() => fetchStats(true)}
            disabled={loading || refreshing}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Actionable System Alerts Banner */}
      {hasAlerts && stats?.systemAlerts && (
        <div className="p-4 rounded-2xl bg-amber-950/40 border border-amber-800/60 text-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <div>
              <span className="font-bold text-white">Platform Attention Items: </span>
              {stats.systemAlerts.trialsExpiringCount > 0 && (
                <span className="mr-3">
                  ⏰ <strong>{stats.systemAlerts.trialsExpiringCount}</strong> trials expiring soon.
                </span>
              )}
              {stats.systemAlerts.quotaAlertsCount > 0 && (
                <span className="mr-3">
                  ⚠️ <strong>{stats.systemAlerts.quotaAlertsCount}</strong> orgs at &gt;85% storage limit.
                </span>
              )}
              {stats.systemAlerts.suspendedOrgsCount > 0 && (
                <span>
                  🚫 <strong>{stats.systemAlerts.suspendedOrgsCount}</strong> suspended orgs.
                </span>
              )}
            </div>
          </div>
          <Link
            href="/superadmin/organizations"
            className="px-3 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-semibold border border-amber-500/30 transition shrink-0 self-start sm:self-auto"
          >
            Review Organizations
          </Link>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => fetchStats()}
            className="px-3 py-1 rounded-lg bg-red-800/40 hover:bg-red-800/60 text-white text-xs font-medium transition"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Financial & Core SaaS Metrics (MRR, ARR, Paying Customers, ARPU) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* MRR */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Monthly Recurring (MRR)
            </span>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {inrFormatter.format(stats?.mrr || stats?.monthlyRevenue || 0)}
          </div>
          <div className="mt-2 text-xs text-emerald-400 font-medium">
            ARR: {inrFormatter.format(stats?.arr || (stats?.monthlyRevenue || 0) * 12)}
          </div>
        </div>

        {/* Paying Customers */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Paying Tenants
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <CreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {stats?.payingOrgs ?? stats?.activeOrgs ?? 0}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Out of {stats?.totalOrgs || 0} registered organizations
          </div>
        </div>

        {/* ARPU */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Avg Revenue / Org (ARPU)
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <IndianRupee className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {inrFormatter.format(stats?.arpu || 0)}
          </div>
          <div className="mt-2 text-xs text-slate-400">Average customer value</div>
        </div>

        {/* Platform Calls Synced */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Calls Synced
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {numFormatter.format(stats?.totalCalls || 0)}
          </div>
          <div className="mt-2 text-xs text-cyan-400/90">
            {formatStorageGB(stats?.totalStorageUsedBytes || 0)} total media
          </div>
        </div>
      </div>

      {/* Stats Grid - 9 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {loading ? (
          // Skeleton Skeletons
          Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-900/70 border border-slate-800/80 rounded-2xl p-6 shadow-sm animate-pulse space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="h-4 bg-slate-800 rounded w-24" />
                <div className="w-9 h-9 bg-slate-800 rounded-xl" />
              </div>
              <div className="h-8 bg-slate-800 rounded w-36" />
              <div className="h-3 bg-slate-800/60 rounded w-48" />
            </div>
          ))
        ) : (
          <>
            {/* 1. Revenue */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Monthly Revenue
                </span>
                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                  <IndianRupee className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {inrFormatter.format(stats?.monthlyRevenue || 0)}
              </div>
              <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-400">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Current calendar month billed</span>
              </div>
            </div>

            {/* 2. Active Orgs */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Active Orgs
                </span>
                <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400">
                  <Building2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.activeOrgs || 0)}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Out of {numFormatter.format(stats?.totalOrgs || 0)} total organizations
              </div>
            </div>

            {/* 3. Trial Orgs */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Trial Orgs
                </span>
                <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Clock className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.trialOrgs || 0)}
              </div>
              <div className="mt-2 text-xs text-amber-400/90">
                Evaluating CRM features on trial
              </div>
            </div>

            {/* 4. Suspended */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Suspended
                </span>
                <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                  <Ban className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.suspendedOrgs || 0)}
              </div>
              <div className="mt-2 text-xs text-rose-400/80">
                Deactivated / expired tenants
              </div>
            </div>

            {/* 5. Users */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Users
                </span>
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.totalUsers || 0)}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Staff & telecallers across orgs
              </div>
            </div>

            {/* 6. Calls */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Calls
                </span>
                <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <PhoneCall className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.totalCalls || 0)}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Logged & tracked telecaller calls
              </div>
            </div>

            {/* 7. Leads */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Leads
                </span>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <UserCheck className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.totalLeads || 0)}
              </div>
              <div className="mt-2 text-xs text-slate-400">
                Managed in active pipelines
              </div>
            </div>

            {/* 8. Storage (GB) */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Storage (GB)
                </span>
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <HardDrive className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {formatStorageGB(stats?.totalStorageUsedBytes || 0)}
              </div>
              <div className="mt-2 text-xs text-cyan-400/90">
                Audio recordings & media stored
              </div>
            </div>

            {/* 9. New This Month */}
            <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 shadow-lg shadow-black/20 hover:border-slate-700 transition">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  New This Month
                </span>
                <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Sparkles className="w-4 h-4" />
                </div>
              </div>
              <div className="text-3xl font-extrabold text-white tracking-tight">
                {numFormatter.format(stats?.newOrgsThisMonth || 0)}
              </div>
              <div className="mt-2 text-xs text-violet-400/90">
                Registered tenants in current cycle
              </div>
            </div>
          </>
        )}
      </div>

      {/* Quick Action Navigation Panels */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
        <Link
          href="/superadmin/organizations"
          className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-blue-500/50 hover:bg-slate-900 transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 text-blue-400 flex items-center justify-center group-hover:scale-105 transition">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-blue-400 transition">
                Organizations Manager
              </div>
              <div className="text-xs text-slate-400">Manage subscriptions, limits & lifecycle</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          href="/superadmin/billing"
          className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900 transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition">
              <IndianRupee className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-emerald-400 transition">
                Billing & Plans
              </div>
              <div className="text-xs text-slate-400">View invoices & modify tier pricing</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </Link>

        <Link
          href="/superadmin/storage"
          className="group p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-cyan-500/50 hover:bg-slate-900 transition flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-600/10 text-cyan-400 flex items-center justify-center group-hover:scale-105 transition">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white group-hover:text-cyan-400 transition">
                Storage Allocation
              </div>
              <div className="text-xs text-slate-400">Monitor quotas, Google Drive & R2</div>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition" />
        </Link>
      </div>
    </div>
  );
}
