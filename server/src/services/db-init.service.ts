import { execSync } from 'child_process';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { PlanTier, OrgStatus, Role } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { config } from '../config/index.js';

/**
 * Completely purges all tenant organizations, users, leads, calls, recordings, and subscriptions.
 * Preserves ONLY the SaaS Super Admin login and system Plan tiers.
 */
export async function purgeAllTenantData() {
  console.log('🚨 PURGING ALL TENANT DATA FROM DATABASE...');

  try {
    // 1. Delete dependent child records
    await prisma.storageUsageLog.deleteMany({});
    await prisma.invoice.deleteMany({});
    await prisma.subscription.deleteMany({});
    await prisma.whatsAppMessage.deleteMany({});
    await prisma.whatsAppSession.deleteMany({});
    await prisma.smsMessage.deleteMany({});
    await prisma.form.deleteMany({});
    await prisma.integration.deleteMany({});
    await prisma.doNotTrack.deleteMany({});
    await prisma.privateNumber.deleteMany({});
    await prisma.invitation.deleteMany({});
    await prisma.followUp.deleteMany({});
    await prisma.note.deleteMany({});
    await prisma.call.deleteMany({});
    await prisma.lead.deleteMany({});
    await prisma.device.deleteMany({});

    // 2. Delete all users and organizations
    const deletedUsers = await prisma.user.deleteMany({});
    const deletedOrgs = await prisma.organization.deleteMany({});

    // 3. Ensure Super Admin account exists and is valid
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

    // 4. Remove physical recordings files
    try {
      const recordingsDir = config.recordingsDir;
      if (recordingsDir && fs.existsSync(recordingsDir)) {
        const files = fs.readdirSync(recordingsDir);
        for (const file of files) {
          if (file !== '.gitkeep') {
            const filePath = path.join(recordingsDir, file);
            try {
              if (fs.lstatSync(filePath).isDirectory()) {
                fs.rmSync(filePath, { recursive: true, force: true });
              } else {
                fs.unlinkSync(filePath);
              }
            } catch (e) {}
          }
        }
      }
    } catch (fileErr) {
      console.error('Error clearing audio recordings directory:', fileErr);
    }

    console.log(`✅ DATABASE PURGE COMPLETE: Cleared ${deletedOrgs.count} organizations, ${deletedUsers.count} users.`);
    return {
      success: true,
      cleared: {
        organizations: deletedOrgs.count,
        users: deletedUsers.count,
      },
    };
  } catch (err: any) {
    console.error('❌ Error during purgeAllTenantData:', err);
    throw err;
  }
}

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

  // Ensure database schema has latest columns (e.g. customPriceMonthly, customPriceYearly)
  try {
    await prisma.organization.findFirst({
      select: { id: true, customPriceMonthly: true },
    });
  } catch (colErr: any) {
    console.log('🔄 Schema update required for Organization table. Syncing Prisma schema...');
    try {
      const prismaCli = './node_modules/prisma/build/index.js';
      const cmd = `${process.execPath} ${prismaCli} db push --schema=./prisma/schema.prisma --skip-generate --accept-data-loss`;
      const output = execSync(cmd, {
        encoding: 'utf-8',
        env: { ...process.env, PATH: `${process.env.PATH}:./node_modules/.bin` },
      });
      console.log('✅ Database schema updated with latest columns!\n', output);
    } catch (pushErr: any) {
      console.error('❌ Failed to push Prisma schema update to database:', pushErr.message);
    }
  }

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

  // Check if a purge trigger exists for fresh start
  try {
    const triggerFile = path.resolve(process.cwd(), 'PURGE_TENANTS.trigger');
    if (fs.existsSync(triggerFile)) {
      console.log('⚡ Found PURGE_TENANTS.trigger! Executing database purge...');
      await purgeAllTenantData();
      try { fs.unlinkSync(triggerFile); } catch (e) {}
    }
  } catch (triggerErr) {
    console.error('Trigger check error:', triggerErr);
  }
}
