import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const settings = await prisma.whatsapp_reminder_settings.findFirst();
  if (settings) {
    await prisma.whatsapp_reminder_settings.update({
      where: { id: settings.id },
      data: { enabled: false },
    });
    console.log('✅ WA Reminder Settings disabled (enabled: false)');
  } else {
    await prisma.whatsapp_reminder_settings.create({
      data: {
        id: 'default',
        enabled: false,
        reminderDays: JSON.stringify([-7, -5, -3, 0]),
        reminderTime: '09:00',
      },
    });
    console.log('✅ Created WA Reminder Settings with enabled: false');
  }

  // Also set a global master switch setting
  await prisma.setting.upsert({
    where: { key: 'WA_SENDING_PAUSED' },
    update: { value: 'true' },
    create: { id: 'wa-paused', key: 'WA_SENDING_PAUSED', value: 'true' },
  });
  console.log('✅ Global setting WA_SENDING_PAUSED set to true');
}

main().catch(console.error).finally(() => {
  prisma.$disconnect();
  process.exit(0);
});
