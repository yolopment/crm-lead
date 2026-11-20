import crypto from 'crypto';
import Razorpay from 'razorpay';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';
import { PlanTier, OrgStatus } from '@prisma/client';

/**
 * Check if Razorpay keys are provided in environment
 */
export function isRazorpayConfigured(): boolean {
  return !!config.razorpayKeyId && !!config.razorpayKeySecret;
}

/**
 * Get Razorpay SDK instance
 */
export function getRazorpayClient() {
  if (!isRazorpayConfigured()) {
    return null;
  }
  return new Razorpay({
    key_id: config.razorpayKeyId,
    key_secret: config.razorpayKeySecret,
  });
}

/**
 * List all active subscription plans
 */
export async function listActivePlans() {
  const plans = await prisma.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  return plans.map((p) => ({
    id: p.id,
    name: p.name,
    tier: p.tier,
    displayName: p.displayName,
    description: p.description,
    priceMonthly: p.priceMonthly,
    priceYearly: p.priceYearly,
    currency: p.currency,
    maxUsers: p.maxUsers,
    maxLeads: p.maxLeads,
    storageQuotaBytes: Number(p.storageQuotaBytes),
    maxCallsPerMonth: p.maxCallsPerMonth,
    features: p.features ? JSON.parse(p.features) : {},
    sortOrder: p.sortOrder,
  }));
}

/**
 * Create a payment order for plan upgrade
 */
export async function createPaymentOrder(params: {
  orgId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
}) {
  const { orgId, planId, billingCycle } = params;

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Selected subscription plan not found.');
  }

  const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;

  // Free Tier does not require payment processing
  if (amount <= 0 || plan.tier === PlanTier.FREE) {
    return {
      isFree: true,
      amount: 0,
      currency: plan.currency,
      plan: {
        id: plan.id,
        name: plan.name,
        displayName: plan.displayName,
        tier: plan.tier,
      },
    };
  }

  const receipt = `rcpt_${orgId.replace(/-/g, '').slice(0, 10)}_${Date.now().toString().slice(-6)}`;

  // 1. If Razorpay is configured with live / test credentials
  const razorpay = getRazorpayClient();
  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount,
        currency: plan.currency || 'INR',
        receipt,
        notes: {
          orgId,
          planId: plan.id,
          planName: plan.name,
          billingCycle,
        },
      });

      return {
        isFree: false,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpayKeyId,
        isConfigured: true,
        plan: {
          id: plan.id,
          name: plan.name,
          displayName: plan.displayName,
          tier: plan.tier,
        },
      };
    } catch (err: any) {
      console.error('Error creating Razorpay order:', err);
      throw new Error(`Razorpay order creation failed: ${err.message || 'API error'}`);
    }
  }

  // 2. Simulated/Demo payment order for local development & testing
  const mockOrderId = `order_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    isFree: false,
    orderId: mockOrderId,
    amount,
    currency: plan.currency || 'INR',
    keyId: 'rzp_test_simulated_key',
    isConfigured: false,
    isSimulated: true,
    plan: {
      id: plan.id,
      name: plan.name,
      displayName: plan.displayName,
      tier: plan.tier,
    },
  };
}

/**
 * Verify payment signature and activate client subscription
 */
export async function verifyAndActivateSubscription(params: {
  orgId: string;
  planId: string;
  billingCycle: 'monthly' | 'yearly';
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}) {
  const { orgId, planId, billingCycle, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;

  const plan = await prisma.plan.findUnique({
    where: { id: planId },
  });

  if (!plan) {
    throw new Error('Target plan not found.');
  }

  // Verify HMAC SHA256 signature if real Razorpay is configured
  if (isRazorpayConfigured() && razorpaySignature) {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      throw new Error('Invalid Razorpay payment signature. Payment verification failed.');
    }
  }

  const amount = billingCycle === 'yearly' ? plan.priceYearly : plan.priceMonthly;
  const now = new Date();
  const periodDurationDays = billingCycle === 'yearly' ? 365 : 30;
  const periodEnd = new Date(now.getTime() + periodDurationDays * 24 * 60 * 60 * 1000);

  // Generate sequential invoice number: INV-YYYY-XXXX
  const currentYear = now.getFullYear();
  const invoiceCount = await prisma.invoice.count();
  const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`;

  // 1. Upsert Subscription
  const subscription = await prisma.subscription.upsert({
    where: { orgId },
    create: {
      orgId,
      planId: plan.id,
      status: 'ACTIVE',
      gatewaySubscriptionId: razorpayOrderId,
      gatewayCustomerId: razorpayPaymentId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: null,
    },
    update: {
      planId: plan.id,
      status: 'ACTIVE',
      gatewaySubscriptionId: razorpayOrderId,
      gatewayCustomerId: razorpayPaymentId,
      currentPeriodStart: now,
      currentPeriodEnd: periodEnd,
      trialEnd: null,
      cancelledAt: null,
      cancelReason: null,
    },
  });

  // 2. Create Invoice
  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      subscriptionId: subscription.id,
      invoiceNumber,
      amount,
      currency: plan.currency || 'INR',
      status: 'PAID',
      description: `${plan.displayName} (${billingCycle.toUpperCase()}) - CRM-LEAD Subscription`,
      gatewayPaymentId: razorpayPaymentId,
      paidAt: now,
      dueDate: now,
    },
  });

  // 3. Update Organization with new tier limits
  await prisma.organization.update({
    where: { id: orgId },
    data: {
      planTier: plan.tier,
      orgStatus: OrgStatus.ACTIVE,
      maxUsers: plan.maxUsers,
      maxLeads: plan.maxLeads,
      storageQuotaBytes: plan.storageQuotaBytes,
    },
  });

  console.log(`🎉 Organization ${orgId} successfully upgraded to ${plan.displayName} (${invoiceNumber})`);

  return {
    success: true,
    planTier: plan.tier,
    planName: plan.displayName,
    invoiceNumber: invoice.invoiceNumber,
    expiresAt: periodEnd,
  };
}

