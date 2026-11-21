'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Phone,
  BarChart3,
  Settings,
  Users,
  Loader2,
  LogOut,
  Bell,
  Clock,
  LayoutDashboard,
  FileText,
  Plug,
  MessageSquare,
  Plus,
  Upload,
  Zap,
  ChevronDown,
  Moon,
  Smartphone,
  CheckCircle2,
  Check,
  CreditCard,
  AlertTriangle,
  Sparkles,
  HardDrive,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchWithAuth } from '@/lib/api';

interface NavItem {
  label: string;
  href: string;
  icon: any;
  isExternal?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard/admin', icon: LayoutDashboard },
  { label: 'All Leads', href: '/dashboard/leads', icon: Users },
  { label: 'Follow-ups', href: '/dashboard/follow-ups', icon: Clock },
  { label: 'Calls', href: '/dashboard/calls', icon: Phone },
  { label: 'WhatsApp', href: '/dashboard/whatsapp', icon: MessageSquare },
  { label: 'Reports', href: '/dashboard/reports', icon: BarChart3 },
  { label: 'Forms', href: '/dashboard/forms', icon: FileText },
  { label: 'Integrations', href: '/dashboard/integrations', icon: Plug },
  { label: 'Settings', href: '/dashboard/settings', icon: Settings },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, org, isLoading, logout } = useAuth();
  const [showAddMenu, setShowAddMenu] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  // Check if session is an impersonated support session
  const [isImpersonated, setIsImpersonated] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('crm_token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.isImpersonated) setIsImpersonated(true);
        } catch {}
      }
    }
  }, []);

  const isSuspended = org?.orgStatus === 'SUSPENDED';
  const isTrial = org?.orgStatus === 'TRIAL';
  const trialDaysRemaining = org?.trialEndsAt
    ? Math.max(0, Math.ceil((new Date(org.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 14;

  const usedBytes = Number(org?.storageUsedBytes || 0);
  const quotaBytes = Number(org?.storageQuotaBytes || 16106127360);
  const storageUsagePercent = quotaBytes > 0 ? Math.round((usedBytes / quotaBytes) * 100) : 0;
  const isStorageWarning = storageUsagePercent >= 85;

  // Follow-up Notification State
  const [followupNotifications, setFollowupNotifications] = useState<any[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  const loadFollowupNotifications = async () => {
    try {
      const res = await fetchWithAuth('/followups?timeFilter=today&status=open');
      if (res?.followups) {
        setFollowupNotifications(res.followups);
      }
    } catch (e) {
      // Ignore
    }
  };

  useEffect(() => {
    if (user) {
      loadFollowupNotifications();
      // Poll every 60 seconds for due followups
      const interval = setInterval(loadFollowupNotifications, 60000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Request browser notification permission once
  const requestDesktopNotification = () => {
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  };

  const handleCompleteFollowup = async (id: string) => {
    try {
      await fetchWithAuth(`/followups/${id}/complete`, { method: 'PATCH' });
      setFollowupNotifications((prev) => prev.filter((f) => f.id !== id));
    } catch (e) {
      console.error('Failed to complete followup', e);
    }
  };

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Close menus on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (addMenuRef.current && !addMenuRef.current.contains(event.target as Node)) {
        setShowAddMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) {
        setShowNotifMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f7f8fa]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
            <Phone className="w-5 h-5 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const currentPageLabel = (() => {
    const found = NAV_ITEMS.find((n) => pathname.startsWith(n.href));
    if (found) return found.label;
    const seg = pathname.split('/').filter(Boolean).pop() || '';
    return seg.replace(/-/g, ' ');
  })();

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-800">
      {/* ─── Left Sidebar matching Leadzam ─── */}
      <aside
        className="w-[68px] flex flex-col items-center justify-between py-3.5 select-none shrink-0 z-30 bg-white"
        style={{ borderRight: '1px solid #e2e8f0' }}
      >
        <div className="flex flex-col items-center gap-3.5 w-full">
          {/* Logo Brand Icon */}
          <Link
            href="/dashboard/admin"
            className="w-10 h-10 rounded-xl overflow-hidden flex items-center justify-center shadow-md shadow-blue-500/20 hover:scale-105 transition"
            title="StaffCaller Dashboard"
          >
            <img src="/logo.png" alt="StaffCaller" className="w-10 h-10 object-cover rounded-xl" />
          </Link>

          {/* + Add Lead Button with Dropdown Menu */}
          <div className="relative w-full px-2" ref={addMenuRef}>
            <button
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full h-10 rounded-xl bg-blue-600 text-white flex flex-col items-center justify-center text-[10px] font-bold shadow-sm hover:bg-blue-700 transition active:scale-95"
              title="Add a Lead"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span className="text-[9px] leading-none mt-0.5">Add</span>
            </button>

            {showAddMenu && (
              <div className="absolute left-[72px] top-0 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left animate-in fade-in zoom-in-95 duration-100">
                <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  Add a Lead
                </div>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    router.push('/dashboard/leads?action=add-single');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  <Users className="w-3.5 h-3.5 text-blue-600" />
                  <span>Add Single Lead</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    router.push('/dashboard/leads?action=bulk-upload');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  <Upload className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Bulk Upload (CSV / XLSX)</span>
                </button>
                <button
                  onClick={() => {
                    setShowAddMenu(false);
                    router.push('/dashboard/integrations');
                  }}
                  className="w-full px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-500" />
                  <span>Add from Integration</span>
                </button>
              </div>
            )}
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 w-full px-2 overflow-y-auto no-scrollbar max-h-[calc(100vh-220px)]">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = !item.isExternal && pathname.startsWith(item.href);

              if (item.isExternal) {
                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={item.label}
                    className="flex flex-col items-center justify-center py-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
                  >
                    <Icon className="w-5 h-5 mb-0.5 text-emerald-600" />
                    <span className="text-[9px] font-medium leading-tight">{item.label}</span>
                  </a>
                );
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`relative flex flex-col items-center justify-center py-2 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                  }`}
                >
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-blue-600 rounded-r-full" />
                  )}
                  <Icon className="w-5 h-5 mb-0.5" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="text-[9px] leading-tight">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Controls */}
        <div className="flex flex-col items-center gap-2.5 w-full px-2">
          <button
            onClick={logout}
            title="Sign out"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div
            title={`${user.name} (${user.role})`}
            className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-xs cursor-pointer select-none"
            onClick={() => router.push('/dashboard/settings')}
          >
            {initials}
          </div>
        </div>
      </aside>

      {/* ─── Main Workspace Area ─── */}
      <div className="flex-1 flex flex-col h-full overflow-hidden min-w-0">
        {/* Top Header matching reference screenshots */}
        <header
          className="h-[52px] px-6 flex items-center justify-between shrink-0 bg-white"
          style={{ borderBottom: '1px solid #e2e8f0' }}
        >
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-medium">{org?.name || 'Workspace'}</span>
            <span className="text-slate-300">›</span>
            <span className="font-semibold text-slate-800 capitalize">{currentPageLabel}</span>
          </div>

          {/* Right Status Actions */}
          <div className="flex items-center gap-2.5">
            {/* Trial Badge — Dynamic countdown */}
            {isTrial && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold border border-amber-200">
                <Clock className="w-3 h-3 text-amber-500" />
                <span>Trial {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} left</span>
              </span>
            )}

            {/* Download StaffCaller Android App Button */}
            <a
              href="/downloads/staffcaller.apk"
              download="staffcaller.apk"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-xs font-semibold border border-emerald-200 transition shadow-xs"
              title="Download StaffCaller Android APK"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
              <span>StaffCaller App</span>
            </a>

            {/* Interactive Follow-up Notifications Bell Popover */}
            <div className="relative" ref={notifMenuRef}>
              <button
                onClick={() => {
                  setShowNotifMenu(!showNotifMenu);
                  requestDesktopNotification();
                }}
                className="relative w-8 h-8 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                title="Follow-up Notifications"
              >
                <Bell className="w-4 h-4" />
                {followupNotifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center shadow-xs animate-pulse">
                    {followupNotifications.length}
                  </span>
                )}
              </button>

              {showNotifMenu && (
                <div className="absolute right-0 top-10 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden text-left animate-in fade-in zoom-in-95 duration-100">
                  {/* Popover Header */}
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">Follow-up Notifications</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-bold">
                        {followupNotifications.length} due
                      </span>
                    </div>
                    <Link
                      href="/dashboard/follow-ups"
                      onClick={() => setShowNotifMenu(false)}
                      className="text-[11px] font-semibold text-blue-600 hover:underline"
                    >
                      View all
                    </Link>
                  </div>

                  {/* Notifications List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                    {followupNotifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-slate-400">
                        <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2 opacity-80" />
                        <p className="font-medium text-slate-700">All caught up!</p>
                        <p className="mt-0.5">No pending follow-ups due today.</p>
                      </div>
                    ) : (
                      followupNotifications.map((item) => {
                        const schedDate = item.scheduledAt ? new Date(item.scheduledAt) : new Date();
                        const isOverdue = schedDate < new Date();
                        const timeStr = schedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                        return (
                          <div key={item.id} className="p-3.5 hover:bg-slate-50 transition flex items-start gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isOverdue ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
                            }`}>
                              <Clock className="w-4 h-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1">
                                <Link
                                  href={`/dashboard/leads`}
                                  onClick={() => setShowNotifMenu(false)}
                                  className="text-xs font-bold text-slate-900 truncate hover:text-blue-600"
                                >
                                  {item.lead?.fullName || item.lead?.phone || 'Lead'}
                                </Link>
                                <span className={`text-[10px] font-semibold shrink-0 ${
                                  isOverdue ? 'text-rose-600' : 'text-amber-600'
                                }`}>
                                  {isOverdue ? 'Overdue' : timeStr}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-600 truncate mt-0.5">
                                {item.title || 'Scheduled phone call'}
                              </p>

                              <div className="mt-2 flex items-center gap-2">
                                <a
                                  href={`tel:${item.lead?.phone}`}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 text-[10px] font-bold transition"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span>Call</span>
                                </a>

                                <button
                                  type="button"
                                  onClick={() => handleCompleteFollowup(item.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 text-[10px] font-bold transition"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Done</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Popover Footer */}
                  <div className="p-2 border-t border-slate-100 bg-slate-50 text-center">
                    <Link
                      href="/dashboard/follow-ups"
                      onClick={() => setShowNotifMenu(false)}
                      className="text-xs text-slate-600 hover:text-slate-900 font-medium block py-1"
                    >
                      Open Full Follow-ups Schedule →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Superadmin Impersonation Support Banner */}
        {isImpersonated && (
          <div className="bg-purple-900 border-b border-purple-800 text-purple-100 px-4 py-2 text-xs flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-purple-300 shrink-0" />
              <span>
                Viewing in <strong>Platform Support Mode</strong> as {user?.name} ({org?.name}).
              </span>
            </div>
            <button
              onClick={() => window.close()}
              className="px-2 py-0.5 rounded bg-purple-800 hover:bg-purple-700 text-white font-semibold text-[11px] transition"
            >
              Close Support Tab
            </button>
          </div>
        )}

        {/* Suspended Alert Banner */}
        {isSuspended && (
          <div className="bg-rose-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between shadow-md z-20">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>Your organization account is currently suspended. Please contact your platform administrator.</span>
            </div>
          </div>
        )}

        {/* Trial Evaluation Countdown Banner */}
        {!isSuspended && isTrial && (
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-xs z-20">
            <div className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-amber-300 shrink-0" />
              <span>
                <strong>Evaluation Trial:</strong> You have {trialDaysRemaining} {trialDaysRemaining === 1 ? 'day' : 'days'} remaining in your evaluation trial. Plans and quotas are managed by your administrator.
              </span>
            </div>
          </div>
        )}

        {/* Storage Quota Warning Banner (>85%) */}
        {!isSuspended && !isTrial && isStorageWarning && (
          <div className="bg-amber-500 text-slate-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between shadow-xs z-20">
            <div className="flex items-center gap-2">
              <HardDrive className="w-3.5 h-3.5 shrink-0" />
              <span>
                <strong>Storage Alert:</strong> You have reached {storageUsagePercent}% of your recording quota. Please contact your administrator to increase capacity.
              </span>
            </div>
          </div>
        )}

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto bg-slate-50">{children}</main>
      </div>
    </div>
  );
}
