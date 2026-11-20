'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, PhoneIncoming, PhoneOutgoing, Clock, Users, BarChart3, ChevronDown } from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { StatCardSkeleton, Toast } from '@/components/ui';

interface DayStats {
  date: string;
  inbound: number;
  outbound: number;
  total: number;
  connected: number;
  connectRate: number;
  talkTimeSec: number;
  avgDurationSec: number;
}

export default function CallActivityPage() {
  const [data, setData] = useState<DayStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('last_7_days');
  const [direction, setDirection] = useState('all');
  const [userFilter, setUserFilter] = useState('all');
  const [groupBy, setGroupBy] = useState('day');
  const [team, setTeam] = useState<any[]>([]);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ range: dateRange });
      if (userFilter !== 'all') params.set('agentId', userFilter);

      const [activityData, teamData] = await Promise.all([
        fetchWithAuth(`/calls/activity?${params}`),
        fetchWithAuth('/team'),
      ]);
      setData(activityData || []);
      const members = Array.isArray(teamData) ? teamData : (teamData?.members || []);
      setTeam(members);
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to load', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, [dateRange, userFilter]);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = data.reduce((acc, d) => ({
    total: acc.total + d.total,
    inbound: acc.inbound + d.inbound,
    outbound: acc.outbound + d.outbound,
    connected: acc.connected + d.connected,
    talkTimeSec: acc.talkTimeSec + d.talkTimeSec,
  }), { total: 0, inbound: 0, outbound: 0, connected: 0, talkTimeSec: 0 });

  const connectRate = totals.total > 0 ? Math.round((totals.connected / totals.total) * 100) : 0;
  const outConnectRate = totals.outbound > 0
    ? Math.round((data.reduce((acc, d) => acc + d.connected, 0) / totals.outbound) * 100) : 0;
  const avgDuration = totals.connected > 0 ? Math.round(totals.talkTimeSec / totals.connected) : 0;
  const talkFormatted = `${Math.floor(totals.talkTimeSec / 60)}m`;
  const longCalls = data.reduce((acc, d) => acc + (d.talkTimeSec >= 300 ? d.connected : 0), 0);
  const uniqueCalls = totals.total;

  const maxBars = Math.max(...data.map(d => d.total), 1);

  const exportCSV = () => {
    const headers = ['Date', 'Total', 'Inbound', 'Outbound', 'Connected', 'Connect Rate', 'Talk Time Sec', 'Avg Duration Sec'];
    const rows = data.map(d => [d.date, d.total, d.inbound, d.outbound, d.connected, `${d.connectRate}%`, d.talkTimeSec, d.avgDurationSec]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `call-activity-${dateRange}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto space-y-5">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm shadow-blue-500/30">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-[17px] font-bold text-slate-900 tracking-tight leading-none">Call Reports</h1>
            <p className="text-[11px] text-slate-400 mt-0.5 leading-none">
              Analyze volume, connect rate, talk time and dispositions across time windows
            </p>
          </div>
        </div>

        <button
          onClick={exportCSV}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-xs transition self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex flex-wrap items-center gap-2.5 bg-white border border-slate-200/90 rounded-xl p-3 shadow-xs">
        <div className="relative">
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="today">Today</option>
            <option value="last_7_days">Last 7 days</option>
            <option value="last_30_days">Last 30 days</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={direction}
            onChange={e => setDirection(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All calls</option>
            <option value="inbound">Inbound only</option>
            <option value="outbound">Outbound only</option>
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={userFilter}
            onChange={e => setUserFilter(e.target.value)}
            className="appearance-none bg-slate-50 border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="all">All agents</option>
            {(Array.isArray(team) ? team : []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-slate-400 pointer-events-none" />
        </div>

        <div className="text-[11px] text-slate-400 ml-auto font-medium">
          {loading ? 'Crunching numbers...' : `${totals.total} calls recorded`}
        </div>
      </div>

      {/* KPI Cards Grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => <StatCardSkeleton key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Total Calls', icon: PhoneOutgoing, color: 'text-blue-600', bg: 'bg-blue-50', value: totals.total, sub: `${connectRate}% connected` },
            { label: 'Inbound', icon: PhoneIncoming, color: 'text-cyan-600', bg: 'bg-cyan-50', value: totals.inbound, sub: totals.inbound === 0 ? 'No incoming' : `${Math.round((totals.inbound / totals.total) * 100)}% of total` },
            { label: 'Outbound', icon: PhoneOutgoing, color: 'text-emerald-600', bg: 'bg-emerald-50', value: totals.outbound, sub: `${outConnectRate}% connect rate` },
            { label: 'Total Talk Time', icon: Clock, color: 'text-indigo-600', bg: 'bg-indigo-50', value: talkFormatted, sub: 'All connected audio' },
            { label: 'Long Calls (≥5m)', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', value: longCalls, sub: `${totals.connected > 0 ? Math.round((longCalls / totals.connected) * 100) : 0}% of connected` },
            { label: 'Unique Contacts', icon: Users, color: 'text-purple-600', bg: 'bg-purple-50', value: uniqueCalls, sub: 'Distinct callers' },
          ].map(({ label, icon: Icon, color, bg, value, sub }) => (
            <div key={label} className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</span>
                <div className={`w-6 h-6 rounded-md ${bg} flex items-center justify-center ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2 leading-none">{value}</div>
              <div className="text-[11px] text-slate-400 mt-1.5 font-medium">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Secondary Metrics Strip */}
      {!loading && (
        <div className="bg-white border border-slate-200/90 rounded-xl p-3.5 shadow-xs grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          {[
            { label: 'Avg Duration (Connected)', value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` },
            { label: 'Outbound Connect Rate', value: `${outConnectRate}%` },
            { label: 'Inbound Talk Time', value: '0m' },
            { label: 'Outbound Talk Time', value: talkFormatted },
          ].map(({ label, value }, idx) => (
            <div key={label} className={idx > 0 ? 'pt-2 sm:pt-0 sm:pl-4' : ''}>
              <span className="text-slate-400 uppercase text-[9px] block font-bold tracking-wider">{label}</span>
              <span className="text-slate-900 text-sm font-bold mt-0.5 block">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Calls Per Day Chart */}
      <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
        <div className="flex items-center justify-between pb-5 border-b border-slate-100">
          <div>
            <h3 className="font-bold text-slate-900 text-xs">Calls per day</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">Stacked volume breakdown by call direction</p>
          </div>
          <div className="flex items-center gap-3 text-[11px] font-semibold">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              <span className="text-slate-600">Inbound</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              <span className="text-slate-600">Outbound</span>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-40 flex items-end gap-3 px-4 pt-6">
            {[0.3, 0.6, 0.4, 0.9, 0.5, 0.7, 1].map((h, i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-t-md animate-pulse" style={{ height: `${h * 100}%` }} />
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-2 px-2 h-44 pt-6 relative">
            {data.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5" title={`${d.date}: ${d.total} calls`}>
                <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '140px', justifyContent: 'flex-start' }}>
                  <div
                    className="w-full bg-blue-600 hover:bg-blue-700 rounded-t-sm transition-all"
                    style={{ height: `${maxBars > 0 ? (d.outbound / maxBars) * 130 : 0}px` }}
                  />
                  <div
                    className="w-full bg-cyan-400 hover:bg-cyan-500 rounded-t-sm transition-all"
                    style={{ height: `${maxBars > 0 ? (d.inbound / maxBars) * 130 : 0}px` }}
                  />
                </div>
                <span className="text-[9px] text-slate-400 font-medium whitespace-nowrap overflow-hidden">
                  {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily Breakdown Table */}
      <div className="bg-white border border-slate-200/90 rounded-xl shadow-xs overflow-hidden">
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-xs">Tabular breakdown</h3>
          <p className="text-[11px] text-slate-400 mt-0.5">Aggregated metrics per calendar date</p>
        </div>
        <div className="overflow-x-auto" role="region" aria-labelledby="activity-table-caption" tabIndex={0}>
          <table className="w-full text-left text-xs">
            <caption id="activity-table-caption" className="sr-only">Daily call activity breakdown</caption>
            <thead className="bg-slate-50/75 text-[10px] font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <tr>
                {['Date', 'Total', 'Inbound', 'Outbound', 'Connected', 'Connect Rate', '≥5m Calls', 'Avg Duration', 'Total Talk'].map(h => (
                  <th key={h} scope="col" className="py-2.5 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? [1, 2, 3].map(i => (
                  <tr key={i}>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(j => (
                      <td key={j} className="py-3 px-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>
                    ))}
                  </tr>
                ))
                : data.filter(d => d.total > 0).map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {new Date(row.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">{row.total}</td>
                    <td className="py-3 px-4 text-cyan-600 font-semibold">{row.inbound}</td>
                    <td className="py-3 px-4 text-blue-600 font-semibold">{row.outbound}</td>
                    <td className="py-3 px-4 font-semibold text-emerald-600">{row.connected}</td>
                    <td className="py-3 px-4">
                      <span className="font-bold text-slate-700">{row.connectRate}%</span>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{row.talkTimeSec >= 300 ? row.connected : 0}</td>
                    <td className="py-3 px-4 text-slate-600 font-mono text-[11px]">
                      {Math.floor(row.avgDurationSec / 60)}m {row.avgDurationSec % 60}s
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">{Math.floor(row.talkTimeSec / 60)}m</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
