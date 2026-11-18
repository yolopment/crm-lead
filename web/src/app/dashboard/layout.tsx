'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Phone, BarChart3, Settings, Bell, Clock, Moon, Download, Users, Loader2, LogOut } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, org, isLoading, logout } = useAuth();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { label: 'Calls', href: '/dashboard/calls', icon: Phone },
    { label: 'Leads', href: '/dashboard/leads', icon: Users },
    { label: 'Reports', href: '/dashboard/call-activity', icon: BarChart3 },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings },
  ];

  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Left Icon Sidebar */}
      <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center justify-between py-4 select-none shrink-0 z-20">
        <div className="flex flex-col items-center gap-6 w-full">
          {/* Logo */}
          <Link href="/dashboard/calls" className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <Phone className="w-5 h-5" />
          </Link>

          {/* Navigation Items */}
          <nav className="flex flex-col gap-1 w-full px-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex flex-col items-center justify-center py-2.5 rounded-lg text-xs font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-blue-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mb-1" />
                  <span className="text-[9px]">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom: User Avatar + Logout */}
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={logout}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
          >
            <LogOut className="w-4 h-4" />
          </button>
          <div
            title={`${user.name} · ${user.role}`}
            className="w-9 h-9 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-xs shadow-sm cursor-default"
          >
            {initials}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header Bar */}
        <header className="h-14 bg-white border-b border-slate-200 px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span className="font-medium text-slate-400">{org?.name}</span>
            <span>›</span>
            <span className="font-semibold text-slate-900 capitalize">
              {pathname.split('/').pop()?.replace('-', ' ')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Leave Status */}
            {user.isOnLeave && (
              <div className="px-2.5 py-1 bg-amber-50 text-amber-700 rounded-full text-xs font-semibold border border-amber-200">
                On Leave
              </div>
            )}

            {/* Download Companion APK */}
            <a
              href="#"
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-full text-xs font-medium border border-emerald-200 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Android App</span>
            </a>

            <div className="h-4 w-[1px] bg-slate-200"></div>

            <button type="button" aria-label="Toggle theme" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              <Moon className="w-4 h-4" />
            </button>
            <button type="button" aria-label="Notifications" className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100">
              <Bell className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-7 h-7 rounded-full bg-blue-500 text-white flex items-center justify-center font-semibold text-xs">
                {initials}
              </div>
              <div className="hidden md:block">
                <div className="text-xs font-semibold text-slate-900 leading-none">{user.name}</div>
                <div className="text-[10px] text-slate-400 mt-0.5">{user.role}</div>
              </div>
            </div>
          </div>
        </header>

        {/* Viewport Content */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
