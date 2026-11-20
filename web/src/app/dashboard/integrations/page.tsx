'use client';

import React, { useState } from 'react';
import {
  Plug,
  Search,
  Check,
  ExternalLink,
  Layers,
  Database,
  Share2,
  TrendingUp,
  ShoppingBag,
  Zap,
  Globe,
  X,
  Code,
} from 'lucide-react';

interface IntegrationApp {
  id: string;
  name: string;
  category: 'CRM' | 'Storage' | 'Marketing' | 'Marketplace' | 'Automation' | 'Other';
  description: string;
  connected?: boolean;
}

const INTEGRATION_APPS: IntegrationApp[] = [
  { id: 'custom_api', name: 'Custom API / Webhooks', category: 'Other', description: 'Post JSON leads directly from custom backends & landing pages.', connected: true },
  { id: 'frappe_crm', name: 'Frappe CRM', category: 'CRM', description: 'Bi-directional contact & lead stage synchronization.' },
  { id: 'google_ads', name: 'Google Ads', category: 'Other', description: 'Sync offline call conversions and click IDs directly to Google Ads.' },
  { id: 'google_sheets', name: 'Google Sheets', category: 'Storage', description: 'Stream new leads & call summaries into a Google Spreadsheet in real time.' },
  { id: 'indiamart', name: 'IndiaMART', category: 'Marketplace', description: 'Auto-fetch IndiaMART buyer enquiries into CRM leads instantly.' },
  { id: 'meta_conversions_crm', name: 'Meta Conversions API for CRM', category: 'Marketing', description: 'Send Qualified & Won lead signals back to Meta to train your ads.' },
  { id: 'meta_conversions_web', name: 'Meta Conversions API for Web', category: 'Marketing', description: 'Track website conversions server-side without pixel ad-blockers.' },
  { id: 'meta_lead_ads', name: 'Meta Lead Ads', category: 'Marketing', description: 'Capture Facebook & Instagram instant lead forms in real time.' },
  { id: 'zapier', name: 'Zapier', category: 'Automation', description: 'Connect Lead CRM with 5,000+ business applications.' },
  { id: 'make', name: 'Make / Integromat', category: 'Automation', description: 'Visual automation scenarios for multi-step data pipelines.' },
  { id: 'pabbly', name: 'Pabbly Connect', category: 'Automation', description: 'Affordable webhook & trigger automation for Indian businesses.' },
  { id: 'hubspot', name: 'HubSpot', category: 'CRM', description: 'Two-way sync of deals, calls, and contact details.' },
];

const CATEGORIES = ['All', 'CRM', 'Storage', 'Marketing', 'Marketplace', 'Automation'] as const;

export default function IntegrationsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [search, setSearch] = useState('');
  const [activeModalApp, setActiveModalApp] = useState<IntegrationApp | null>(null);

  const filteredApps = INTEGRATION_APPS.filter((app) => {
    const matchesCat = selectedCategory === 'All' || app.category === selectedCategory;
    const matchesSearch = app.name.toLowerCase().includes(search.toLowerCase());
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 animate-in fade-in duration-200">
      {/* Header matching Screenshot 6 */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
            <Plug className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">Add Integration</h1>
        </div>
        <p className="text-xs text-slate-500 mt-1">Choose an app to connect with your account.</p>
      </div>

      {/* Filter Row with Search & Category Pills matching Screenshot 6 */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid of Integration Cards matching Screenshot 6 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {filteredApps.map((app) => (
          <div
            key={app.id}
            onClick={() => setActiveModalApp(app)}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
          >
            <div>
              <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-blue-600 mb-3 group-hover:scale-105 transition">
                <Globe className="w-6 h-6" />
              </div>

              <h3 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition">{app.name}</h3>
              <p className="text-[11px] text-slate-500 mt-1 line-clamp-2 leading-relaxed">{app.description}</p>
            </div>

            <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{app.category}</span>
              {app.connected ? (
                <span className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>Connected</span>
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-blue-600 group-hover:underline">Configure →</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ─── INTEGRATION DETAILS / SETUP MODAL ─── */}
      {activeModalApp && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6 border border-slate-200 animate-in zoom-in-95 duration-150 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{activeModalApp.name}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {activeModalApp.category}
                  </span>
                </div>
              </div>
              <button onClick={() => setActiveModalApp(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">{activeModalApp.description}</p>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
              <span className="font-bold text-slate-800">Your Webhook Ingestion URL:</span>
              <div className="p-2.5 bg-white border border-slate-200 rounded-lg font-mono text-[11px] text-blue-600 break-all select-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/webhooks/{activeModalApp.id}
              </div>
              <p className="text-[11px] text-slate-500">
                Send incoming POST requests with phone and name to automatically create leads and assign them to your sales reps.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setActiveModalApp(null)}
                className="px-4 py-2 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold hover:bg-slate-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  alert(`Integration saved for ${activeModalApp.name}`);
                  setActiveModalApp(null);
                }}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-sm transition"
              >
                Connect App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

