import { PrismaClient, PlanTier, OrgStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting SaaS seed...');

  // 1. Seed Plans
  const plans = [
    {
      name: 'Free',
      tier: PlanTier.FREE,
      displayName: 'Free Plan',
      description: 'Free tier for small teams and evaluation',
      priceMonthly: 0,
      priceYearly: 0,
      currency: 'INR',
      maxUsers: 2,
      maxLeads: 200,
      storageQuotaBytes: BigInt(524288000), // 500 MB
      maxCallsPerMonth: 300,
      features: JSON.stringify({
        callRecording: true,
        customStages: false,
        gdriveSync: false,
        exportLeads: false,
      }),
      isActive: true,
      sortOrder: 1,
    },
    {
      name: 'Starter',
      tier: PlanTier.STARTER,
      displayName: 'Starter Plan',
      description: 'Essential CRM and call tracking for growing teams',
      priceMonthly: 99900, // ₹999/mo (in paise)
      priceYearly: 999000,
      currency: 'INR',
      maxUsers: 5,
      maxLeads: 2000,
      storageQuotaBytes: BigInt(5368709120), // 5 GB
      maxCallsPerMonth: 2000,
      features: JSON.stringify({
        callRecording: true,
        customStages: true,
        gdriveSync: true,
        exportLeads: true,
      }),
      isActive: true,
      sortOrder: 2,
    },
    {
      name: 'Pro',
      tier: PlanTier.PRO,
      displayName: 'Pro Plan',
      description: 'Advanced features, integrations, and high call capacity',
      priceMonthly: 249900, // ₹2,499/mo (in paise)
      priceYearly: 2499000,
      currency: 'INR',
      maxUsers: 15,
      maxLeads: 10000,
      storageQuotaBytes: BigInt(26843545600), // 25 GB
      maxCallsPerMonth: 100000,
      features: JSON.stringify({
        callRecording: true,
        customStages: true,
        gdriveSync: true,
        exportLeads: true,
        webhooks: true,
      }),
      isActive: true,
      sortOrder: 3,
    },
    {
      name: 'Enterprise',
      tier: PlanTier.ENTERPRISE,
      displayName: 'Enterprise Plan',
      description: 'Unlimited scaling, dedicated support, and massive storage',
      priceMonthly: 499900, // ₹4,999/mo (in paise)
      priceYearly: 4999000,
      currency: 'INR',
      maxUsers: 1000,
      maxLeads: 1000000,
      storageQuotaBytes: BigInt(107374182400), // 100 GB
      maxCallsPerMonth: 1000000,
      features: JSON.stringify({
        callRecording: true,
        customStages: true,
        gdriveSync: true,
        exportLeads: true,
        webhooks: true,
        prioritySupport: true,
      }),
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const planData of plans) {
    const plan = await prisma.plan.upsert({
      where: { name: planData.name },
      update: {
        tier: planData.tier,
        displayName: planData.displayName,
        description: planData.description,
        priceMonthly: planData.priceMonthly,
        priceYearly: planData.priceYearly,
        currency: planData.currency,
        maxUsers: planData.maxUsers,
        maxLeads: planData.maxLeads,
        storageQuotaBytes: planData.storageQuotaBytes,
        maxCallsPerMonth: planData.maxCallsPerMonth,
        features: planData.features,
        isActive: planData.isActive,
        sortOrder: planData.sortOrder,
      },
      create: planData,
    });
    console.log(`✅ Upserted plan: ${plan.displayName} (${plan.tier})`);
  }

  // 2. Seed First SaasAdmin
  const adminEmail = 'admin@crmlead.com';
  const rawPassword = 'SuperAdmin@123';
  const hashedPassword = await bcrypt.hash(rawPassword, 10);

  const admin = await prisma.saasAdmin.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Platform Admin',
      password: hashedPassword,
      saasRole: 'SUPER_ADMIN',
    },
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Platform Admin',
      saasRole: 'SUPER_ADMIN',
    },
  });
  console.log(`✅ Upserted SaaS Super Admin: ${admin.email} (${admin.saasRole})`);

  // 3. Update existing organizations to orgStatus = ACTIVE
  const orgUpdateResult = await prisma.organization.updateMany({
    data: {
      orgStatus: OrgStatus.ACTIVE,
    },
  });
  console.log(`✅ Updated ${orgUpdateResult.count} existing organizations to orgStatus = ACTIVE`);

  console.log('🎉 SaaS database seeding completed successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Error during SaaS seeding:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
