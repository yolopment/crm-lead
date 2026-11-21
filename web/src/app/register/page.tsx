'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Phone, Loader2, CheckCircle2, ShieldCheck } from 'lucide-react';
import { getApiBase } from '@/lib/api';

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteToken = searchParams.get('invite');

  const [form, setForm] = useState({
    organizationName: '',
    name: '',
    email: '',
    password: '',
    phone: '',
  });

  const [inviteData, setInviteData] = useState<{
    email: string;
    role: string;
    organizationName: string;
  } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // If invite token is present, load invitation details
  useEffect(() => {
    if (inviteToken) {
      setIsLoading(true);
      fetch(`${getApiBase()}/auth/invite/${inviteToken}`)
        .then((res) => {
          if (!res.ok) throw new Error('Invalid or expired invitation link');
          return res.json();
        })
        .then((data) => {
          setInviteData(data);
          setForm((prev) => ({
            ...prev,
            email: data.email,
            organizationName: data.organizationName,
          }));
        })
        .catch((err) => {
          setError(err.message || 'Invitation is invalid');
        })
        .finally(() => setIsLoading(false));
    }
  }, [inviteToken]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (inviteToken) {
        // Accept Invitation flow
        const res = await fetch(`${getApiBase()}/auth/accept-invite`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: inviteToken,
            name: form.name,
            password: form.password,
            phone: form.phone,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to accept invitation');
        localStorage.setItem('crm_token', data.token);
        router.push('/dashboard/calls');
      } else {
        // Create new organization flow
        const res = await fetch(`${getApiBase()}/auth/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Registration failed');
        localStorage.setItem('crm_token', data.token);
        router.push('/dashboard/calls');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)',
      }}
    >
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />

      <div className="w-full max-w-[380px] relative z-10 py-8">
        <div className="flex flex-col items-center mb-7">
          <img
            src="/logo.png"
            alt="StaffCaller"
            className="w-16 h-16 rounded-2xl shadow-xl shadow-blue-900/40 mb-3.5 object-cover"
          />
          <h1 className="text-[22px] font-bold text-white tracking-tight">StaffCaller</h1>
          <p className="text-sm text-white/45 mt-0.5">
            {inviteData ? `Join ${inviteData.organizationName}` : 'Create your workspace'}
          </p>
        </div>

        <div
          className="rounded-2xl p-7"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <h2 className="text-base font-semibold text-white mb-2">
            {inviteData ? 'Accept Team Invitation' : 'New Organization'}
          </h2>

          {inviteData && (
            <div
              className="p-3 rounded-xl mb-5 flex items-center gap-2.5 text-xs text-emerald-300"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.25)',
              }}
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                Invited as <strong className="text-white font-semibold">{inviteData.role}</strong> at{' '}
                <strong className="text-white font-semibold">{inviteData.organizationName}</strong>
              </span>
            </div>
          )}

          {error && (
            <div
              className="mb-4 p-3 rounded-lg text-sm"
              style={{
                background: 'rgba(220,38,38,0.12)',
                border: '1px solid rgba(220,38,38,0.25)',
                color: '#fca5a5',
              }}
            >
              {error}
            </div>
          )}

          {!inviteData && (
            <>
              {/* Sign up with Google */}
              <a
                href="/api/v1/auth/google"
                className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold text-white transition flex items-center justify-center gap-3 mb-4 hover:bg-white/10 active:scale-[0.99]"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.16)',
                }}
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Continue with Google</span>
              </a>

              {/* Divider */}
              <div className="relative flex items-center justify-center mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <span
                  className="relative px-3 text-[11px] uppercase tracking-wider text-white/40 rounded-full"
                  style={{ background: '#171929' }}
                >
                  or register with email
                </span>
              </div>
            </>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {!inviteData && (
              <div>
                <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-widest">
                  Company / Organization
                </label>
                <input
                  type="text"
                  name="organizationName"
                  required
                  value={form.organizationName}
                  onChange={handleChange}
                  placeholder="Yolopment Pvt Ltd"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition"
                  style={{
                    background: 'rgba(255,255,255,0.07)',
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                />
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-widest">
                Your Full Name
              </label>
              <input
                type="text"
                name="name"
                required
                value={form.name}
                onChange={handleChange}
                placeholder="Rahul Sharma"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-widest">
                Work Email
              </label>
              <input
                type="email"
                name="email"
                required
                disabled={!!inviteData}
                value={form.email}
                onChange={handleChange}
                placeholder="you@company.com"
                className={`w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition ${
                  inviteData ? 'opacity-60 cursor-not-allowed' : ''
                }`}
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-widest">
                Phone Number
              </label>
              <input
                type="tel"
                name="phone"
                value={form.phone}
                onChange={handleChange}
                placeholder="+91 98765 43210"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-white/50 mb-1.5 uppercase tracking-widest">
                {inviteData ? 'Choose Password' : 'Password'}
              </label>
              <input
                type="password"
                name="password"
                required
                value={form.password}
                onChange={handleChange}
                placeholder="Min 6 characters"
                className="w-full px-3.5 py-2.5 rounded-xl text-sm text-white placeholder:text-white/20 focus:outline-none transition"
                style={{
                  background: 'rgba(255,255,255,0.07)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white transition flex items-center justify-center gap-2 pt-2 mt-2"
              style={{
                background: isLoading
                  ? 'rgba(37,99,235,0.6)'
                  : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                opacity: isLoading ? 0.7 : 1,
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>{inviteData ? 'Joining Workspace...' : 'Creating Workspace...'}</span>
                </>
              ) : (
                inviteData ? 'Join Workspace' : 'Create Workspace'
              )}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-white/30">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-400 hover:text-blue-300 font-semibold transition">
              Sign in
            </Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-white/20">
          © 2026 StaffCaller Cloud · All rights reserved
        </p>
      </div>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">Loading...</div>}>
      <RegisterForm />
    </Suspense>
  );
}
