'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Save,
  Edit2,
  Table,
  BarChart2,
  Percent,
  Search,
  X,
  Plus,
  Check,
  ChevronRight,
  Filter,
} from 'lucide-react';

const PIVOT_STAGES = [
  'Fresh',
  'Attempting Call',
  'Connected',
  'Interested',
  'Meeting Scheduled',
  'Meeting Done',
  'Proposal Shared',
  'Negotiation',
  'Payment Pending',
  'Won',
  'Lost',
];

function ReportBuilderContent() {
  const searchParams = useSearchParams();
  const [reportTitle, setReportTitle] = useState(searchParams.get('title') || 'New report');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'chart' | 'share'>('table');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['Leads', 'Won', 'Lost', 'Open']);
  const [rowDimension, setRowDimension] = useState('Stage');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const removeMetric = (metric: string) => {
    setSelectedMetrics((prev) => prev.filter((m) => m !== metric));
  };

  const addMetric = (metric: string) => {
    if (!selectedMetrics.includes(metric)) {
      setSelectedMetrics((prev) => [...prev, metric]);
    }
  };

  const handleExportCSV = () => {
    const headers = ['Stage', ...selectedMetrics];
    const rows = PIVOT_STAGES.map((s) => [s, s === 'Won' ? '1' : '0', s === 'Won' ? '1' : '0', '0', '0']);
    const csvContent = [headers, ...rows].map((e) => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${reportTitle.toLowerCase().replace(/\s+/g, '-')}.csv`;
    a.click();
  };

  const handleSaveReport = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-52px)] bg-slate-50 overflow-hidden text-slate-800">
      {/* Top Header matching Screenshot 9 */}
      <div className="px-6 py-3.5 bg-white border-b border-slate-200 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2">
            {isEditingTitle ? (
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                onBlur={() => setIsEditingTitle(false)}
                onKeyDown={(e) => e.key === 'Enter' && setIsEditingTitle(false)}
                autoFocus
                className="text-base font-bold text-slate-900 border-b border-blue-500 focus:outline-none"
              />
            ) : (
              <h1
                onClick={() => setIsEditingTitle(true)}
                className="text-base font-bold text-slate-900 cursor-pointer hover:underline flex items-center gap-1.5"
              >
                <span>{reportTitle}</span>
                <span className="text-xs text-slate-400 font-normal italic">(Unsaved)</span>
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
              </h1>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>

          <button
            onClick={handleSaveReport}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
            <span>{savedSuccess ? 'Saved!' : 'Save report'}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace: Left Pivot Table + Right Report Editor */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Table / Chart Area */}
        <div className="flex-1 flex flex-col p-6 overflow-y-auto space-y-4">
          {/* Controls Bar matching Screenshot 9 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 cursor-pointer focus:outline-none">
                <option>Last 30 days</option>
                <option>Last 7 days</option>
                <option>This quarter</option>
                <option>All time</option>
              </select>

              <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 flex items-center gap-1">
                <Filter className="w-3 h-3 text-slate-400" />
                <span>Filters</span>
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="bg-slate-200/70 p-0.5 rounded-xl flex items-center text-xs font-semibold">
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                  viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Table className="w-3.5 h-3.5" />
                <span>Table</span>
              </button>
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                  viewMode === 'chart' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <BarChart2 className="w-3.5 h-3.5" />
                <span>Chart</span>
              </button>
              <button
                onClick={() => setViewMode('share')}
                className={`px-3 py-1 rounded-lg flex items-center gap-1 transition ${
                  viewMode === 'share' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>% Share</span>
              </button>
            </div>
          </div>

          {/* Pivot Table matching Screenshot 9 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-5">STAGE</th>
                  {selectedMetrics.map((m) => (
                    <th key={m} className="py-3 px-4 text-right">
                      {m.toUpperCase()} ⇅
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {PIVOT_STAGES.map((stg) => {
                  const isWon = stg === 'Won';
                  return (
                    <tr key={stg} className="hover:bg-slate-50/60 transition">
                      <td className="py-2.5 px-5 font-medium text-slate-800">{stg}</td>
                      {selectedMetrics.map((m) => {
                        const val = isWon && (m === 'Leads' || m === 'Won') ? 1 : 0;
                        return (
                          <td key={m} className="py-2.5 px-4 text-right font-mono text-slate-600">
                            {val}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}

                {/* Total Row */}
                <tr className="bg-slate-50 font-bold border-t-2 border-slate-200 text-slate-900">
                  <td className="py-3 px-5">Total</td>
                  {selectedMetrics.map((m) => (
                    <td key={m} className="py-3 px-4 text-right font-mono">
                      {m === 'Leads' || m === 'Won' ? 1 : 0}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-slate-400">Oct 21 – Nov 19, 2026 · Asia/Kolkata</p>
        </div>

        {/* Right Report Editor & Field Picker matching Screenshot 9 */}
        <div className="w-80 bg-white border-l border-slate-200 flex flex-col shrink-0 h-full overflow-y-auto">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Report Editor</h3>
            <span className="text-[11px] text-slate-400 cursor-pointer hover:underline">Hide »</span>
          </div>

          <div className="p-4 space-y-4 border-b border-slate-100">
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                Count leads by
              </label>
              <select className="w-full px-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-700">
                <option>Created on</option>
                <option>Last contacted</option>
                <option>Closed date</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Rows</label>
              <div className="flex items-center gap-1.5 p-2 bg-blue-50 border border-blue-200 rounded-xl text-xs font-semibold text-blue-700 justify-between">
                <span>{rowDimension}</span>
                <span className="text-[10px] text-blue-500 font-normal">Dimension</span>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Metrics
              </label>
              <div className="flex flex-wrap gap-1.5">
                {selectedMetrics.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-medium"
                  >
                    <span>{m}</span>
                    <button onClick={() => removeMetric(m)} className="hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Available Fields Drawer matching Screenshot 9 */}
          <div className="p-4 space-y-3 flex-1 overflow-y-auto">
            <div className="relative">
              <Search className="w-3 h-3 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search fields"
                className="w-full pl-7 pr-3 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none"
              />
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Frequently Used
              </span>
              <div className="space-y-1 text-xs">
                {['Created', 'Stage', 'Current owner', 'Source', 'Campaign', 'Conversion Rate', 'Revenue received'].map(
                  (f) => (
                    <div
                      key={f}
                      onClick={() => addMetric(f)}
                      className="p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer flex items-center justify-between text-slate-700 transition"
                    >
                      <span>{f}</span>
                      <Plus className="w-3 h-3 text-slate-400 hover:text-blue-600" />
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ReportBuilderPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-xs text-slate-400">Loading Report Builder...</div>}>
      <ReportBuilderContent />
    </Suspense>
  );
}

