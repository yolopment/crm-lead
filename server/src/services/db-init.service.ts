import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import { PlanTier, OrgStatus, Role } from '@prisma/client';
import { prisma } from '../utils/prisma.js';

export async function initDatabase() {
  console.log('🔍 Checking database status...');

  let tablesExist = false;
  try {
    await prisma.saasAdmin.count();
    tablesExist = true;
  } catch (err: any) {
    const msg = (err?.message || '').toLowerCase();
    if (msg.includes('does not exist') || msg.includes("doesn't exist") || msg.includes('1146')) {
      console.log('🔄 Database tables not found. Running Prisma db push to create MySQL schema...');
      try {
        const prismaCli = './node_modules/prisma/build/index.js';
        const cmd = `${process.execPath} ${prismaCli} db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss`;
        const output = execSync(cmd, {
          encoding: 'utf-8',
          env: { ...process.env, PATH: `${process.env.PATH}:./node_modules/.bin` },
        });
        console.log('✅ Prisma MySQL schema created successfully!\n', output);
        tablesExist = true;
      } catch (pushErr: any) {
        console.error('❌ Failed to push Prisma schema to database:', pushErr.message);
        if (pushErr.stdout) console.error('Prisma stdout:', pushErr.stdout.toString());
        if (pushErr.stderr) console.error('Prisma stderr:', pushErr.stderr.toString());
        return;
      }
    } else {
      console.error('⚠️ Database connection error during check:', err.message);
      return;
    }
  }

  if (!tablesExist) return;

  // 1. Ensure SaasAdmin exists
  try {
    const adminCount = await prisma.saasAdmin.count();
    if (adminCount === 0) {
      console.log('🌱 Seeding SaaS Super Admin & Subscription Plans...');
      
      // Seed Plans
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
          features: JSON.stringify({ callRecording: true, customStages: false, gdriveSync: false, exportLeads: false }),
          isActive: true,
          sortOrder: 1,
        },
        {
          name: 'Starter',
          tier: PlanTier.STARTER,
          displayName: 'Starter Plan',
          description: 'Essential CRM and call tracking for growing teams',
          priceMonthly: 99900,
          priceYearly: 999000,
          currency: 'INR',
          maxUsers: 5,
          maxLeads: 2000,
          storageQuotaBytes: BigInt(5368709120), // 5 GB
          maxCallsPerMonth: 2000,
          features: JSON.stringify({ callRecording: true, customStages: true, gdriveSync: true, exportLeads: true }),
          isActive: true,
          sortOrder: 2,
        },
        {
          name: 'Pro',
          tier: PlanTier.PRO,
          displayName: 'Pro Plan',
          description: 'Advanced features, integrations, and high call capacity',
          priceMonthly: 249900,
          priceYearly: 2499000,
          currency: 'INR',
          maxUsers: 15,
          maxLeads: 10000,
          storageQuotaBytes: BigInt(26843545600), // 25 GB
          maxCallsPerMonth: 100000,
          features: JSON.stringify({ callRecording: true, customStages: true, gdriveSync: true, exportLeads: true, webhooks: true }),
          isActive: true,
          sortOrder: 3,
        },
        {
          name: 'Enterprise',
          tier: PlanTier.ENTERPRISE,
          displayName: 'Enterprise Plan',
          description: 'Unlimited scaling, dedicated support, and massive storage',
          priceMonthly: 499900,
          priceYearly: 4999000,
          currency: 'INR',
          maxUsers: 1000,
          maxLeads: 1000000,
          storageQuotaBytes: BigInt(107374182400), // 100 GB
          maxCallsPerMonth: 1000000,
          features: JSON.stringify({ callRecording: true, customStages: true, gdriveSync: true, exportLeads: true, webhooks: true, prioritySupport: true }),
          isActive: true,
          sortOrder: 4,
        },
      ];

      for (const p of plans) {
        await prisma.plan.upsert({
          where: { name: p.name },
          update: p,
          create: p,
        });
      }

      // Seed Super Admin
      const hashedPassword = await bcrypt.hash('SuperAdmin@123', 10);
      await prisma.saasAdmin.upsert({
        where: { email: 'admin@crmlead.com' },
        update: {
          password: hashedPassword,
          name: 'Platform Admin',
          saasRole: 'SUPER_ADMIN',
        },
        create: {
          email: 'admin@crmlead.com',
          password: hashedPassword,
          name: 'Platform Admin',
          saasRole: 'SUPER_ADMIN',
        },
      });

      console.log('✅ SaaS Super Admin (admin@crmlead.com) seeded successfully!');
    }
  } catch (seedErr) {
    console.error('⚠️ Error seeding SaaS admin/plans:', seedErr);
  }

  // 2. Ensure Default Tenant Organization & Admin exist
  try {
    const org = await prisma.organization.upsert({
      where: { slug: 'yolopment' },
      update: {},
      create: {
        name: 'YOLOPMENT PRIVATE LIMITED',
        slug: 'yolopment',
        phone: '9775192725',
        website: 'https://leadzam.com',
        orgStatus: OrgStatus.ACTIVE,
      },
    });

    const tenantPassword = await bcrypt.hash('admin123', 10);
    await prisma.user.upsert({
      where: { email: 'yolopment@gmail.com' },
      update: {},
      create: {
        orgId: org.id,
        name: 'AFTAB SEKH',
        email: 'yolopment@gmail.com',
        password: tenantPassword,
        phone: '9775192725',
        role: Role.ADMIN,
        deviceToken: 'c89fae019b88231c',
        isOnLeave: false,
      },
    });

    console.log('✅ Tenant Admin (yolopment@gmail.com) verified/created!');
  } catch (tenantErr) {
    console.error('⚠️ Error seeding tenant admin:', tenantErr);
  }
}