/**
 * Get comprehensive client billing overview
 */
export async function getClientBillingOverview(orgId: string) {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    include: {
      subscription: {
        include: {
          plan: true,
        },
      },
      invoices: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      _count: {
        select: {
          users: true,
          leads: true,
          calls: true,
        },
      },
    },
  });

  if (!org) {
    throw new Error('Organization not found.');
  }

  // If no subscription record exists yet, find default or current tier plan
  let currentPlan: any = org.subscription?.plan;
  if (!currentPlan) {
    currentPlan = await prisma.plan.findFirst({
      where: { tier: org.planTier },
    });
  }

  const allPlans = await listActivePlans();

  return {
    organization: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      orgStatus: org.orgStatus,
      planTier: org.planTier,
      trialEndsAt: org.trialEndsAt,
      maxUsers: org.maxUsers,
      maxLeads: org.maxLeads,
      storageQuotaBytes: Number(org.storageQuotaBytes),
      storageUsedBytes: Number(org.storageUsedBytes),
    },
    usage: {
      usersCount: org._count.users,
      usersLimit: org.maxUsers,
      leadsCount: org._count.leads,
      leadsLimit: org.maxLeads,
      storageUsedBytes: Number(org.storageUsedBytes),
      storageQuotaBytes: Number(org.storageQuotaBytes),
      callsCount: org._count.calls,
    },
    subscription: org.subscription
      ? {
          id: org.subscription.id,
          status: org.subscription.status,
          currentPeriodStart: org.subscription.currentPeriodStart,
          currentPeriodEnd: org.subscription.currentPeriodEnd,
          trialEnd: org.subscription.trialEnd,
        }
      : null,
    currentPlan: currentPlan
      ? {
          id: currentPlan.id,
          name: currentPlan.name,
          displayName: currentPlan.displayName,
          tier: currentPlan.tier,
          description: currentPlan.description,
          priceMonthly: currentPlan.priceMonthly,
          priceYearly: currentPlan.priceYearly,
          currency: currentPlan.currency,
          features: currentPlan.features ? JSON.parse(currentPlan.features) : {},
        }
      : null,
    availablePlans: allPlans,
    invoices: org.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      amount: inv.amount,
      currency: inv.currency,
      status: inv.status,
      description: inv.description,
      gatewayPaymentId: inv.gatewayPaymentId,
      paidAt: inv.paidAt,
      dueDate: inv.dueDate,
      createdAt: inv.createdAt,
    })),
    isRazorpayConfigured: isRazorpayConfigured(),
    razorpayKeyId: config.razorpayKeyId,
  };
}

