'use client';

import React, { useState, useEffect } from 'react';
import {
  HardDrive,
  Database,
  Cloud,
  Building2,
  RefreshCw,
  PhoneCall,
  Server,
  Edit2,
  Check,
  X,
  Loader2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Unlink,
  Trash2,
  Layers,
  Plus,
} from 'lucide-react';
import { fetchSaasApi } from '@/lib/saas-api';

interface MasterAccount {
  id: string;
  email: string;
  name: string;
  status: string;
  priority: number;
  folderId: string | null;
  folderUrl: string | null;
  totalLimitBytes: number;
  totalUsageBytes: number;
  availableBytes: number;
  connectedAt: string;
}

interface MasterDriveStatus {
  isConnected: boolean;
  isOAuthConfigured: boolean;
  email: string | null;
  folderId: string | null;
  folderUrl: string | null;
  connectedAt: string | null;
  totalLimitBytes: number;
  totalUsageBytes: number;
  availableBytes: number;
  accountsCount?: number;
  accounts?: MasterAccount[];
}

interface TopOrg {
  id: string;
  name: string;
  slug: string;
  orgStatus: string;
  planTier: string;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  orgStorageDriver: string;
  gdriveEmail?: string | null;
  _count?: {
    calls: number;
  };
}

interface StorageOverview {
  totalStorageUsedBytes: number;
  totalStorageQuotaBytes: number;
  totalOrganizations: number;
  topOrganizations: TopOrg[];
}

