'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  Zap,
  Users,
  Target,
  HardDrive,
  Check,
  X,
  Loader2,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  Printer,
} from 'lucide-react';
import { fetchWithAuth } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Toast } from '@/components/ui';

interface Plan {
  id: string;
  name: string;
  displayName: string;
  tier: string;
  description?: string;
  priceMonthly: number;
  priceYearly: number;
  currency: string;
  maxUsers: number;
  maxLeads: number;
  storageQuotaBytes: number;
  features?: Record<string, boolean>;
  sortOrder: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  description?: string;
  gatewayPaymentId?: string;
  paidAt?: string;
  dueDate?: string;
  createdAt: string;
}

interface BillingOverview {
  organization: {
    id: string;
    name: string;
    slug: string;
    orgStatus: string;
    planTier: string;
    trialEndsAt?: string | null;
    maxUsers: number;
    maxLeads: number;
    storageQuotaBytes: number;
    storageUsedBytes: number;
  };
  usage: {
    usersCount: number;
    usersLimit: number;
    leadsCount: number;
    leadsLimit: number;
    storageUsedBytes: number;
    storageQuotaBytes: number;
    callsCount: number;
  };
  subscription?: {
    id: string;
    status: string;
    currentPeriodStart: string;
    currentPeriodEnd: string;
    trialEnd?: string | null;
  } | null;
  currentPlan?: Plan | null;
  availablePlans: Plan[];
  invoices: Invoice[];
  isRazorpayConfigured: boolean;
  razorpayKeyId?: string;
}

