import { PrismaClient, Role, CallDirection, CallStatus, LeadStage } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding CRM data...');

  // Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'yolopment' },
    update: {},
    create: {
      name: 'YOLOPMENT PRIVATE LIMITED',
      slug: 'yolopment',
      phone: '9775192725',
      website: 'https://leadzam.com',
    },
  });

  // Create Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'yolopment@gmail.com' },
    update: {},
    create: {
      orgId: org.id,
      name: 'AFTAB SEKH',
      email: 'yolopment@gmail.com',
      password: hashedPassword,
      phone: '9775192725',
      role: Role.ADMIN,
      deviceToken: 'c89fae019b88231c',
      isOnLeave: false,
    },
  });

  // Create Sample Leads
  const lead1 = await prisma.lead.create({
    data: {
      orgId: org.id,
      phone: '+917838669955',
      fullName: 'Rahul Sharma',
      email: 'rahul@example.com',
      source: 'meta_ads',
      campaignName: 'Meta Real Estate Leads Nov',
      stage: LeadStage.QUALIFIED,
      tags: 'hot,interested',
      assignedToId: admin.id,
    },
  });

  const lead2 = await prisma.lead.create({
    data: {
      orgId: org.id,
      phone: '+919876543210',
      fullName: 'Pooja Verma',
      email: 'pooja@example.com',
      source: 'google_ads',
      campaignName: 'Google Search Leads',
      stage: LeadStage.CONTACTED,
      tags: 'callback',
      assignedToId: admin.id,
    },
  });

  // Create Calls
  await prisma.call.create({
    data: {
      orgId: org.id,
      userId: admin.id,
      leadId: lead1.id,
      phoneNumber: '+917838669955',
      direction: CallDirection.OUTBOUND,
      status: CallStatus.CONNECTED,
      durationSec: 120, // 2 minutes
      startedAt: new Date(Date.now() - 30 * 60 * 1000), // 30m ago
      endedAt: new Date(Date.now() - 28 * 60 * 1000),
      notes: 'Customer interested in commercial project. Callback scheduled.',
    },
  });

  await prisma.call.create({
    data: {
      orgId: org.id,
      userId: admin.id,
      leadId: lead2.id,
      phoneNumber: '+919876543210',
      direction: CallDirection.OUTBOUND,
      status: CallStatus.CONNECTED,
      durationSec: 14, // 14 seconds
      startedAt: new Date(Date.now() - 35 * 60 * 1000),
      endedAt: new Date(Date.now() - 34 * 60 * 1000),
      notes: 'Initial inquiry connection made.',
    },
  });

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

