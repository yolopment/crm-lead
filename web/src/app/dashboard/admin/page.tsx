'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  PhoneCall,
  Clock,
  Sparkles,
  ArrowRight,
  TrendingUp,
  FileText,
  Plus,
  LayoutGrid,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  Filter,
  BarChart3,
  Calendar,
  Layers,
  PhoneForwarded,
} from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { fetchWithAuth } from '@/lib/api';

interface DashboardStats {
  totalLeads: number;
  leadsThisWeek: number;
  leadsToday: number;
  totalCalls: number;
  connectedCalls: number;
  callsToday: number;
  connectRate: number;
  followupsToday: number;
  overdueFollowups: number;
  totalForms: number;
}

interface StageCount {
  stage: string;
  count: number;
}

interface SourceCount {
  source: string;
  count: number;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const { user, org } = useAuth();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    leadsThisWeek: 0,
    leadsToday: 0,
    totalCalls: 0,
    connectedCalls: 0,
    callsToday: 0,
    connectRate: 100,
    followupsToday: 0,
    overdueFollowups: 0,
    totalForms: 0,
  });
  const [stages, setStages] = useState<StageCount[]>([]);
  const [sources, setSources] = useState<SourceCount[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);

  // Time filter
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'all'>('week');

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/dashboard/stats');
      if (res?.stats) {
        setStats(res.stats);
        setStages(res.stageBreakdown || []);
        setSources(res.sourceBreakdown || []);
        setRecentLeads(res.recentLeads || []);
        setRecentCalls(res.recentCalls || []);
        setTeamMembers(res.teamPerformance || []);
        setPairedDevices(res.pairedDevices || []);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
    NEW: { label: 'Fresh', color: 'text-blue-700', bg: 'bg-blue-500' },
    CONTACTED: { label: 'Contacted', color: 'text-amber-700', bg: 'bg-amber-500' },
    QUALIFIED: { label: 'Qualified', color: 'text-indigo-700', bg: 'bg-indigo-500' },
    PROPOSAL_SENT: { label: 'Proposal Sent', color: 'text-purple-700', bg: 'bg-purple-500' },
    WON: { label: 'Won', color: 'text-emerald-700', bg: 'bg-emerald-500' },
    LOST: { label: 'Lost', color: 'text-rose-700', bg: 'bg-rose-500' },
  };

  const isAgent = user?.role === 'AGENT';

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {/* ─── Top Executive Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              {isAgent ? 'Agent Dashboard' : 'Admin Dashboard'}
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {getGreeting()}, <span className="font-semibold text-slate-700">{user?.name || 'Aftab Sk'}</span>.
            {isAgent
              ? ' Here is your assigned leads, scheduled follow-ups, and live call activity.'
              : ' Here is your live team activity and sales pipeline.'}
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2.5 self-start sm:self-auto">
          {/* Quick Add Lead */}
          <Link
            href="/dashboard/leads?action=add-single"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>Add Lead</span>
          </Link>

          {/* Quick Create Form (Admins only) */}
          {!isAgent && (
            <Link
              href="/dashboard/forms/builder"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition shadow-xs"
            >
              <FileText className="w-3.5 h-3.5 text-blue-600" />
              <span>New Form</span>
            </Link>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            onClick={loadDashboardData}
            title="Refresh live stats"
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-slate-500 hover:text-slate-800 transition shadow-xs"
          >
            <RotateCcw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── 4 Primary KPI Cards ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Total Leads / My Leads */}
        <Link
          href="/dashboard/leads"
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAgent ? 'My Assigned Leads' : 'Total Leads'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats.totalLeads}
            </span>
            <span className="text-xs text-emerald-600 font-semibold inline-flex items-center gap-0.5">
              <TrendingUp className="w-3 h-3" />
              +{stats.leadsThisWeek} this week
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>+{stats.leadsToday} captured today</span>
            <span className="text-blue-600 font-semibold group-hover:underline flex items-center gap-0.5">
              View leads <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        {/* 2. Connected Calls / My Calls */}
        <Link
          href="/dashboard/calls"
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-emerald-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAgent ? 'My Connected Calls' : 'Connected Calls'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <PhoneCall className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats.connectedCalls}
            </span>
            <span className="text-xs text-emerald-600 font-semibold">
              {stats.connectRate}% connect rate
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>{stats.callsToday} logged today via app</span>
            <span className="text-emerald-600 font-semibold group-hover:underline flex items-center gap-0.5">
              Call logs <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        {/* 3. Follow-ups Today */}
        <Link
          href="/dashboard/follow-ups"
          className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-amber-300 hover:shadow-sm transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {isAgent ? 'My Follow-ups' : 'Follow-ups Today'}
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-105 transition-transform">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">
              {stats.followupsToday}
            </span>
            {stats.overdueFollowups > 0 ? (
              <span className="text-xs text-rose-600 font-semibold inline-flex items-center gap-0.5">
                <AlertTriangle className="w-3 h-3" />
                {stats.overdueFollowups} overdue
              </span>
            ) : (
              <span className="text-xs text-slate-400 font-semibold">
                All caught up
              </span>
            )}
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
            <span>Scheduled calls & tasks</span>
            <span className="text-amber-600 font-semibold group-hover:underline flex items-center gap-0.5">
              Schedule <ChevronRight className="w-3 h-3" />
            </span>
          </div>
        </Link>

        {/* 4. Active Forms (Admin) or Connect Rate / Total Calls (Agent) */}
        {isAgent ? (
          <Link
            href="/dashboard/calls"
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                My Total Calls
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats.totalCalls}
              </span>
              <span className="text-xs text-indigo-600 font-semibold">
                {stats.connectRate}% connected
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Synchronized via companion</span>
              <span className="text-indigo-600 font-semibold group-hover:underline flex items-center gap-0.5">
                View history <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        ) : (
          <Link
            href="/dashboard/forms"
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-indigo-300 hover:shadow-sm transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Lead Capture Forms
              </span>
              <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">
                {stats.totalForms}
              </span>
              <span className="text-xs text-indigo-600 font-semibold">
                Live & active
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>Round-robin auto assigned</span>
              <span className="text-indigo-600 font-semibold group-hover:underline flex items-center gap-0.5">
                Manage forms <ChevronRight className="w-3 h-3" />
              </span>
            </div>
          </Link>
        )}
      </div>

      {/* ─── Middle Section: Pipeline Funnel & Sources Breakdown ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pipeline Funnel (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAgent ? 'My Lead Pipeline & Stages' : 'Lead Pipeline & Stages'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAgent ? 'Live conversion funnel for your assigned deals' : 'Live conversion funnel across active deals'}
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>View All Pipeline</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Funnel Progress Bars */}
          <div className="space-y-3.5">
            {['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'WON', 'LOST'].map((stageKey) => {
              const cfg = STAGE_CONFIG[stageKey] || { label: stageKey, color: 'text-slate-700', bg: 'bg-slate-400' };
              const found = stages.find((s) => s.stage === stageKey);
              const count = found ? found.count : 0;
              const pct = stats.totalLeads > 0 ? Math.round((count / stats.totalLeads) * 100) : 0;

              return (
                <div key={stageKey} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700">{cfg.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{count}</span>
                      <span className="text-slate-400 text-[11px]">({pct}%)</span>
                    </div>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${cfg.bg}`}
                      style={{ width: `${Math.max(pct, count > 0 ? 5 : 0)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Ingestion Sources (1 Col) */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Lead Sources</h3>
              <p className="text-xs text-slate-500">Where inquiries are arriving from</p>
            </div>
            {!isAgent && (
              <Link
                href="/dashboard/integrations"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Integrations →
              </Link>
            )}
          </div>

          <div className="space-y-3">
            {sources.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">No leads captured yet.</p>
            ) : (
              sources.map((src) => {
                const pct = stats.totalLeads > 0 ? Math.round((src.count / stats.totalLeads) * 100) : 0;
                return (
                  <div key={src.source} className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 capitalize">
                        {src.source.replace(/_/g, ' ')}
                      </span>
                      <span className="font-bold text-slate-900">{src.count} leads</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-200/70 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${Math.max(pct, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Mobile Companion Connection Status Banner */}
          <div className="pt-2 border-t border-slate-100">
            <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="text-xs font-bold text-emerald-900 block leading-tight">
                    Companion App Active
                  </span>
                  <span className="text-[10px] text-emerald-700">
                    Background call tracking & remote dial online
                  </span>
                </div>
              </div>
              <a
                href="/downloads/staffcaller.apk"
                download="staffcaller.apk"
                className="text-[10px] font-bold text-emerald-700 hover:underline shrink-0"
              >
                Get APK
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Section: Recent Activity Ticker & Team Status ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Leads & Calls Activity (2 Cols for Admin, Full 3 Cols for Agent) */}
        <div className={`${isAgent ? 'lg:col-span-3' : 'lg:col-span-2'} bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {isAgent ? 'My Recent Live Activity' : 'Recent Live Activity'}
              </h3>
              <p className="text-xs text-slate-500">
                {isAgent ? 'Your assigned leads and recorded phone calls' : 'Real-time incoming leads and recorded phone calls'}
              </p>
            </div>
            <Link
              href="/dashboard/leads"
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              See all activity →
            </Link>
          </div>

          <div className="divide-y divide-slate-100">
            {recentLeads.length === 0 && recentCalls.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-400">
                No recent activity recorded yet.
              </div>
            ) : (
              recentLeads.slice(0, 5).map((lead) => (
                <div key={lead.id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-lg transition">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                      {lead.fullName ? lead.fullName.charAt(0).toUpperCase() : 'L'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dashboard/leads?search=${encodeURIComponent(lead.phone)}`}
                          className="text-xs font-bold text-slate-900 hover:text-blue-600 transition"
                        >
                          {lead.fullName || 'Anonymous Lead'}
                        </Link>
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono">
                          {lead.phone}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-400">
                        Via {lead.source || 'Website'} · Assigned to {lead.assignedTo?.name || 'Round Robin'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 font-medium">
                      {timeAgo(lead.createdAt)}
                    </span>
                    <span className="text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {lead.stageName || 'Fresh'}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Team Leaderboard (1 Col, Admins only) */}
        {!isAgent && (
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Team Performance</h3>
                <p className="text-xs text-slate-500">Live agent distribution</p>
              </div>
              <Link
                href="/dashboard/settings"
                className="text-xs font-bold text-blue-600 hover:underline"
              >
                Manage →
              </Link>
            </div>

            <div className="space-y-3">
              {teamMembers.map((member) => (
                <div key={member.id} className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold text-xs flex items-center justify-center">
                      {member.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{member.name}</span>
                        {member.isOnLeave && (
                          <span className="text-[9px] bg-amber-100 text-amber-700 px-1 rounded">Leave</span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {member.role} · {member.deviceToken ? '📱 Paired' : 'Not paired'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-900 block">
                      {member._count?.calls || 0} calls
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {member._count?.assignedLeads || 0} leads
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ─── Pinned Reports Section (matching Leadzam, Admins only) ─── */}
      {!isAgent && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-slate-800">Saved Reports</h3>

          <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-12 text-center shadow-xs flex flex-col items-center justify-center">
            <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 mb-4">
              <LayoutGrid className="w-7 h-7" />
            </div>

            <h4 className="text-base font-bold text-slate-900">Pin the reports you check most</h4>
            <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
              Add up to 6 saved reports from Report Builder. Every admin in your organization sees the same dashboard.
            </p>

            <div className="flex items-center gap-3 mt-6">
              <Link
                href="/dashboard/report-builder/new"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add a report</span>
              </Link>

              <Link
                href="/dashboard/reports"
                className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-semibold transition"
              >
                <span>Create a report</span>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
