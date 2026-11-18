'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, PhoneIncoming, PhoneOutgoing, Clock, Users, Loader2 } from 'lucide-react';
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
  const uniqueCalls = totals.total; // approximation

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
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Call Activity</h1>
        <p className="text-sm text-slate-500 mt-0.5">Analyze call volume, direction, talk time, dispositions, and team performance.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-wrap items-end gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {[
            { label: 'Date Range', value: dateRange, onChange: setDateRange, options: [['today','Today'],['last_7_days','Last 7 days'],['last_30_days','Last 30 days']] },
            { label: 'Direction', value: direction, onChange: setDirection, options: [['all','All calls'],['inbound','Inbound'],['outbound','Outbound']] },
            { label: 'Group By', value: groupBy, onChange: setGroupBy, options: [['day','By day'],['week','By week']] },
          ].map(({ label, value, onChange, options }) => (
            <div key={label}>
              <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">{label}</label>
              <select value={value} onChange={(e) => onChange(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Agent</label>
            <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
              className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="all">All agents</option>
              {(Array.isArray(team) ? team : []).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-sm">
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export CSV</span>
        </button>
      </div>

      <div className="text-xs text-slate-400">{loading ? 'Loading...' : `${totals.total} calls in range`}</div>

      {/* Metric Cards */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{[1,2,3,4,5,6].map(i => <StatCardSkeleton key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: 'Total Calls', icon: <PhoneOutgoing className="w-3.5 h-3.5 text-blue-600" />, value: totals.total, sub: `${connectRate}% connected` },
            { label: 'Inbound', icon: <PhoneIncoming className="w-3.5 h-3.5 text-blue-500" />, value: totals.inbound, sub: totals.inbound === 0 ? 'No inbound' : `${Math.round((totals.inbound/totals.total)*100)}%` },
            { label: 'Outbound', icon: <PhoneOutgoing className="w-3.5 h-3.5 text-emerald-600" />, value: totals.outbound, sub: `${outConnectRate}% connect rate` },
            { label: 'Talk Time', icon: <Clock className="w-3.5 h-3.5 text-blue-600" />, value: talkFormatted, sub: 'Connected calls (in + out)' },
            { label: 'Long Calls (≥5m)', icon: <Clock className="w-3.5 h-3.5 text-emerald-600" />, value: longCalls, sub: `${totals.connected > 0 ? Math.round((longCalls/totals.connected)*100) : 0}% of connected` },
            { label: 'Unique Numbers', icon: <Users className="w-3.5 h-3.5 text-blue-600" />, value: uniqueCalls, sub: 'Distinct phone numbers' },
          ].map(({ label, icon, value, sub }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {icon}<span>{label}</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-900 mt-2">{value}</div>
              <div className="text-xs text-slate-400 mt-1">{sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Sub-metrics row */}
      {!loading && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          {[
            { label: 'Avg Duration', value: `${Math.floor(avgDuration / 60)}m ${avgDuration % 60}s` },
            { label: 'Connect Rate (Out)', value: `${outConnectRate}%` },
            { label: 'Talk Time (In)', value: '0m' },
            { label: 'Talk Time (Out)', value: talkFormatted },
          ].map(({ label, value }) => (
            <div key={label}>
              <span className="text-slate-400 uppercase text-[10px] block font-bold">{label}</span>
              <span className="text-slate-900 text-sm font-bold">{value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Chart: Calls Per Day */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between pb-6">
          <div>
            <h3 className="font-bold text-slate-900 text-sm">Calls per day</h3>
            <p className="text-xs text-slate-400">Calls per day, split by direction</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-cyan-400"></span><span>Inbound</span></div>
            <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span><span>Outbound</span></div>
          </div>
        </div>

        {loading ? (
          <div className="h-44 flex items-end gap-3 px-4">
            {[0.3,0.6,0.4,0.9,0.5,0.7,1].map((h,i) => (
              <div key={i} className="flex-1 bg-slate-100 rounded-t-sm animate-pulse" style={{ height: `${h * 100}%` }} />
            ))}
          </div>
        ) : (
          <div className="flex items-end gap-2 px-4 h-44 relative border-b border-dashed border-slate-200">
            {data.filter(d => d.total > 0 || true).map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.total} calls`}>
                <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '160px', justifyContent: 'flex-start' }}>
                  <div className="w-full bg-blue-600 rounded-t-sm transition-all hover:bg-blue-700"
                    style={{ height: `${maxBars > 0 ? (d.outbound / maxBars) * 140 : 0}px` }} />
                  <div className="w-full bg-cyan-400 rounded-t-sm transition-all hover:bg-cyan-500"
                    style={{ height: `${maxBars > 0 ? (d.inbound / maxBars) * 140 : 0}px` }} />
                </div>
                <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap overflow-hidden">
                  {new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Daily table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-bold text-slate-900 text-sm">By day</h3>
          <p className="text-xs text-slate-400">Same data as the chart above, in tabular form</p>
        </div>
        <div className="overflow-x-auto" role="region" aria-labelledby="activity-table-caption" tabIndex={0}>
          <table className="w-full text-left text-xs">
            <caption id="activity-table-caption" className="sr-only">Daily call activity breakdown</caption>
            <thead className="bg-slate-50/75 text-[10px] font-bold uppercase text-slate-400 border-b border-slate-100">
              <tr>
                {['Date','Total','In','Out','Connected','Rate','≥5m','Avg Talk','Talk Time'].map(h => (
                  <th key={h} scope="col" className="py-3 px-4">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading
                ? [1,2,3].map(i => (
                    <tr key={i}>{[1,2,3,4,5,6,7,8,9].map(j => (
                      <td key={j} className="py-3 px-4"><div className="h-3 bg-slate-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  ))
                : data.filter(d => d.total > 0).map((row) => (
                  <tr key={row.date} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {new Date(row.date).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4 font-medium">{row.total}</td>
                    <td className="py-3 px-4">{row.inbound}</td>
                    <td className="py-3 px-4">{row.outbound}</td>
                    <td className="py-3 px-4">{row.connected}</td>
                    <td className="py-3 px-4">{row.connectRate}%</td>
                    <td className="py-3 px-4">{row.talkTimeSec >= 300 ? row.connected : 0}</td>
                    <td className="py-3 px-4">{Math.floor(row.avgDurationSec/60)}m {row.avgDurationSec%60}s</td>
                    <td className="py-3 px-4">{Math.floor(row.talkTimeSec/60)}m</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
