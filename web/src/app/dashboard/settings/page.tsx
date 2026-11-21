'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  User,
  Shield,
  Building,
  Edit3,
  CalendarOff,
  QrCode,
  Plus,
  X,
  Loader2,
  Smartphone,
  RefreshCw,
  Copy,
  Check,
  List,
  GitFork,
  PhoneCall,
  Package,
  Search,
  RotateCcw,
  Trash2,
  CheckCircle2,
  Eye,
  EyeOff,
  Lock,
  HardDrive,
  Zap,
  ExternalLink,
  Cloud,
  CloudOff,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { fetchWithAuth, API_BASE } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Toast } from '@/components/ui';

type NavSection =
  | 'profile'
  | 'team'
  | 'storage'
  | 'security'
  | 'lead-fields'
  | 'lead-stages'
  | 'call-dispositions'
  | 'revenue-products';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isOnLeave: boolean;
  deviceToken: string | null;
  devices: Array<{ id: string; deviceName: string | null; lastSyncAt: string | null; batteryLevel: number | null }>;
}

export default function SettingsPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, org, refreshUser } = useAuth();
  const isAgent = user?.role === 'AGENT';

  const [activeSection, setActiveSection] = useState<NavSection>('profile');

  useEffect(() => {
    if (isAgent && activeSection !== 'profile') {
      setActiveSection('profile');
    }
  }, [isAgent, activeSection]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Customization States
  const [customData, setCustomData] = useState<any>(null);
  const [loadingCustom, setLoadingCustom] = useState(false);

  // New product input
  const [newProductName, setNewProductName] = useState('');
  const [newStageName, setNewStageName] = useState('');
  const [newReasonName, setNewReasonName] = useState('');
  const [newDispositionName, setNewDispositionName] = useState('');
  const [dispositionCategory, setDispositionCategory] = useState<'connected' | 'notConnected'>('connected');

  // Lead Fields Search
  const [fieldSearch, setFieldSearch] = useState('');

  // Google Drive Storage States
  const [gdriveStatus, setGdriveStatus] = useState<any>(null);
  const [gdriveLoading, setGdriveLoading] = useState(false);
  const [connectingDrive, setConnectingDrive] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // Handle URL tab and OAuth return params
  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab && ['profile', 'team', 'storage', 'security', 'lead-fields', 'lead-stages', 'call-dispositions', 'revenue-products'].includes(tab)) {
      setActiveSection(tab as NavSection);
    }

    if (searchParams.get('gdrive') === 'connected') {
      setToast({ message: '🎉 Google Drive connected successfully! Call recordings will now automatically upload to your Google Drive.', type: 'success' });
      setActiveSection('storage');
    } else if (searchParams.get('error')) {
      setToast({ message: `Google Drive connection error: ${searchParams.get('error')}`, type: 'error' });
      setActiveSection('storage');
    }
  }, [searchParams]);

  const loadGDriveStatus = useCallback(async () => {
    setGdriveLoading(true);
    try {
      const data = await fetchWithAuth('/integrations/gdrive/status');
      setGdriveStatus(data);
    } catch (err) {
      console.error('Failed to load GDrive status:', err);
    } finally {
      setGdriveLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'storage') {
      loadGDriveStatus();
    }
  }, [activeSection, loadGDriveStatus]);

  const handleConnectGDrive = async () => {
    setConnectingDrive(true);
    try {
      const data = await fetchWithAuth('/integrations/gdrive/auth-url');
      if (data.url) {
        window.location.href = data.url;
      } else {
        setToast({ message: 'Failed to generate Google Drive authorization link.', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error connecting to Google Drive', type: 'error' });
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleSimulateGDrive = async () => {
    setConnectingDrive(true);
    try {
      const res = await fetchWithAuth('/integrations/gdrive/simulate-connect', {
        method: 'POST',
        body: JSON.stringify({ email: user?.email || 'mycompany@gmail.com' }),
      });
      setToast({ message: '🎉 ' + (res.message || 'Google Drive connected (Dev Simulation Mode)!'), type: 'success' });
      loadGDriveStatus();
      refreshUser();
    } catch (err: any) {
      setToast({ message: err.message || 'Simulation failed', type: 'error' });
    } finally {
      setConnectingDrive(false);
    }
  };

  const handleDisconnectGDrive = async () => {
    try {
      await fetchWithAuth('/integrations/gdrive/disconnect', { method: 'POST' });
      setToast({ message: 'Google Drive has been disconnected.', type: 'info' });
      setShowDisconnectModal(false);
      loadGDriveStatus();
      refreshUser();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to disconnect', type: 'error' });
    }
  };

  const handleSelectStorageDestination = async (destination: 'PLATFORM' | 'OWN_GDRIVE') => {
    try {
      const res = await fetchWithAuth('/integrations/gdrive/destination', {
        method: 'POST',
        body: JSON.stringify({ destination }),
      });
      setToast({ message: res.message || 'Storage destination updated!', type: 'success' });
      loadGDriveStatus();
      refreshUser();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to update storage destination', type: 'error' });
    }
  };

  const loadCustomizations = useCallback(async () => {
    setLoadingCustom(true);
    try {
      const data = await fetchWithAuth('/settings');
      setCustomData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const data = await fetchWithAuth('/team');
      setTeam(Array.isArray(data) ? data : data?.members || []);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustomizations();
    if (activeSection === 'team') loadTeam();
  }, [activeSection, loadCustomizations, loadTeam]);

  const toggleLeave = async () => {
    try {
      const data = await fetchWithAuth('/settings/availability', { method: 'POST', body: '{}' });
      await refreshUser();
      setToast({ message: data.isOnLeave ? 'You are marked On Leave. Leads will skip you.' : 'Welcome back! You are now available for leads.', type: 'info' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Add Product
  const handleAddProduct = async () => {
    if (!newProductName.trim()) return;
    const currentProducts = customData?.products || [];
    const updated = [...currentProducts, { id: `prod_${Date.now()}`, name: newProductName.trim(), usedCount: 0 }];
    try {
      await fetchWithAuth('/settings/products', { method: 'PUT', body: JSON.stringify({ products: updated }) });
      setCustomData({ ...customData, products: updated });
      setNewProductName('');
      setToast({ message: 'Product added!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Delete Product
  const handleDeleteProduct = async (id: string) => {
    const updated = (customData?.products || []).filter((p: any) => p.id !== id);
    try {
      await fetchWithAuth('/settings/products', { method: 'PUT', body: JSON.stringify({ products: updated }) });
      setCustomData({ ...customData, products: updated });
      setToast({ message: 'Product removed', type: 'info' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Add Active Stage
  const handleAddStage = async () => {
    if (!newStageName.trim()) return;
    const currentStages = customData?.leadStages || {};
    const updatedStages = {
      ...currentStages,
      activeStages: [...(currentStages.activeStages || []), { name: newStageName.trim(), leadsCount: 0 }],
    };
    try {
      await fetchWithAuth('/settings/lead-stages', { method: 'PUT', body: JSON.stringify({ leadStages: updatedStages }) });
      setCustomData({ ...customData, leadStages: updatedStages });
      setNewStageName('');
      setToast({ message: 'Pipeline stage added!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Add Lost Reason
  const handleAddLostReason = async () => {
    if (!newReasonName.trim()) return;
    const currentStages = customData?.leadStages || {};
    const updatedStages = {
      ...currentStages,
      lostReasons: [...(currentStages.lostReasons || []), newReasonName.trim()],
    };
    try {
      await fetchWithAuth('/settings/lead-stages', { method: 'PUT', body: JSON.stringify({ leadStages: updatedStages }) });
      setCustomData({ ...customData, leadStages: updatedStages });
      setNewReasonName('');
      setToast({ message: 'Lost reason added!', type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  // Restore Archived Disposition
  const handleRestoreDisposition = async (arcItem: any) => {
    const disp = customData?.callDispositions || {};
    const targetKey = arcItem.category === 'NOT_CONNECTED' ? 'notConnected' : 'connected';
    const updatedDisp = {
      ...disp,
      [targetKey]: [...(disp[targetKey] || []), { id: arcItem.id, name: arcItem.name, isDefault: false }],
      archived: (disp.archived || []).filter((a: any) => a.id !== arcItem.id),
    };
    try {
      await fetchWithAuth('/settings/call-dispositions', { method: 'PUT', body: JSON.stringify({ callDispositions: updatedDisp }) });
      setCustomData({ ...customData, callDispositions: updatedDisp });
      setToast({ message: `Restored outcome: ${arcItem.name}`, type: 'success' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* ─── Settings Sidebar matching Screenshot 10 ─── */}
        <aside className="w-full md:w-56 shrink-0 space-y-6">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Settings</h1>
          </div>

          <div className="space-y-4 text-xs font-semibold">
            {/* Account Group */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block">
                Account
              </span>
              <button
                onClick={() => setActiveSection('profile')}
                className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                  activeSection === 'profile' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>Profile</span>
              </button>

              {!isAgent && (
                <>
                  <button
                    onClick={() => setActiveSection('team')}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                      activeSection === 'team' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Users & Devices</span>
                  </button>
                  <button
                    onClick={() => setActiveSection('storage')}
                    className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                      activeSection === 'storage' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    <span>Google Drive Storage</span>
                  </button>
                </>
              )}
            </div>

            {/* Customization Group matching Screenshots 10-14 (Admins only) */}
            {!isAgent && (
              <div className="space-y-1 pt-3 border-t border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 block">
                  Customization
                </span>

                <button
                  onClick={() => setActiveSection('lead-fields')}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                    activeSection === 'lead-fields' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Lead Fields</span>
                </button>

                <button
                  onClick={() => setActiveSection('lead-stages')}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                    activeSection === 'lead-stages' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <GitFork className="w-3.5 h-3.5" />
                  <span>Lead Stages</span>
                </button>

                <button
                  onClick={() => setActiveSection('call-dispositions')}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                    activeSection === 'call-dispositions' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <PhoneCall className="w-3.5 h-3.5" />
                  <span>Call Dispositions</span>
                </button>

                <button
                  onClick={() => setActiveSection('revenue-products')}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center gap-2.5 transition ${
                    activeSection === 'revenue-products' ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>Products</span>
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* ─── Main Content Viewport ─── */}
        <main className="flex-1 min-w-0 space-y-6">
          {/* 1. PROFILE SECTION matching Screenshot 10 */}
          {activeSection === 'profile' && (
            <div className="space-y-6">
              {/* Profile Card */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-blue-600 text-white font-black text-xl flex items-center justify-center shadow-md">
                    {user?.name?.[0] || 'A'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{user?.name}</h2>
                      <span className="px-2 py-0.5 rounded-md bg-blue-100 text-blue-700 text-[10px] font-bold uppercase">
                        {user?.role}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {org?.name} · {user?.email}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <a
                    href="/downloads/staffcaller.apk"
                    download="staffcaller.apk"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Install StaffCaller App</span>
                  </a>
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Active</span>
                  </span>
                </div>
              </div>

              {/* Personal Details */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="text-sm font-bold text-slate-800">Personal Details</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Full Name</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800">
                      {user?.name}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Work Email</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono text-slate-700">
                      {user?.email}
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 font-semibold uppercase text-[10px] block mb-1">Role</label>
                    <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-700">
                      {user?.role}
                    </div>
                  </div>
                </div>
              </div>

              {/* Availability Box matching Screenshot 10 */}
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Availability</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Mark the days you are away and new leads will skip you. Your existing leads and reminders are not affected.
                    </p>
                  </div>

                  <button
                    onClick={toggleLeave}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold transition ${
                      user?.isOnLeave
                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {user?.isOnLeave ? 'On Leave (Click to resume)' : 'Mark leave'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 2. LEAD FIELDS SECTION matching Screenshot 11 */}
          {activeSection === 'lead-fields' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Lead Fields</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure default, location, acquisition, and custom attributes captured on leads.
                  </p>
                </div>

                <button
                  onClick={() => setToast({ message: 'Custom CRM field modal opened', type: 'info' })}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Create CRM Field</span>
                </button>
              </div>

              {/* Table of Fields by Category */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100">
                {/* DEFAULT CATEGORY */}
                <div className="p-4 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  DEFAULT (7)
                </div>
                {[
                  { name: 'Full Name', type: 'text' },
                  { name: 'Primary Email', type: 'email' },
                  { name: 'Primary Phone', type: 'phone' },
                  { name: 'Alternate Phone', type: 'phone' },
                  { name: 'Company', type: 'text' },
                  { name: 'Job Title', type: 'text' },
                  { name: 'Lead Source', type: 'select' },
                ].map((f) => (
                  <div key={f.name} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition text-xs">
                    <span className="font-bold text-slate-800">{f.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">
                        {f.type}
                      </span>
                      <span className="text-blue-600 font-semibold cursor-pointer hover:underline">Edit</span>
                    </div>
                  </div>
                ))}

                {/* LOCATION CATEGORY */}
                <div className="p-4 bg-slate-50/70 text-xs font-bold text-slate-600 uppercase tracking-wider">
                  LOCATION (6)
                </div>
                {['Country', 'State / Province', 'City', 'Street Address', 'Street Address Line 2', 'Postal / Zip Code'].map(
                  (loc) => (
                    <div key={loc} className="p-4 flex items-center justify-between hover:bg-slate-50/60 transition text-xs">
                      <span className="font-semibold text-slate-700">{loc}</span>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-500 font-mono text-[10px]">text</span>
                    </div>
                  )
                )}
              </div>
            </div>
          )}

          {/* 3. LEAD STAGES KANBAN CONFIG matching Screenshot 12 */}
          {activeSection === 'lead-stages' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lead Stages</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Organize leads from first touch to closed. Moves synchronize automatically with the Companion App.
                </p>
              </div>

              {/* 3-Column Layout matching Screenshot 12 */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Col 1: Initial Stage */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase">
                      Initial Stage
                    </span>
                    <p className="text-xs text-slate-500 mt-1">New leads enter this stage by default.</p>
                  </div>

                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-900">Fresh</span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 font-semibold text-[10px]">
                      Default · 2 leads
                    </span>
                  </div>
                </div>

                {/* Col 2: Active Stages */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold uppercase">
                        Active Stages (8)
                      </span>
                      <p className="text-xs text-slate-500 mt-1">For leads currently being worked on.</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add stage..."
                      value={newStageName}
                      onChange={(e) => setNewStageName(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none"
                    />
                    <button
                      onClick={handleAddStage}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-bold"
                    >
                      + Add
                    </button>
                  </div>

                  <div className="space-y-2">
                    {(customData?.leadStages?.activeStages || []).map((stg: any) => (
                      <div
                        key={stg.name}
                        className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/90 flex items-center justify-between text-xs font-semibold text-slate-800"
                      >
                        <span>{stg.name}</span>
                        <span className="text-[10px] text-slate-400">{stg.leadsCount} lead</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Col 3: Closed Stages & Lost Reasons */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                  <div>
                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                      Closed Stages
                    </span>
                    <p className="text-xs text-slate-500 mt-1">Removed from active sales pipeline.</p>
                  </div>

                  <div className="space-y-2">
                    <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-emerald-800">
                      <span>Won</span>
                      <span className="text-[10px]">2 leads</span>
                    </div>

                    <div className="p-3 bg-rose-50/70 border border-rose-200 rounded-xl flex items-center justify-between text-xs font-bold text-rose-800">
                      <span>Lost</span>
                      <span className="text-[10px]">1 lead</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Reasons for Lost Leads
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Add lost reason..."
                        value={newReasonName}
                        onChange={(e) => setNewReasonName(e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border border-slate-200 rounded-xl focus:outline-none"
                      />
                      <button
                        onClick={handleAddLostReason}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold"
                      >
                        + Add
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {(customData?.leadStages?.lostReasons || []).map((r: string) => (
                        <div key={r} className="p-2 bg-slate-50 rounded-lg text-xs font-medium text-slate-700 border border-slate-100">
                          {r}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 4. CALL DISPOSITIONS matching Screenshot 13 */}
          {activeSection === 'call-dispositions' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-base font-bold text-slate-900">Call outcomes</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Your team picks an outcome for each call from the list below.
                  </p>
                </div>
                <div className="w-10 h-6 bg-blue-600 rounded-full flex items-center justify-end px-1 cursor-pointer">
                  <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
                </div>
              </div>

              {/* 2 Columns: Connected vs Not Connected matching Screenshot 13 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Connected */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Connected</h3>
                    <p className="text-xs text-slate-500">Outcomes for calls that reached the person.</p>
                  </div>

                  <div className="space-y-2">
                    {(customData?.callDispositions?.connected || []).map((c: any) => (
                      <div
                        key={c.id}
                        className="p-3 bg-emerald-50/50 border border-emerald-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span>{c.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal uppercase">Default</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Not connected */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800">Not connected</h3>
                    <p className="text-xs text-slate-500">Outcomes for calls that didn't reach the person.</p>
                  </div>

                  <div className="space-y-2">
                    {(customData?.callDispositions?.notConnected || []).map((nc: any) => (
                      <div
                        key={nc.id}
                        className="p-3 bg-blue-50/50 border border-blue-200 rounded-xl flex items-center justify-between text-xs font-bold text-slate-800"
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-blue-500" />
                          <span>{nc.name}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-normal uppercase">Default</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Archived Outcomes with Restore action matching Screenshot 13 */}
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-sm font-bold text-slate-800">Archived (15)</h3>
                <div className="divide-y divide-slate-100">
                  {(customData?.callDispositions?.archived || []).map((arc: any) => (
                    <div key={arc.id} className="py-2.5 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{arc.name}</span>
                      <button
                        onClick={() => handleRestoreDisposition(arc)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50 rounded-lg flex items-center gap-1 transition"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restore</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 5. PRODUCTS & SERVICES matching Screenshot 14 */}
          {activeSection === 'revenue-products' && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Products & Services</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Products reps choose from on Revenue Forecasts and closed deals.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    placeholder="Add a product or service (e.g. domain, server, maintenance)"
                    value={newProductName}
                    onChange={(e) => setNewProductName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddProduct()}
                    className="flex-1 px-4 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={handleAddProduct}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition"
                  >
                    + Add
                  </button>
                </div>

                <div className="divide-y divide-slate-100 pt-2">
                  {(customData?.products || []).map((p: any) => (
                    <div key={p.id} className="py-3 flex items-center justify-between text-xs">
                      <div>
                        <h4 className="font-bold text-slate-900">{p.name}</h4>
                        <span className="text-[11px] text-slate-400">
                          {p.usedCount > 0 ? `Used on ${p.usedCount} record` : 'Not used yet'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 6. USERS & DEVICES SECTION */}
          {activeSection === 'team' && (
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-slate-900">Users & Paired Devices</h2>
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs divide-y divide-slate-100 overflow-hidden">
                {team.map((m) => (
                  <div key={m.id} className="p-4 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 font-bold flex items-center justify-center">
                        {m.name[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">{m.name}</h4>
                        <span className="text-slate-500 font-mono text-[11px]">{m.email}</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 font-bold text-[10px] uppercase">
                      {m.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 7. GOOGLE DRIVE STORAGE SECTION (Phase 3: Client-Owned 15 GB Cloud Storage) */}
          {activeSection === 'storage' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Audio Storage & Google Drive</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Choose where your company call recordings are stored. You can use the CRM Platform Cloud Storage 
                  or link your own Google Drive (15 GB free from Google) so your recordings go directly to your personal Drive.
                </p>
              </div>

              {/* STORAGE DESTINATION SELECTOR */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <HardDrive className="w-4 h-4 text-blue-600" />
                    <span>Active Recording Destination</span>
                  </h3>
                  <span className="text-[11px] font-semibold text-slate-500">
                    Where incoming & outgoing call audios are saved
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                  {/* Option 1: Platform Cloud Storage */}
                  <div
                    onClick={() => handleSelectStorageDestination('PLATFORM')}
                    className={`p-4 rounded-xl border-2 transition cursor-pointer relative ${
                      gdriveStatus?.storageDestination === 'PLATFORM' || !gdriveStatus?.isUsingOwnGoogle
                        ? 'border-blue-600 bg-blue-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                          <Cloud className="w-5 h-5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">CRM Platform Storage</h4>
                          <span className="text-[11px] text-slate-500">Managed cloud pool</span>
                        </div>
                      </div>
                      {(gdriveStatus?.storageDestination === 'PLATFORM' || !gdriveStatus?.isUsingOwnGoogle) && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-600 text-white">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Uses your company plan quota granted by Super Admin. Recordings are safely stored in the platform cloud.
                    </p>
                  </div>

                  {/* Option 2: Client's Own Google Drive */}
                  <div
                    onClick={() => {
                      if (gdriveStatus?.isConnected) {
                        handleSelectStorageDestination('OWN_GDRIVE');
                      } else {
                        handleConnectGDrive();
                      }
                    }}
                    className={`p-4 rounded-xl border-2 transition cursor-pointer relative ${
                      gdriveStatus?.isUsingOwnGoogle
                        ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center shrink-0">
                          <svg className="w-5 h-5" viewBox="0 0 87.3 78">
                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                          </svg>
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-900">Your Google Drive</h4>
                          <span className="text-[11px] text-slate-500">
                            {gdriveStatus?.isConnected ? gdriveStatus.email : 'Not connected'}
                          </span>
                        </div>
                      </div>
                      {gdriveStatus?.isUsingOwnGoogle ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      ) : gdriveStatus?.isConnected ? (
                        <span className="text-[10px] font-semibold text-blue-600 hover:underline">
                          Switch to this
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-blue-600 hover:underline">
                          Connect now
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 mt-3 leading-relaxed">
                      Saves audio directly to your 15 GB Google Drive in <code className="text-slate-800 font-mono text-[10px]">CRM Call Recordings</code>. 100% private to you.
                    </p>
                  </div>
                </div>
              </div>

              {gdriveLoading ? (
                <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                  <span className="text-xs text-slate-500 font-medium">Checking Google Drive connection...</span>
                </div>
              ) : gdriveStatus?.isConnected ? (
                /* Connected State */
                <div className="space-y-6">
                  <div className="p-6 bg-gradient-to-br from-emerald-50/70 to-teal-50/50 rounded-2xl border border-emerald-200/80 shadow-xs">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-white shadow-xs border border-emerald-200/60 flex items-center justify-center shrink-0">
                          <svg className="w-8 h-8" viewBox="0 0 87.3 78">
                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                          </svg>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Connected & Syncing
                            </span>
                          </div>
                          <h3 className="text-base font-bold text-slate-900 mt-1">{gdriveStatus.email}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">
                            Connected on {new Date(gdriveStatus.connectedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowDisconnectModal(true)}
                        className="px-3.5 py-2 text-xs font-semibold text-rose-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-slate-200 rounded-xl transition shadow-2xs self-start sm:self-center"
                      >
                        Disconnect
                      </button>
                    </div>

                    {/* Real Live Google Account Storage Gauges */}
                    <div className="mt-6 pt-5 border-t border-emerald-200/60 space-y-4">
                      {/* Metric 1: Overall Google Account Storage (Drive + Gmail + Photos) */}
                      <div>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <Cloud className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Actual Google Account Storage</span>
                          </span>
                          <span className="font-mono text-slate-700 font-semibold">
                            {((gdriveStatus.googleTotalUsageBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB used / {((gdriveStatus.googleTotalLimitBytes || 15 * 1024 * 1024 * 1024) / (1024 * 1024 * 1024)).toFixed(0)} GB Total
                          </span>
                        </div>
                        <div className="w-full bg-emerald-200/50 rounded-full h-2.5 overflow-hidden">
                          <div
                            className="bg-emerald-600 h-2.5 rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(
                                2,
                                Math.min(
                                  100,
                                  ((gdriveStatus.googleTotalUsageBytes || 0) /
                                    Math.max(gdriveStatus.googleTotalLimitBytes || 1, 1)) *
                                    100
                                )
                              )}%`,
                            }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
                          <span>
                            Free Available in Google: <strong className="text-emerald-700 font-mono">{((gdriveStatus.googleAvailableBytes || 0) / (1024 * 1024 * 1024)).toFixed(2)} GB</strong>
                          </span>
                          <span>
                            {(((gdriveStatus.googleTotalUsageBytes || 0) /
                              Math.max(gdriveStatus.googleTotalLimitBytes || 1, 1)) *
                              100).toFixed(1)}% full
                          </span>
                        </div>
                      </div>

                      {/* Metric 2: CRM Call Recordings Portion */}
                      <div className="p-3 bg-white/70 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-emerald-600" />
                          <span className="text-slate-700">Space Consumed by CRM Audio Recordings:</span>
                        </div>
                        <strong className="text-slate-900 font-mono">
                          {((gdriveStatus.storageUsedBytes || 0) / (1024 * 1024)).toFixed(1)} MB
                        </strong>
                      </div>
                    </div>

                    {/* Destination Folder Link */}
                    {gdriveStatus.folderUrl && (
                      <div className="mt-4 flex items-center justify-between p-3 bg-white/80 rounded-xl border border-emerald-200/50 text-xs">
                        <div className="flex items-center gap-2">
                          <HardDrive className="w-4 h-4 text-emerald-600" />
                          <span className="font-medium text-slate-800">Folder: <strong>CRM Call Recordings</strong></span>
                        </div>
                        <a
                          href={gdriveStatus.folderUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 font-semibold"
                        >
                          <span>Open in Drive</span>
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* Disconnected State */
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-slate-100">
                    <div className="flex items-start gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
                        <svg className="w-8 h-8" viewBox="0 0 87.3 78">
                          <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                          <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                          <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
                          <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                          <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                          <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900">Connect Google Drive</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-lg">
                          Save all incoming and outgoing call recordings directly into your personal or company Google Drive.
                          You get 15 GB of cloud storage completely free from Google.
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleConnectGDrive}
                      disabled={connectingDrive}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shrink-0 shadow-xs cursor-pointer"
                    >
                      {connectingDrive ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Connecting...</span>
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" viewBox="0 0 87.3 78">
                            <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#fff"/>
                            <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#fff"/>
                            <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#fff"/>
                            <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#fff"/>
                            <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#fff"/>
                            <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#fff"/>
                          </svg>
                          <span>Connect Google Drive</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Warning if OAuth not yet configured in server .env */}
                  {!gdriveStatus?.isOAuthConfigured && (
                    <div className="p-4 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-bold text-amber-800">Google OAuth Credentials Required (Production)</div>
                          <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                            To enable live Google accounts, add <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">GOOGLE_OAUTH_CLIENT_ID</code> and <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">GOOGLE_OAUTH_CLIENT_SECRET</code> to <code className="bg-amber-100 px-1 py-0.5 rounded font-mono text-amber-900">server/.env</code>.
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleSimulateGDrive}
                        disabled={connectingDrive}
                        className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 self-start sm:self-auto"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Simulate Connect (Test Mode)</span>
                      </button>
                    </div>
                  )}

                  {/* Why Connect Google Drive */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold mb-2">
                        15G
                      </div>
                      <h4 className="font-bold text-slate-800">15 GB Free Storage</h4>
                      <p className="text-slate-500 mt-1 text-[11px]">
                        Save up to 30,000–50,000 minutes of call recordings without paying for hosting.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold mb-2">
                        📱
                      </div>
                      <h4 className="font-bold text-slate-800">Access Anywhere</h4>
                      <p className="text-slate-500 mt-1 text-[11px]">
                        Search and listen to recordings on the Google Drive app on your phone or computer.
                      </p>
                    </div>

                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold mb-2">
                        🔒
                      </div>
                      <h4 className="font-bold text-slate-800">100% Private</h4>
                      <p className="text-slate-500 mt-1 text-[11px]">
                        Audio files are saved directly in your company Google Drive. You own all your data.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Disconnect Modal */}
              {showDisconnectModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
                  <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
                    <div className="flex items-center gap-3 text-rose-600">
                      <AlertTriangle className="w-6 h-6 shrink-0" />
                      <h3 className="text-base font-bold text-slate-900">Disconnect Google Drive?</h3>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">
                      Are you sure you want to disconnect Google Drive? Existing recordings in your Google Drive will stay safe, but future recordings will be stored on the default server storage.
                    </p>
                    <div className="flex items-center justify-end gap-3 pt-2">
                      <button
                        onClick={() => setShowDisconnectModal(false)}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleDisconnectGDrive}
                        className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-xl"
                      >
                        Yes, Disconnect
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
