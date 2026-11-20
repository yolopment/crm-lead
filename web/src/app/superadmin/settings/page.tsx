'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings,
  Shield,
  Server,
  Key,
  Database,
  Lock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { getSaasAdmin, SaasAdminProfile, API_BASE } from '@/lib/saas-api';

export default function SuperAdminSettingsPage() {
  const [admin, setAdmin] = useState<SaasAdminProfile | null>(null);

  useEffect(() => {
    const current = getSaasAdmin();
    if (current) setAdmin(current);
  }, []);

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
          <span>Platform Settings & Governance</span>
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Root administrator identity, platform environment, and security policies.
        </p>
      </div>

      {/* Admin Profile */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-800 mb-6">
          <div className="w-10 h-10 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Super Administrator Profile</h2>
            <p className="text-xs text-slate-400">Authenticated Root Session</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
              Admin Name
            </div>
            <div className="text-slate-200 font-medium">{admin?.name || 'Super Admin'}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
              Account Email
            </div>
            <div className="text-slate-200 font-medium">{admin?.email || 'admin@crm-lead.com'}</div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
              Assigned Role
            </div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {admin?.saasRole || 'SUPER_ADMIN'}
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950 border border-slate-850">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">
              Identity ID
            </div>
            <div className="text-slate-400 font-mono text-xs truncate">{admin?.id || 'Root'}</div>
          </div>
        </div>
      </div>

      {/* System Environment */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center gap-3 pb-5 border-b border-slate-800 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">Platform Architecture</h2>
            <p className="text-xs text-slate-400">Environment and API configuration</p>
          </div>
        </div>

        <div className="space-y-3 text-xs">
          <div className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-850">
            <span className="text-slate-400">API Gateway Base URL</span>
            <span className="font-mono text-slate-200">{API_BASE}</span>
          </div>

          <div className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-850">
            <span className="text-slate-400">Multi-Tenancy Mode</span>
            <span className="font-medium text-emerald-400">Logical Isolation (Prisma ORM)</span>
          </div>

          <div className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-850">
            <span className="text-slate-400">Storage Drivers Supported</span>
            <span className="text-slate-200 font-mono">Local Disk • Cloudflare R2 • Google Drive OAuth</span>
          </div>

          <div className="flex justify-between items-center py-2.5 px-4 rounded-xl bg-slate-950 border border-slate-850">
            <span className="text-slate-400">Security / JWT Auth</span>
            <span className="text-slate-200 font-medium">HMAC-SHA256 with Bearer Tokenization</span>
          </div>
        </div>
      </div>
    </div>
  );
}
