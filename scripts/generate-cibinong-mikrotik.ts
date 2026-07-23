import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

// Helper to generate 6-character random alphanumeric password (lowercase, uppercase, numbers)
function generateRandomPassword(length = 6): string {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Exact 38 Citeureup Usernames & Names
const CITEUREUP_USERNAMES = [
  'EMGC025', 'EMGC019', 'EMGC022', 'EMGC024', 'EMGC018', 'EMGC003',
  'EMGC007', 'EMG-0234', 'EMGC017', 'EMGC023', 'EMGC006', 'EMGC005',
  'EMGC036', 'EMGC030', 'EMGCAKEW', 'EMGC001', 'EMGC004', 'EMGCF001',
  'EMGC038', 'EMGC013', 'EMGC014', 'EMGC032', 'EMGC035', 'EMGC033',
  'EMGC034', 'EMGC011', 'EMGCF002', 'EMGC002', 'EMGC026', 'EMGC016',
  'EMGC009', 'EMGC021', 'EMGC029', 'EMGC008', 'EMGC037', 'EMGC039',
  'EMGC015', 'EMGC020'
];

const CITEUREUP_NAMES = [
  'KOST MARFUNGAH', 'IRFAN', 'SUPARMAN', 'ACE ALE', 'DABBY', 'AYU FIDA SABIL',
  'DINA DINI', 'ADE', 'ARI ABUY', 'OM AGUS', 'SHINTA 2', 'LUSY', 'TEH AI',
  'ANNISA', 'AKEW', 'AULIA', 'DHANI', 'MANG ASEP', 'DIRA', 'ARYA', 'SHEILA',
  'USMAN', 'MAMAH DINI', 'DERY', 'RISA', 'EMAN', 'ARIF', 'ARLINA', 'CHANDRA',
  'SHINTA 1', 'TANTE', 'ZAHRA', 'FARHAN / DARIANI', 'AHMAD NUR HAFIZ', 'ANDRIANA',
  'SYAHRONAL', 'RIO', 'ABY ADITYA'
];

async function main() {
  console.log('📌 Executing Router Assignment & Generating MikroTik Cibinong Commands...\n');

  const routers = await prisma.router.findMany({
    select: { id: true, name: true, ipAddress: true }
  });

  const citeureupRouter = routers.find(r => r.name.toLowerCase().includes('citeureup') || r.name.toLowerCase().includes('ctr'));
  const cibinongRouter = routers.find(r => r.name.toLowerCase().includes('cibinong') || r.name.toLowerCase().includes('cbn'));

  if (!citeureupRouter || !cibinongRouter) {
    console.log('⚠️ Both routers (Citeureup & Cibinong) must exist in database.');
    return;
  }

  // 1. Assign Citeureup users
  const citeureupResult = await prisma.pppoeUser.updateMany({
    where: {
      OR: [
        { username: { in: CITEUREUP_USERNAMES } },
        { name: { in: CITEUREUP_NAMES } },
      ]
    },
    data: {
      routerId: citeureupRouter.id
    }
  });

  console.log(`✅ ${citeureupResult.count} Pelanggan di-assign ke Router CITEUREUP.`);

  // 2. Find all remaining users for Cibinong
  const cibinongUsers = await prisma.pppoeUser.findMany({
    where: {
      NOT: {
        routerId: citeureupRouter.id
      }
    },
    select: {
      id: true,
      name: true,
      username: true,
      password: true,
      profileName: true,
      ipAddress: true,
      clearPassword: true,
    }
  });

  console.log(`✅ ${cibinongUsers.length} Pelanggan Cibinong diproses untuk update password & MikroTik script.`);

  const mikrotikCommands: string[] = [];

  for (const user of cibinongUsers) {
    // Generate new 6-char random password
    const newPass = generateRandomPassword(6);

    // Update database password for this customer
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: {
        password: newPass,
        clearPassword: newPass,
        routerId: cibinongRouter.id
      }
    });

    const username = user.username || user.name.replace(/\s+/g, '_').toLowerCase();
    const profile = user.profileName || 'default';
    const comment = `EugineBill - ${user.name.replace(/"/g, '')}`;
    const remoteAddr = user.ipAddress ? ` remote-address=${user.ipAddress}` : '';

    // MikroTik PPP Secret Command format
    const cmd = `/ppp secret add name="${username}" password="${newPass}" service=pppoe profile="${profile}"${remoteAddr} comment="${comment}"`;
    mikrotikCommands.push(cmd);
  }

  // Write commands to file mikrotik_cibinong_secrets.rsc
  const outputPath = join(process.cwd(), 'mikrotik_cibinong_secrets.rsc');
  const fileContent = `# ========================================================\n` +
    `# MIKROTIK CIBINONG SITE - PPP SECRETS SCRIPT\n` +
    `# Generated for ${cibinongUsers.length} Customers\n` +
    `# ========================================================\n\n` +
    mikrotikCommands.join('\n') + '\n';

  writeFileSync(outputPath, fileContent, 'utf-8');

  console.log(`\n🎉 SELESAI!`);
  console.log(`📁 File MikroTik Script telah dibuat di: ${outputPath}`);
  console.log(`🔑 Total ${cibinongUsers.length} password pelanggan Cibinong telah diperbarui di Database & MikroTik script!`);
  console.log(`\n💡 Anda tinggal copas isi file "mikrotik_cibinong_secrets.rsc" langsung ke Terminal MikroTik Cibinong!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