export default function BillingPage() {
  const { user, refreshUser } = useAuth();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [upgradingPlanId, setUpgradingPlanId] = useState<string | null>(null);
  const [purchasingAddon, setPurchasingAddon] = useState<number | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const inrFormatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  const loadBilling = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchWithAuth('/billing/overview');
      setData(res);
    } catch (err: any) {
      console.error('Failed to load billing:', err);
      setToast({ message: err.message || 'Failed to load billing information.', type: 'error' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Load Razorpay Script dynamically when needed
  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve(false);
      if ((window as any).Razorpay) return resolve(true);

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleUpgradePlan = async (plan: Plan) => {
    try {
      setUpgradingPlanId(plan.id);

      // 1. Create order on backend
      const orderData = await fetchWithAuth('/billing/create-order', {
        method: 'POST',
        body: JSON.stringify({
          planId: plan.id,
          billingCycle,
        }),
      });

      // Free Tier upgrade
      if (orderData.isFree) {
        await fetchWithAuth('/billing/verify-payment', {
          method: 'POST',
          body: JSON.stringify({
            planId: plan.id,
            billingCycle,
            razorpayOrderId: 'free_plan_order',
            razorpayPaymentId: 'free_plan_payment',
          }),
        });
        setToast({ message: `Your workspace has been switched to ${plan.displayName}!`, type: 'success' });
        loadBilling();
        refreshUser();
        return;
      }

      // Simulated Payment Mode (Dev / Test / Without live keys)
      if (orderData.isSimulated || !orderData.isConfigured) {
        const confirmPay = window.confirm(
          `Demo Payment Gateway:\n\nUpgrade to ${plan.displayName} (${billingCycle.toUpperCase()}) for ${inrFormatter.format(
            orderData.amount / 100
          )}?\n\n(Click OK to simulate instant successful payment and activate your plan)`
        );

        if (!confirmPay) {
          setUpgradingPlanId(null);
          return;
        }

        const verifyRes = await fetchWithAuth('/billing/verify-payment', {
          method: 'POST',
          body: JSON.stringify({
            planId: plan.id,
            billingCycle,
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: `pay_sim_${Date.now()}`,
          }),
        });

        setToast({
          message: `🎉 Success! Upgraded to ${verifyRes.planName}. Invoice ${verifyRes.invoiceNumber} generated.`,
          type: 'success',
        });
        loadBilling();
        refreshUser();
        return;
      }

      // Live Razorpay Checkout flow
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setToast({ message: 'Failed to load Razorpay payment gateway. Please check your internet connection.', type: 'error' });
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'CRM-LEAD SaaS',
        description: `Upgrade to ${plan.displayName} (${billingCycle.toUpperCase()})`,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
          contact: user?.phone || '',
        },
        theme: {
          color: '#2563EB',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetchWithAuth('/billing/verify-payment', {
              method: 'POST',
              body: JSON.stringify({
                planId: plan.id,
                billingCycle,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            setToast({
              message: `🎉 Success! Upgraded to ${verifyRes.planName}. Invoice ${verifyRes.invoiceNumber} generated.`,
              type: 'success',
            });
            loadBilling();
            refreshUser();
          } catch (verifyErr: any) {
            setToast({ message: verifyErr.message || 'Payment verification failed.', type: 'error' });
          }
        },
        modal: {
          ondismiss: () => {
            setUpgradingPlanId(null);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err: any) {
      console.error('Upgrade error:', err);
      setToast({ message: err.message || 'Failed to initialize plan upgrade.', type: 'error' });
    } finally {
      setUpgradingPlanId(null);
    }
  };

  const handleBuyStorageAddon = async (extraGB: number) => {
    try {
      setPurchasingAddon(extraGB);

      const orderData = await fetchWithAuth('/billing/storage-addon/order', {
        method: 'POST',
        body: JSON.stringify({ extraGB }),
      });

      if (orderData.isSimulated || !orderData.isConfigured) {
        const confirmPay = window.confirm(
          `Demo Payment Gateway:\n\nPurchase ${orderData.label} for ${inrFormatter.format(
            orderData.amount / 100
          )}?\n\n(Click OK to simulate instant successful payment)`
        );

        if (!confirmPay) {
          setPurchasingAddon(null);
          return;
        }

        const verifyRes = await fetchWithAuth('/billing/storage-addon/verify', {
          method: 'POST',
          body: JSON.stringify({
            extraGB,
            razorpayOrderId: orderData.orderId,
            razorpayPaymentId: `addon_pay_sim_${Date.now()}`,
          }),
        });

        setToast({
          message: `🎉 Success! Added +${verifyRes.addedGB} GB storage quota. Total quota is now ${verifyRes.newQuotaGB} GB.`,
          type: 'success',
        });
        loadBilling();
        refreshUser();
        return;
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        setToast({ message: 'Failed to load Razorpay payment gateway.', type: 'error' });
        return;
      }

      const options = {
        key: orderData.keyId,
        amount: orderData.amount,
        currency: orderData.currency || 'INR',
        name: 'CRM-LEAD Storage Addon',
        description: orderData.label,
        order_id: orderData.orderId,
        prefill: {
          name: user?.name || '',
          email: user?.email || '',
        },
        theme: {
          color: '#06B6D4',
        },
        handler: async (response: any) => {
          try {
            const verifyRes = await fetchWithAuth('/billing/storage-addon/verify', {
              method: 'POST',
              body: JSON.stringify({
                extraGB,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
              }),
            });

            setToast({
              message: `🎉 Success! Added +${verifyRes.addedGB} GB storage quota. Total quota: ${verifyRes.newQuotaGB} GB.`,
              type: 'success',
            });
            loadBilling();
            refreshUser();
          } catch (err: any) {
            setToast({ message: err.message || 'Verification failed.', type: 'error' });
          }
        },
        modal: {
          ondismiss: () => {
            setPurchasingAddon(null);
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to start storage addon purchase.', type: 'error' });
    } finally {
      setPurchasingAddon(null);
    }
  };

  const usersPct = data?.usage ? Math.min(100, Math.round((data.usage.usersCount / Math.max(data.usage.usersLimit, 1)) * 100)) : 0;
  const leadsPct = data?.usage ? Math.min(100, Math.round((data.usage.leadsCount / Math.max(data.usage.leadsLimit, 1)) * 100)) : 0;
  const storageGB = data?.usage ? data.usage.storageQuotaBytes / (1024 * 1024 * 1024) : 1;
  const storageUsedMB = data?.usage ? data.usage.storageUsedBytes / (1024 * 1024) : 0;
  const storagePct = data?.usage ? Math.min(100, Math.round((data.usage.storageUsedBytes / Math.max(data.usage.storageQuotaBytes, 1)) * 100)) : 0;

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-200">
      {toast && <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Billing & Subscription</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage your organization tier, view quota usage limits, and download invoices.
          </p>
        </div>

        <button
          onClick={loadBilling}
          disabled={loading}
          className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 shadow-2xs transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-600' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center bg-white rounded-3xl border border-slate-200/80 shadow-xs">
          <Loader2 className="w-7 h-7 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-xs font-medium text-slate-500">Loading plan allocations and subscription data...</p>
        </div>
      ) : (
        <>
          {/* Active Plan & Resource Gauges Card */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Current Plan summary */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl p-6 text-white shadow-xl flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-200">
                    Current Plan
                  </span>
                  <span className="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase bg-white/20 text-white backdrop-blur-xs">
                    {data?.organization.planTier || 'FREE'}
                  </span>
                </div>

                <h2 className="text-2xl font-black mt-3">
                  {data?.currentPlan?.displayName || `${data?.organization.planTier} Plan`}
                </h2>
                <p className="text-xs text-blue-100 mt-1">
                  {data?.currentPlan?.description || 'Standard multi-tenant CRM allocation.'}
                </p>

                {data?.subscription?.currentPeriodEnd && (
                  <div className="mt-4 pt-4 border-t border-white/20 text-xs flex items-center gap-2 text-blue-100">
                    <Clock className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Renews on{' '}
                      <strong>
                        {new Date(data.subscription.currentPeriodEnd).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </strong>
                    </span>
                  </div>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-white/20 flex items-center justify-between">
                <span className="text-xs text-blue-100 font-medium">Status</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-400/20 text-emerald-200 border border-emerald-400/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {data?.organization.orgStatus || 'ACTIVE'}
                </span>
              </div>
            </div>

            {/* Right: Real-time Quota Bars */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-5">
              <div>
                <h3 className="text-base font-bold text-slate-900">Resource Utilization</h3>
                <p className="text-xs text-slate-500 mt-0.5">Live usage against your plan limits.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Team Members Gauge */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Users className="w-3.5 h-3.5 text-blue-600" />
                      <span>Telecallers</span>
                    </div>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {data?.usage.usersCount} / {data?.usage.usersLimit}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${
                        usersPct > 90 ? 'bg-rose-500' : 'bg-blue-600'
                      }`}
                      style={{ width: `${usersPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {data ? data.usage.usersLimit - data.usage.usersCount : 0} seats available
                  </span>
                </div>

                {/* Lead Storage Gauge */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <Target className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Leads Cap</span>
                    </div>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {data?.usage.leadsCount} / {data && data.usage.leadsLimit >= 10000000 ? 'Unlimited' : data?.usage.leadsLimit.toLocaleString()}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full transition-all duration-500 bg-emerald-600"
                      style={{ width: `${data && data.usage.leadsLimit >= 10000000 ? 5 : leadsPct}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 mt-1.5 block">
                    {data ? (data.usage.leadsLimit >= 10000000 ? 'Unlimited leads allowed' : `${(data.usage.leadsLimit - data.usage.leadsCount).toLocaleString()} leads remaining`) : ''}
                  </span>
                </div>

                {/* Storage Quota Gauge */}
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <HardDrive className="w-3.5 h-3.5 text-purple-600" />
                      <span>Recording Disk</span>
                    </div>
                    <span className="font-mono text-slate-600 text-[11px]">
                      {storageUsedMB.toFixed(1)} MB / {storageGB < 1 ? `${Math.round(storageGB * 1024)} MB` : `${storageGB.toFixed(1)} GB`}
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 rounded-full bg-purple-600 transition-all duration-500"
                      style={{ width: `${Math.max(2, storagePct)}%` }}
                    />
                  </div>
                  <Link
                    href="/dashboard/settings?tab=storage"
                    className="text-[10px] text-blue-600 hover:text-blue-700 font-semibold mt-1.5 inline-flex items-center gap-1"
                  >
                    <span>Connect Free 15 GB Drive</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Managed by Super Administrator Info Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 text-white shadow-xl space-y-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base font-bold text-white">Platform Governance & Subscription Control</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed max-w-2xl">
              Your organization&apos;s subscription plan, pricing, telecaller user seats, and storage quotas are managed exclusively by the Platform Super Administrator. Self-serve plan switching is disabled to prevent unauthorized account modifications.
            </p>
            <div className="p-4 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="text-slate-400">Need to add more telecallers, expand storage, or activate full plan?</span>
              <a
                href="mailto:support@staffcaller.cloud?subject=StaffCaller Workspace Plan Upgrade"
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <span>Contact Administrator</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>

          {/* Invoices History Table */}
          <div className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Invoices & Billing History</h3>
                  <p className="text-xs text-slate-500">Official tax receipts and subscription payment logs.</p>
                </div>
              </div>
              <span className="text-xs font-semibold text-slate-500">
                {(data?.invoices || []).length} Invoices
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-700">
                <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-5">Invoice #</th>
                    <th className="py-3 px-5">Description</th>
                    <th className="py-3 px-5">Amount</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Date</th>
                    <th className="py-3 px-5 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(data?.invoices || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                        <FileText className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                        <span>No invoices generated yet. Invoices appear here once you subscribe to a paid tier.</span>
                      </td>
                    </tr>
                  ) : (
                    data?.invoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                        <td className="py-3.5 px-5 font-mono text-xs font-bold text-slate-900">
                          {inv.invoiceNumber}
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-600">
                          {inv.description || 'CRM Subscription'}
                        </td>
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {inrFormatter.format((inv.amount || 0) / 100)}
                        </td>
                        <td className="py-3.5 px-5">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              inv.status === 'PAID'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 text-xs text-slate-500">
                          {new Date(inv.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="py-3.5 px-5 text-right">
                          <button
                            type="button"
                            onClick={() => setViewingInvoice(inv)}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 transition"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>View</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Invoice View & Print Modal */}
      {viewingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-xl p-8 shadow-2xl border border-slate-200 space-y-6 my-8 animate-scale-in text-slate-900">
            {/* Header */}
            <div className="flex items-start justify-between pb-6 border-b border-slate-200">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-blue-500/20">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 tracking-tight">CRM-LEAD Platform</h3>
                  <p className="text-xs text-slate-500">Tax Invoice & Official Receipt</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewingInvoice(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Invoice Meta */}
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-slate-400 block uppercase font-bold tracking-wider mb-0.5">Billed To:</span>
                <p className="font-bold text-slate-900 text-sm">{data?.organization.name}</p>
                <p className="text-slate-500">{user?.email}</p>
              </div>
              <div className="text-right">
                <span className="text-slate-400 block uppercase font-bold tracking-wider mb-0.5">Invoice Number:</span>
                <p className="font-mono font-bold text-slate-900 text-sm">{viewingInvoice.invoiceNumber}</p>
                <p className="text-slate-500">
                  Date: {new Date(viewingInvoice.createdAt).toLocaleDateString('en-IN', { dateStyle: 'medium' })}
                </p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-100 text-emerald-800">
                  Status: {viewingInvoice.status}
                </span>
              </div>
            </div>

            {/* Line Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold text-[10px]">
                  <tr>
                    <th className="py-2.5 px-4 text-left">Item Description</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <tr>
                    <td className="py-3 px-4 font-medium text-slate-800">
                      {viewingInvoice.description || 'Platform Subscription'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-slate-900">
                      {inrFormatter.format((viewingInvoice.amount || 0) / 100)}
                    </td>
                  </tr>
                </tbody>
                <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold text-slate-900">
                  <tr>
                    <td className="py-2.5 px-4 text-left">Total Paid:</td>
                    <td className="py-2.5 px-4 text-right font-mono text-sm text-blue-600">
                      {inrFormatter.format((viewingInvoice.amount || 0) / 100)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Reference info */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Transaction Ref: <code className="text-slate-700 font-mono font-semibold">{viewingInvoice.gatewayPaymentId || 'PAID-OFFLINE'}</code></span>
              <span>Currency: {viewingInvoice.currency}</span>
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setViewingInvoice(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 transition shadow-md shadow-blue-600/20"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Invoice</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
