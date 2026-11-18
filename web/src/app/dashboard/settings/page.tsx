'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { User, Shield, Building, Edit3, CalendarOff, QrCode, Plus, X, Loader2, Smartphone, RefreshCw, Copy, Check } from 'lucide-react';
import { fetchWithAuth, API_BASE } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Toast } from '@/components/ui';

type NavSection = 'profile' | 'team' | 'security' | 'organization';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  isOnLeave: boolean;
  deviceToken: string | null;
  devices: Array<{ id: string; deviceName: string | null; lastSyncAt: string | null; batteryLevel: number | null }>;
  stats: { totalCalls: number; connectRate: number; totalTalkTimeFormatted: string; missedCalls: number };
}

export default function SettingsPage() {
  const { user, org, refreshUser } = useAuth();
  const [activeSection, setActiveSection] = useState<NavSection>('profile');
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [teamLoading, setTeamLoading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPairModal, setShowPairModal] = useState<{ name: string; token: string } | null>(null);
  const [addLoading, setAddLoading] = useState(false);
  const [leaveLoading, setLeaveLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', password: '', phone: '', role: 'AGENT' });

  const loadTeam = useCallback(async () => {
    setTeamLoading(true);
    try {
      const data = await fetchWithAuth('/team');
      setTeam(data || []);
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setTeamLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === 'team') loadTeam();
  }, [activeSection, loadTeam]);

  const toggleLeave = async () => {
    setLeaveLoading(true);
    try {
      const data = await fetchWithAuth('/auth/leave/toggle', { method: 'POST', body: JSON.stringify({}) });
      await refreshUser();
      setToast({ message: data.message, type: 'info' });
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setLeaveLoading(false);
    }
  };

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddLoading(true);
    try {
      const data = await fetchWithAuth('/team', { method: 'POST', body: JSON.stringify(newMember) });
      setToast({ message: `${data.member.name} added. Pairing token: ${data.member.deviceToken}`, type: 'success' });
      setShowAddModal(false);
      setNewMember({ name: '', email: '', password: '', phone: '', role: 'AGENT' });
      loadTeam();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    } finally {
      setAddLoading(false);
    }
  };

  const getPairingToken = async (userId: string, memberName: string) => {
    try {
      const data = await fetchWithAuth(`/team/${userId}/pairing-token`, { method: 'POST', body: '{}' });
      setShowPairModal({ name: memberName, token: data.deviceToken });
      loadTeam();
    } catch (err: any) {
      setToast({ message: err.message, type: 'error' });
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navItems: { id: NavSection; label: string; icon: React.ReactNode; group: 'account' | 'workspace' }[] = [
    { id: 'profile', label: 'Profile', icon: <User className="w-4 h-4" />, group: 'account' },
    { id: 'team', label: 'Team & Devices', icon: <Smartphone className="w-4 h-4" />, group: 'account' },
    { id: 'security', label: 'Password & Security', icon: <Shield className="w-4 h-4" />, group: 'account' },
    { id: 'organization', label: 'Organization', icon: <Building className="w-4 h-4" />, group: 'workspace' },
  ];

  const initials = user?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() || '';

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <span className="text-xs text-slate-400">← Back to dashboard</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-start">
        {/* Left Nav */}
        <div className="space-y-5">
          {(['account', 'workspace'] as const).map(group => (
            <div key={group}>
              <div className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2 px-3">{group}</div>
              <nav className="space-y-0.5">
                {navItems.filter(n => n.group === group).map(item => (
                  <button key={item.id} onClick={() => setActiveSection(item.id)}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold rounded-lg transition ${
                      activeSection === item.id ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}>
                    {item.icon}<span>{item.label}</span>
                  </button>
                ))}
              </nav>
            </div>
          ))}
        </div>

        {/* Right Content */}
        <div className="md:col-span-3 space-y-5">
          {activeSection === 'profile' && user && (
            <>
              {/* Profile Hero */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white font-bold text-xl flex items-center justify-center shadow-md">
                    {initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-bold text-slate-900 text-lg">{user.name}</h2>
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded border border-blue-200 uppercase">{user.role}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Building className="w-3.5 h-3.5 text-slate-400" />
                      <span>{org?.name}</span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                  user.isOnLeave
                    ? 'text-amber-700 bg-amber-50 border-amber-200'
                    : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${user.isOnLeave ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
                  {user.isOnLeave ? 'On Leave' : 'Active'}
                </span>
              </div>

              {/* Personal Details */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Personal Details</h3>
                    <p className="text-xs text-slate-400">Your profile, visible to teammates.</p>
                  </div>
                  <button className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 px-2 py-1 rounded-lg">
                    <Edit3 className="w-3.5 h-3.5" /><span>Edit</span>
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { label: 'Full Name', value: user.name },
                    { label: 'Work Email', value: user.email },
                    { label: 'Phone', value: user.phone || '—' },
                    { label: 'Role', value: user.role },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
                      <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Availability */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Availability</h3>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-md">
                      When on leave, new leads from Meta Ads, Google Ads, and manual entry will automatically skip you and be assigned to the next available agent.
                    </p>
                  </div>
                  <button onClick={toggleLeave} disabled={leaveLoading}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition shadow-sm border disabled:opacity-60 ${
                      user.isOnLeave
                        ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}>
                    {leaveLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CalendarOff className="w-4 h-4 text-slate-500" />}
                    <span>{user.isOnLeave ? 'Return from Leave' : 'Mark Leave'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === 'team' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Team Members</h3>
                  <p className="text-xs text-slate-400">Manage agents, roles, and Android device pairing tokens.</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={loadTeam} disabled={teamLoading} className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg">
                    <RefreshCw className={`w-4 h-4 ${teamLoading ? 'animate-spin' : ''}`} />
                  </button>
                  <button onClick={() => setShowAddModal(true)}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 shadow-sm">
                    <Plus className="w-3.5 h-3.5" /><span>Add Agent</span>
                  </button>
                </div>
              </div>

              {teamLoading ? (
                <div className="space-y-4">{[1,2].map(i => (
                  <div key={i} className="flex items-center gap-4 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-slate-100" />
                    <div className="flex-1 space-y-2"><div className="h-4 bg-slate-100 rounded w-1/3" /><div className="h-3 bg-slate-100 rounded w-1/2" /></div>
                  </div>
                ))}</div>
              ) : (
                <div className="space-y-3">
                  {team.map(member => (
                    <div key={member.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200 transition">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 font-bold text-sm flex items-center justify-center">
                            {member.name.split(' ').map((n: string) => n[0]).slice(0,2).join('')}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{member.name}</span>
                              <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{member.role}</span>
                              {member.isOnLeave && <span className="text-[10px] font-semibold bg-amber-100 text-amber-700 px-2 py-0.5 rounded">On Leave</span>}
                            </div>
                            <div className="text-xs text-slate-400 mt-0.5">{member.email}{member.phone ? ` · ${member.phone}` : ''}</div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              {member.stats.totalCalls} calls · {member.stats.connectRate}% rate · {member.stats.totalTalkTimeFormatted}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {member.devices.length > 0 ? (
                            <div className="text-right">
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                {member.devices[0].deviceName || 'Android Connected'}
                              </span>
                              <div className="text-[10px] text-slate-400 mt-0.5">
                                Active · {new Date(member.devices[0].lastSyncAt || Date.now()).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">No device</span>
                          )}
                          <button onClick={() => getPairingToken(member.id, member.name)}
                            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 font-semibold hover:bg-blue-50 px-2 py-1 rounded-lg transition">
                            <QrCode className="w-3.5 h-3.5" /><span>Pair</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeSection === 'security' && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
              <h3 className="font-bold text-slate-900 text-sm mb-4">Password & Security</h3>
              <form className="space-y-4 max-w-sm" onSubmit={e => { e.preventDefault(); setToast({ message: 'Password change coming soon', type: 'info' }); }}>
                {['Current password', 'New password', 'Confirm new password'].map(label => (
                  <div key={label}>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
                    <input type="password" placeholder="••••••••" className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                ))}
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700">Update Password</button>
              </form>
            </div>
          )}

          {activeSection === 'organization' && org && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: 'Company Name', value: org.name },
                  { label: 'Workspace Slug', value: org.slug },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">{label}</label>
                    <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-700">{value}</div>
                  </div>
                ))}
              </div>
              <div className="pt-4 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-500 uppercase mb-2">Meta Ads Webhook URL</div>
                <div className="bg-slate-900 rounded-lg px-3 py-2 font-mono text-xs text-emerald-400 select-all">
                  {`${API_BASE}/webhooks/meta`}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">Add this URL as the callback in your Meta Business Manager &gt; Webhooks &gt; Lead Ads.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-bold text-slate-900">Add Team Member</h3>
                <p className="text-xs text-slate-400 mt-0.5">A pairing token will be generated for their Android app.</p>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={addMember} className="space-y-4">
              {[
                { label: 'Full Name *', name: 'name', type: 'text', placeholder: 'John Doe' },
                { label: 'Email *', name: 'email', type: 'email', placeholder: 'agent@company.com' },
                { label: 'Temporary Password *', name: 'password', type: 'password', placeholder: 'Min 8 characters' },
                { label: 'Phone', name: 'phone', type: 'tel', placeholder: '+919XXXXXXXXX' },
              ].map(f => (
                <div key={f.name}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">{f.label}</label>
                  <input type={f.type} required={f.label.includes('*')}
                    value={(newMember as any)[f.name]}
                    onChange={e => setNewMember({ ...newMember, [f.name]: e.target.value })}
                    placeholder={f.placeholder}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Role</label>
                <select value={newMember.role} onChange={e => setNewMember({ ...newMember, role: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="AGENT">Sales Agent</option>
                  <option value="MANAGER">Manager</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={addLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
                  {addLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {addLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pairing Token Modal */}
      {showPairModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowPairModal(null)}>
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center" onClick={e => e.stopPropagation()}>
            <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-4">
              <QrCode className="w-7 h-7" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Android Pairing Token</h3>
            <p className="text-xs text-slate-500 mt-1 mb-5">
              Enter this token in <strong>{showPairModal.name}</strong>&apos;s Android CRM companion app to pair their phone.
            </p>
            <div className="bg-slate-900 rounded-xl p-4 font-mono text-lg font-bold text-emerald-400 tracking-widest select-all mb-4">
              {showPairModal.token}
            </div>
            <button onClick={() => copyToken(showPairModal.token)}
              className="flex items-center gap-2 mx-auto text-xs font-semibold text-slate-600 hover:text-slate-900 mb-5">
              {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied!' : 'Copy token'}
            </button>
            <div className="text-[11px] text-slate-400 bg-blue-50 rounded-lg p-3 text-left mb-4">
              <strong>Steps:</strong><br />
              1. Install the CRM Companion APK on the agent&apos;s Android phone<br />
              2. Enter your server URL<br />
              3. Paste this token and tap &quot;Connect&quot;<br />
              4. Grant call log & audio permissions
            </div>
            <button onClick={() => setShowPairModal(null)}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-semibold hover:bg-slate-800">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
