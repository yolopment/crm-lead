'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  TrendingUp,
  Users,
  Calendar,
  Filter,
  Plus,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';

const REPORT_QUESTIONS = [
  {
    category: 'WHERE LEADS COME FROM',
    items: [
      {
        title: 'Which sources bring me the most leads?',
        desc: 'See your top lead sources, tracked over time.',
        config: 'Metric = Leads, Compare by = Traffic source, Rank by = Leads',
      },
      {
        title: 'Which campaigns drive the most leads?',
        desc: 'Rank campaigns by lead volume across time.',
        config: 'Metric = Leads, Compare by = Campaign, Rank by = Leads',
      },
      {
        title: 'Which campaigns work best inside a source?',
        desc: 'Pick a source/medium, then see its campaigns.',
        config: 'Metric = Leads, Compare by = Campaign, Rank by = Leads',
      },
    ],
  },
  {
    category: 'QUALITY & CONVERSION',
    items: [
      {
        title: 'Which campaigns lose the most leads?',
        desc: 'Spot the campaigns producing the most lost leads.',
        config: 'Metric = Lost, Compare by = Campaign, Rank by = Lost',
      },
      {
        title: 'Which sources have the worst lost rate?',
        desc: 'Compare sources by their share of lost leads.',
        config: 'Metric = Lost rate, Compare by = Traffic source, Rank by = Lost',
      },
      {
        title: 'Which sources convert best?',
        desc: 'Compare sources by their win rate.',
        config: 'Metric = Conversion rate, Compare by = Traffic source, Rank by = Won',
      },
    ],
  },
];

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState('7d');
  const [totalLeads, setTotalLeads] = useState(1);
  const [callsCount, setCallsCount] = useState(1);

  useEffect(() => {
    async function loadStats() {
      try {
        const [leadsData, callsData] = await Promise.all([
          fetchWithAuth('/leads?limit=1'),
          fetchWithAuth('/calls/stats'),
        ]);
        if (leadsData?.pagination?.total !== undefined) {
          setTotalLeads(leadsData.pagination.total);
        }
        if (callsData?.totalCalls !== undefined) {
          setCallsCount(callsData.totalCalls);
        }
      } catch (e) {
        console.error(e);
      }
    }
    loadStats();
  }, []);

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header matching Screenshot 8 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <BarChart3 className="w-4 h-4" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Reports</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Track where your leads are coming from and which campaigns are performing best.
          </p>
        </div>

        <Link
          href="/dashboard/report-builder/new"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition flex items-center gap-1.5 self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Report</span>
        </Link>
      </div>

      <p className="text-[11px] text-slate-400">
        Times shown in India Standard Time (GMT+05:30) · Leads without UTM data are grouped under "Unknown"
      </p>

      {/* Main Content Layout with Report Templates Sidebar matching Screenshot 8 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: KPI Summary & Leads Over Time */}
        <div className="lg:col-span-2 space-y-6">
          {/* KPI Cards Row matching Screenshot 8 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>TOTAL LEADS</span>
                <Users className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">{totalLeads}</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">In the selected range</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>AVG LEADS / DAY</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-2">
                {(totalLeads / 7).toFixed(1)}
              </div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Over last 7 days</span>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
                <span>TOP TRAFFIC SOURCE</span>
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              </div>
              <div className="text-lg font-bold text-slate-900 mt-2 truncate">Website / Forms</div>
              <span className="text-[11px] text-slate-400 mt-0.5 block">Highest converting source</span>
            </div>
          </div>

          {/* Leads Over Time Chart Box */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Leads over time</h3>
              <span className="text-xs text-slate-400 font-medium">Nov 13 – Nov 19</span>
            </div>

            {/* Visual SVG chart */}
            <div className="h-56 w-full flex items-end justify-between gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
              {['Nov 13', 'Nov 14', 'Nov 15', 'Nov 16', 'Nov 17', 'Nov 18', 'Nov 19'].map((date, idx) => {
                const height = idx === 6 ? '70%' : idx === 5 ? '40%' : '15%';
                return (
                  <div key={date} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                    <div
                      style={{ height }}
                      className="w-full max-w-[36px] bg-blue-600/90 rounded-t-lg hover:bg-blue-700 transition"
                      title={`${date}: Leads active`}
                    />
                    <span className="text-[10px] font-semibold text-slate-400">{date}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Report Templates Drawer matching Screenshot 8 */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Report templates</h3>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Pick a question and we'll set up the report for you. You can tweak it afterwards.
            </p>
          </div>

          <div className="space-y-6">
            {REPORT_QUESTIONS.map((group) => (
              <div key={group.category} className="space-y-2.5">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  {group.category}
                </span>

                <div className="space-y-2">
                  {group.items.map((q) => (
                    <Link
                      key={q.title}
                      href={`/dashboard/report-builder/new?title=${encodeURIComponent(q.title)}`}
                      className="block p-3.5 rounded-xl border border-slate-200/90 hover:border-blue-500 hover:bg-blue-50/40 transition group"
                    >
                      <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-600 transition">
                        {q.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{q.desc}</p>
                      <span className="text-[10px] text-slate-400 font-mono mt-1.5 block opacity-80">
                        {q.config}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

