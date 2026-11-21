'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Shield,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { fetchSaasApi, setSaasToken, setSaasAdmin, getSaasToken } from '@/lib/saas-api';

export default function SuperAdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, navigate straight to dashboard
  useEffect(() => {
    if (getSaasToken()) {
      router.replace('/superadmin');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetchSaasApi('/login', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });

      if (res?.token) {
        setSaasToken(res.token);
        if (res.admin) {
          setSaasAdmin(res.admin);
        }
        window.location.href = '/superadmin';
      } else {
        setError('Login failed: No authorization token received.');
      }
    } catch (err: any) {
      console.error('Super Admin login error:', err);
      setError(err.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background radial effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Grid Pattern */}
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(148, 163, 184, 0.2) 1px, transparent 0)`,
          backgroundSize: '28px 28px',
        }}
      />

      <div className="w-full max-w-md relative z-10">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <img
            src="/logo.png"
            alt="StaffCaller"
            className="w-16 h-16 rounded-2xl shadow-xl shadow-blue-900/40 mb-4 mx-auto border border-blue-400/20 object-cover"
          />
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            StaffCaller Platform Admin
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Multi-Tenant SaaS Control Center & System Governance
          </p>
        </div>

        {/* Card */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-7 shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between pb-5 border-b border-slate-800 mb-6">
            <div>
              <h2 className="text-base font-semibold text-white">Platform Authentication</h2>
              <p className="text-xs text-slate-400">Enter your SaaS super admin credentials</p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Sparkles className="w-3 h-3" /> Root Access
            </span>
          </div>

          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-950/60 border border-red-800/60 text-red-300 text-xs flex items-start gap-2.5 animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} method="POST" action="#" className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Admin Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@crmlead.com"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5 uppercase tracking-wider">
                Master Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-2.5 bg-slate-950/80 border border-slate-800 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-600/30 transition duration-150"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Authenticating...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Super Admin</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Credentials Info Box */}
            <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-300">Default Root Access:</span>
                <span className="text-[10px] text-emerald-400 font-mono">ACTIVE</span>
              </div>
              <div className="text-xs font-mono text-slate-300 flex items-center justify-between">
                <span>admin@crmlead.com</span>
                <span className="text-slate-500">SuperAdmin@123</span>
              </div>
            </div>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center text-xs text-slate-500">
            Internal Platform Governance • CRM-LEAD Cloud v1.0
          </div>
        </div>
      </div>
    </div>
  );
}