export default function SuperAdminStoragePage() {
  const [data, setData] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);

  // Master 5 TB Google Drive Pool State
  const [masterStatus, setMasterStatus] = useState<MasterDriveStatus | null>(null);
  const [loadingMaster, setLoadingMaster] = useState(false);
  const [connectingMaster, setConnectingMaster] = useState(false);
  const [disconnectingMaster, setDisconnectingMaster] = useState(false);

  // Edit Quota Modal state
  const [editingOrg, setEditingOrg] = useState<TopOrg | null>(null);
  const [quotaGB, setQuotaGB] = useState<number>(15);
  const [savingQuota, setSavingQuota] = useState(false);
  const [quotaToast, setQuotaToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadMasterStatus = async () => {
    try {
      setLoadingMaster(true);
      const res = await fetchSaasApi<MasterDriveStatus>('/storage/master-status');
      setMasterStatus(res);
    } catch (err) {
      console.error('Failed to load master drive status:', err);
    } finally {
      setLoadingMaster(false);
    }
  };

  const loadStorage = async () => {
    try {
      setLoading(true);
      const res = await fetchSaasApi<StorageOverview>('/storage/overview');
      setData(res);
    } catch (err) {
      console.error('Failed to load storage data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStorage();
    loadMasterStatus();

    // Check query params for master connect outcome
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('master') === 'connected') {
        setQuotaToast({
          message: 'Master Google Drive (5 TB) pool successfully connected and ready for tenant audio storage!',
          type: 'success',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      } else if (urlParams.get('error')) {
        setQuotaToast({
          message: `Google authorization failed: ${urlParams.get('error')}`,
          type: 'error',
        });
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleConnectMaster = async () => {
    try {
      setConnectingMaster(true);
      const res = await fetchSaasApi<{ url: string; isConfigured: boolean }>('/storage/master-auth-url');
      if (res?.url) {
        window.location.href = res.url;
      }
    } catch (err: any) {
      setQuotaToast({
        message: err.message || 'Failed to start Google Drive authentication.',
        type: 'error',
      });
      setConnectingMaster(false);
    }
  };

  const handleDisconnectAccount = async (account: MasterAccount) => {
    if (!confirm(`Are you sure you want to disconnect storage account ${account.email}? Recordings stored in it remain safe on Google Drive.`)) {
      return;
    }
    try {
      await fetchSaasApi(`/storage/master-accounts/${account.id}`, { method: 'DELETE' });
      setQuotaToast({
        message: `Storage account ${account.email} has been disconnected.`,
        type: 'success',
      });
      loadMasterStatus();
    } catch (err: any) {
      setQuotaToast({
        message: err.message || 'Failed to disconnect account.',
        type: 'error',
      });
    }
  };

  const handleDisconnectMaster = async () => {
    if (!confirm('Are you sure you want to disconnect all Master Google Drive storage accounts? Recordings will fall back to local disk storage.')) {
      return;
    }
    try {
      setDisconnectingMaster(true);
      await fetchSaasApi('/storage/master-disconnect', { method: 'POST' });
      setQuotaToast({
        message: 'All Master Google Drive accounts have been disconnected.',
        type: 'success',
      });
      loadMasterStatus();
    } catch (err: any) {
      setQuotaToast({
        message: err.message || 'Failed to disconnect master Google Drive.',
        type: 'error',
      });
    } finally {
      setDisconnectingMaster(false);
    }
  };

  const handleSaveQuota = async () => {
    if (!editingOrg) return;
    try {
      setSavingQuota(true);
      const bytes = Math.round(quotaGB * 1024 * 1024 * 1024);
      await fetchSaasApi(`/storage/organizations/${editingOrg.id}/quota`, {
        method: 'PUT',
        body: JSON.stringify({ storageQuotaBytes: bytes }),
      });
      setQuotaToast({ message: `Storage quota for "${editingOrg.name}" updated to ${quotaGB} GB.`, type: 'success' });
      setEditingOrg(null);
      loadStorage();
    } catch (err: any) {
      setQuotaToast({ message: err.message || 'Failed to update storage quota.', type: 'error' });
    } finally {
      setSavingQuota(false);
    }
  };

  const formatBytes = (bytes = 0) => {
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb < 0.05 && bytes > 0) {
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${gb.toFixed(2)} GB`;
  };

  const usedBytes = data?.totalStorageUsedBytes || 0;
  const quotaBytes = Math.max(data?.totalStorageQuotaBytes || 1, 1);
  const usedPercentage = Math.min(Math.round((usedBytes / quotaBytes) * 100), 100);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Storage Infrastructure Overview</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Monitor call recordings, media storage consumption, and cloud storage drivers.
          </p>
        </div>

        <button
          onClick={() => {
            loadStorage();
            loadMasterStatus();
          }}
          disabled={loading || loadingMaster}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading || loadingMaster ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Quota Toast Alert */}
      {quotaToast && (
        <div
          className={`flex items-center justify-between p-4 rounded-xl border text-sm ${
            quotaToast.type === 'success'
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {quotaToast.type === 'success' ? (
              <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            )}
            <span>{quotaToast.message}</span>
          </div>
          <button
            onClick={() => setQuotaToast(null)}
            className="text-slate-400 hover:text-white ml-4"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Master Google Drive Storage Pool Status Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/20 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 relative z-10">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 flex-shrink-0">
              <Layers className="w-6 h-6" />
            </div>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white">
                  Platform Master Cloud Storage Cluster
                </h2>
                {masterStatus?.isConnected ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Cluster Active ({masterStatus.accounts?.length || 1} {masterStatus.accounts?.length === 1 ? 'Account' : 'Accounts'})
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Not Connected
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-400 mt-1.5 max-w-2xl leading-relaxed">
                Connect multiple Google accounts to create a multi-terabyte aggregated storage cluster. 
                Recordings automatically balance across your accounts with auto-spillover when an account gets full.
              </p>

              {masterStatus?.isConnected && (
                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                  {/* Total Combined Cluster Storage */}
                  <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700">
                    <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Total Cluster Capacity:</span>
                    <strong className="text-white ml-1 font-mono">
                      {(masterStatus.totalLimitBytes / (1024 * 1024 * 1024)).toFixed(0)} GB ({(masterStatus.totalLimitBytes / (1024 * 1024 * 1024 * 1024)).toFixed(1)} TB)
                    </strong>
                  </span>

                  <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700">
                    <Database className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Total Free Available:</span>
                    <strong className="text-emerald-400 ml-1 font-mono">
                      {(masterStatus.availableBytes / (1024 * 1024 * 1024)).toFixed(1)} GB
                    </strong>
                  </span>

                  <span className="flex items-center gap-1.5 text-slate-300 bg-slate-800/70 px-3 py-1.5 rounded-xl border border-slate-700">
                    <span>Cluster Used:</span>
                    <strong className="text-amber-400 ml-1 font-mono">
                      {(masterStatus.totalUsageBytes / (1024 * 1024 * 1024)).toFixed(2)} GB
                    </strong>
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 self-start lg:self-center flex-shrink-0">
            <button
              onClick={handleConnectMaster}
              disabled={connectingMaster}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-wide shadow-lg shadow-indigo-600/30 hover:shadow-indigo-600/50 transition transform hover:-translate-y-0.5 disabled:opacity-50"
            >
              {connectingMaster ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span>+ Connect Another Account</span>
            </button>
          </div>
        </div>

        {/* List of Connected Master Accounts */}
        {masterStatus?.accounts && masterStatus.accounts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Cloud className="w-3.5 h-3.5 text-indigo-400" />
              <span>Connected Master Storage Accounts ({masterStatus.accounts.length})</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {masterStatus.accounts.map((acc, index) => {
                const usedGB = (acc.totalUsageBytes / (1024 * 1024 * 1024)).toFixed(1);
                const limitGB = (acc.totalLimitBytes / (1024 * 1024 * 1024)).toFixed(0);
                const pct = Math.min(
                  Math.round((acc.totalUsageBytes / Math.max(acc.totalLimitBytes, 1)) * 100),
                  100
                );

                return (
                  <div
                    key={acc.id}
                    className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-xs truncate">
                          {acc.email}
                        </span>
                        {index === 0 ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Primary
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                            Pool #{index + 1}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                        <span>{usedGB} GB / {limitGB} GB used</span>
                        <span className="text-slate-500">{pct}%</span>
                      </div>

                      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {acc.folderUrl && (
                        <a
                          href={acc.folderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Open Master Folder in Drive"
                          className="p-2 rounded-lg bg-slate-850 hover:bg-slate-800 text-indigo-400 hover:text-indigo-300 border border-slate-700 transition"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}

                      <button
                        onClick={() => handleDisconnectAccount(acc)}
                        title="Disconnect this account"
                        className="p-2 rounded-lg bg-slate-850 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 border border-slate-700 hover:border-rose-500/40 transition"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Aggregate Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Total Storage Consumed
            </span>
            <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatBytes(usedBytes)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Across {data?.totalOrganizations || 0} tenant organizations
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Allocated Quotas
            </span>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Database className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {formatBytes(quotaBytes)}
          </div>
          <div className="mt-2 text-xs text-slate-400">
            Total quota granted across plans
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Overall Utilization
            </span>
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Server className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-white tracking-tight">
            {usedPercentage}%
          </div>
          <div className="w-full h-1.5 bg-slate-800 rounded-full mt-3 overflow-hidden">
            <div
              className="h-full bg-cyan-500 rounded-full transition-all duration-300"
              style={{ width: `${usedPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Top Consumers Table */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-cyan-400" />
            <h2 className="text-base font-semibold text-white">Top Storage Consumers</h2>
          </div>
          <span className="text-xs text-slate-400">Ranked by volume</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-5">Organization</th>
                <th className="py-3.5 px-5">Driver</th>
                <th className="py-3.5 px-5">Total Calls</th>
                <th className="py-3.5 px-5 min-w-[200px]">Storage Used / Quota</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-32" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-20" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-16" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-36" />
                    </td>
                    <td className="py-4 px-5">
                      <div className="h-4 bg-slate-800 rounded w-16" />
                    </td>
                    <td className="py-4 px-5 text-right">
                      <div className="h-4 bg-slate-800 rounded w-16 ml-auto" />
                    </td>
                  </tr>
                ))
              ) : (data?.topOrganizations || []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    <HardDrive className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No storage consumption data available yet.</p>
                  </td>
                </tr>
              ) : (
                data?.topOrganizations.map((org) => {
                  const pct = Math.min(
                    Math.round(
                      (Number(org.storageUsedBytes) / Math.max(Number(org.storageQuotaBytes), 1)) *
                        100
                    ),
                    100
                  );

                  return (
                    <tr key={org.id} className="hover:bg-slate-850/40">
                      <td className="py-4 px-5">
                        <div className="font-semibold text-white">{org.name}</div>
                        <div className="text-xs text-slate-500">@{org.slug}</div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 text-slate-300 border border-slate-700">
                          {org.orgStorageDriver === 'gdrive_oauth'
                            ? 'Google Drive'
                            : org.orgStorageDriver === 'r2'
                            ? 'Cloudflare R2'
                            : 'Local Storage'}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-slate-200">
                        {org._count?.calls?.toLocaleString() || 0}
                      </td>

                      <td className="py-4 px-5">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="font-medium text-slate-300">
                            {formatBytes(org.storageUsedBytes)}
                          </span>
                          <span className="text-slate-500">
                            / {formatBytes(org.storageQuotaBytes)}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              pct > 85 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-cyan-500'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>

                      <td className="py-4 px-5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-800 text-slate-300">
                          {org.orgStatus}
                        </span>
                      </td>

                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={() => {
                            setEditingOrg(org);
                            setQuotaGB(Math.max(1, Math.round(Number(org.storageQuotaBytes) / (1024 * 1024 * 1024))));
                          }}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 hover:text-cyan-300 border border-slate-700 transition"
                        >
                          Edit Quota
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Quota Modal */}
      {editingOrg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <HardDrive className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Adjust Storage Quota</h3>
                  <p className="text-xs text-slate-400">{editingOrg.name}</p>
                </div>
              </div>
              <button
                onClick={() => setEditingOrg(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-2">
                  Select Preset Quota (GB)
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
                  Or Custom Quota (in Gigabytes)
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
                  Standard free plan comes with 15 GB. Additional storage can be allocated upon customer purchase.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingOrg(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveQuota}
                disabled={savingQuota}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-950 bg-cyan-400 hover:bg-cyan-300 disabled:opacity-50 transition flex items-center gap-1.5"
              >
                {savingQuota ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Update Quota</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {quotaToast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl text-xs font-medium border ${
              quotaToast.type === 'success'
                ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800/80'
                : 'bg-rose-950/90 text-rose-200 border-rose-800/80'
            }`}
          >
            <span>{quotaToast.message}</span>
            <button
              onClick={() => setQuotaToast(null)}
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
