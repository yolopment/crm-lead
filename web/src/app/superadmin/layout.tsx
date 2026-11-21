'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  HardDrive,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  ExternalLink,
  User,
  Loader2,
} from 'lucide-react';
import {
  getSaasToken,
  getSaasAdmin,
  clearSaasToken,
  clearSaasAdmin,
  SaasAdminProfile,
} from '@/lib/saas-api';

const NAV_ITEMS = [
  { label: '📊 Dashboard', href: '/superadmin', icon: LayoutDashboard },
  { label: '🏢 Organizations', href: '/superadmin/organizations', icon: Building2 },
  { label: '💳 Billing', href: '/superadmin/billing', icon: CreditCard },
  { label: '💾 Storage', href: '/superadmin/storage', icon: HardDrive },
  { label: '⚙️ Settings', href: '/superadmin/settings', icon: Settings },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const [admin, setAdmin] = useState<SaasAdminProfile | null>(null);
  const [tokenChecked, setTokenChecked] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const normalizedPath = (pathname || '').replace(/\/+$/, '');
  const isLoginPage =
    normalizedPath.includes('/superadmin/login') ||
    (typeof window !== 'undefined' && window.location.pathname.includes('/superadmin/login'));

  // Auth Guard
  useEffect(() => {
    if (isLoginPage) {
      setTokenChecked(true);
      return;
    }

    const token = getSaasToken();
    if (!token) {
      if (typeof window !== 'undefined') {
        window.location.href = '/superadmin/login/';
      }
      setTokenChecked(true);
      return;
    }

    const savedAdmin = getSaasAdmin();
    if (savedAdmin) {
      setAdmin(savedAdmin);
    }
    setTokenChecked(true);
  }, [pathname, isLoginPage]);

  // Handle Logout
  const handleLogout = () => {
    clearSaasToken();
    clearSaasAdmin();
    if (typeof window !== 'undefined') {
      window.location.href = '/superadmin/login/';
    } else {
      router.replace('/superadmin/login');
    }
  };

  // If on login page, render child directly without sidebar/topbar
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Prevent flash while checking auth
  if (!tokenChecked) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Verifying platform administrator...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row">
      {/* Mobile Top Bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-3 bg-slate-900 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="StaffCaller" className="w-8 h-8 rounded-lg object-cover" />
          <span className="font-bold text-white text-sm">StaffCaller Admin</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Left Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 border-r border-slate-800 flex flex-col transform transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:relative'
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <Link href="/superadmin" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="StaffCaller" className="w-10 h-10 rounded-xl shadow-lg shadow-blue-600/30 object-cover" />
            <div>
              <div className="font-bold text-white text-base leading-tight group-hover:text-blue-400 transition">
                StaffCaller
              </div>
              <div className="text-[11px] font-medium text-blue-400 uppercase tracking-wider">
                Platform Admin
              </div>
            </div>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/superadmin'
                ? normalizedPath === '/superadmin'
                : normalizedPath.startsWith(item.href);

            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition duration-150 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-slate-800/80 space-y-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition"
          >
            <span>Tenant CRM Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
          <div className="px-3 py-1 flex items-center justify-between text-[11px] text-slate-500">
            <span>SaaS Core</span>
            <span className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Operational
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 h-16 bg-slate-900/90 border-b border-slate-800 backdrop-blur-md px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Super Admin Console
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-sm font-medium text-slate-200 capitalize">
              {normalizedPath === '/superadmin'
                ? 'Overview'
                : normalizedPath.replace('/superadmin/', '').replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Admin Profile */}
            <div className="flex items-center gap-3 border-r border-slate-800 pr-4">
              <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xs font-bold">
                {admin?.name ? admin.name.charAt(0).toUpperCase() : 'A'}
              </div>
              <div className="hidden sm:block text-left">
                <div className="text-sm font-medium text-slate-200 leading-tight">
                  {admin?.name || 'Administrator'}
                </div>
                <div className="text-[10px] text-slate-400">
                  {admin?.email || 'saas-superadmin'}
                </div>
              </div>
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-400 hover:text-white hover:bg-rose-600/20 border border-rose-500/20 transition"
              title="Sign out of platform"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Page Body */}
        <main className="flex-1 p-6 md:p-8 bg-slate-950 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