export const STORAGE_ADDON_TIERS: Record<number, { priceRupees: number; pricePaise: number; label: string }> = {
  10: { priceRupees: 299, pricePaise: 29900, label: '+10 GB Extra Cloud Storage' },
  25: { priceRupees: 599, pricePaise: 59900, label: '+25 GB Extra Cloud Storage' },
  50: { priceRupees: 999, pricePaise: 99900, label: '+50 GB Extra Cloud Storage' },
  100: { priceRupees: 1799, pricePaise: 179900, label: '+100 GB Extra Cloud Storage' },
};

/**
 * Create a payment order to purchase additional storage quota
 */
export async function createStorageAddonOrder(params: { orgId: string; extraGB: number }) {
  const { orgId, extraGB } = params;
  const addon = STORAGE_ADDON_TIERS[extraGB];

  if (!addon) {
    throw new Error('Invalid storage addon option. Supported options: 10, 25, 50, 100 GB.');
  }

  const receipt = `addon_${orgId.replace(/-/g, '').slice(0, 8)}_${Date.now().toString().slice(-6)}`;

  const razorpay = getRazorpayClient();
  if (razorpay) {
    try {
      const order = await razorpay.orders.create({
        amount: addon.pricePaise,
        currency: 'INR',
        receipt,
        notes: {
          orgId,
          type: 'storage_addon',
          extraGB,
        },
      });

      return {
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        keyId: config.razorpayKeyId,
        isConfigured: true,
        extraGB,
        label: addon.label,
      };
    } catch (err: any) {
      console.error('Error creating storage addon Razorpay order:', err);
      throw new Error(`Razorpay order creation failed: ${err.message || 'API error'}`);
    }
  }

  // Simulated order
  const mockOrderId = `addon_sim_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    orderId: mockOrderId,
    amount: addon.pricePaise,
    currency: 'INR',
    keyId: 'rzp_test_simulated_key',
    isConfigured: false,
    isSimulated: true,
    extraGB,
    label: addon.label,
  };
}

/**
 * Verify payment and increase client storage quota
 */
export async function verifyAndActivateStorageAddon(params: {
  orgId: string;
  extraGB: number;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature?: string;
}) {
  const { orgId, extraGB, razorpayOrderId, razorpayPaymentId, razorpaySignature } = params;
  const addon = STORAGE_ADDON_TIERS[extraGB];

  if (!addon) {
    throw new Error('Invalid storage addon tier.');
  }

  // Verify HMAC signature if live Razorpay configured
  if (isRazorpayConfigured() && razorpaySignature) {
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generatedSignature = crypto
      .createHmac('sha256', config.razorpayKeySecret)
      .update(text)
      .digest('hex');

    if (generatedSignature !== razorpaySignature) {
      throw new Error('Invalid Razorpay signature for storage addon.');
    }
  }

  const now = new Date();
  const currentYear = now.getFullYear();
  const invoiceCount = await prisma.invoice.count();
  const invoiceNumber = `INV-${currentYear}-${String(invoiceCount + 1).padStart(4, '0')}`;

  const additionalBytes = BigInt(extraGB) * BigInt(1024 * 1024 * 1024);

  // 1. Update Organization Quota
  const updatedOrg = await prisma.organization.update({
    where: { id: orgId },
    data: {
      storageQuotaBytes: {
        increment: additionalBytes,
      },
    },
    select: {
      id: true,
      name: true,
      storageQuotaBytes: true,
      storageUsedBytes: true,
    },
  });

  // 2. Create Invoice
  const invoice = await prisma.invoice.create({
    data: {
      orgId,
      invoiceNumber,
      amount: addon.pricePaise,
      currency: 'INR',
      status: 'PAID',
      description: `Storage Add-on: +${extraGB} GB Cloud Recording Quota`,
      gatewayPaymentId: razorpayPaymentId,
      paidAt: now,
      dueDate: now,
    },
  });

  console.log(`📦 Allocated +${extraGB} GB storage quota to ${updatedOrg.name} (${invoiceNumber})`);

  return {
    success: true,
    addedGB: extraGB,
    newQuotaBytes: Number(updatedOrg.storageQuotaBytes),
    newQuotaGB: Number(updatedOrg.storageQuotaBytes) / (1024 * 1024 * 1024),
    invoiceNumber: invoice.invoiceNumber,
  };
}
