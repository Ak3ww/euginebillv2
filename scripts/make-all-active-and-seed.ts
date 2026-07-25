import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== ACTIVATING ALL CUSTOMERS & EXACT AREA SEEDING (WITH ALIAS RESOLUTION) ===');

  // 1. Set status = 'active' for ALL customers in database
  console.log('Step 1: Setting status = "active" for all customers in database...');
  const statusUpdate = await prisma.pppoeUser.updateMany({
    data: { status: 'active' }
  });
  console.log(`✓ Updated ${statusUpdate.count} users to status = "active".\n`);

  // 2. Unassign all users first
  console.log('Step 2: Resetting all area assignments (unassign all)...');
  await prisma.pppoeUser.updateMany({
    data: { areaId: null }
  });
  console.log('✓ All users reset to unassigned.\n');

  // 3. Ensure target areas exist
  const areaMapping: Record<string, string> = {
    'Puri Nirwana 3': 'PURI NIRWANA 3',
    'Kampung Pisang': 'KAMPUNG PISANG',
    'Kampung Muara Beres': 'KAMPUNG MUARA BERES',
  };

  const areaRecordMap = new Map<string, string>();
  for (const [sheetName, areaName] of Object.entries(areaMapping)) {
    let area = await prisma.pppoeArea.findFirst({
      where: { name: { contains: areaName } }
    });

    if (!area) {
      area = await prisma.pppoeArea.create({
        data: {
          id: crypto.randomUUID(),
          name: areaName,
          description: `Wilayah Coverage ${areaName}`,
        }
      });
    }
    areaRecordMap.set(sheetName, area.id);
  }

  // 4. Read Excel file
  let excelPath = 'C:/Users/User/Downloads/Daftar_Pelanggan_Per_Wilayah.xlsx';
  if (!fs.existsSync(excelPath)) {
    excelPath = path.join(__dirname, 'Daftar_Pelanggan_Per_Wilayah.xlsx');
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  const allUsers = await prisma.pppoeUser.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      customerId: true,
      phone: true,
      address: true,
      routerId: true,
      router: { select: { name: true } }
    }
  });

  const normalizeStr = (s?: string | null) => s ? s.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const normalizePhone = (p?: string | null) => p ? p.replace(/[^0-9]/g, '').replace(/^62/, '0') : '';

  // Specific alias aliases dictionary for names/IDs that differ slightly between DB and Excel
  const aliasMap: Record<string, string[]> = {
    '952649': ['saepul anwar', 'syaiful anwar', 'emg050'],
    'syaiful anwar': ['saepul anwar', 'syaiful anwar', '952649'],
    '422883': ['andriansyah', 'emg011', 'emg299'],
    'andriansyah': ['andriansyah', 'emg011', 'emg299', '422883'],
    '117008': ['yunus pos', 'yunuspos', 'emg182'],
    'yunus pos': ['yunus pos', 'yunuspos', 'emg182', '117008'],
  };

  const assignedUserIds = new Set<string>();
  const report: Record<string, { totalInSheet: number; matchedInDb: number; missingItems: any[] }> = {};

  // 5. Seed from Excel sheets
  for (const [sheetName, areaId] of areaRecordMap.entries()) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) continue;

    report[sheetName] = { totalInSheet: 0, matchedInDb: 0, missingItems: [] };
    const sheetTargetUsers: { name: string; customerId: string; address: string; phone: string }[] = [];

    ws.eachRow((row) => {
      const vals = row.values.slice(1).map(v => (v !== null && typeof v === 'object' && (v as any).result !== undefined) ? (v as any).result : v);
      const name = vals[0] ? String(vals[0]).trim() : '';
      const customerId = vals[1] ? String(vals[1]).trim() : '';
      const address = vals[2] ? String(vals[2]).trim() : '';
      const phone = vals[3] ? String(vals[3]).trim() : '';

      if (
        name &&
        !name.toUpperCase().startsWith('DAFTAR') &&
        !name.toUpperCase().startsWith('TERMASUK') &&
        !name.toUpperCase().startsWith('TERMUK') &&
        !name.toUpperCase().startsWith('NAMA') &&
        !name.toUpperCase().startsWith('NO') &&
        !name.toUpperCase().startsWith('RINGKASAN') &&
        !name.toUpperCase().startsWith('SUMBER')
      ) {
        sheetTargetUsers.push({ name, customerId, address, phone });
      }
    });

    report[sheetName].totalInSheet = sheetTargetUsers.length;

    for (const item of sheetTargetUsers) {
      const itemNormName = normalizeStr(item.name);
      const itemNormCustId = normalizeStr(item.customerId);
      const itemNormPhone = normalizePhone(item.phone);

      const aliases = [
        ...(aliasMap[itemNormCustId] || []),
        ...(aliasMap[itemNormName] || []),
      ].map(normalizeStr);

      const matched = allUsers.filter(u => {
        if (assignedUserIds.has(u.id)) return false;

        const uNormName = normalizeStr(u.name);
        const uNormUsername = normalizeStr(u.username);
        const uNormCustId = normalizeStr(u.customerId);
        const uNormPhone = normalizePhone(u.phone);

        // 1. Strict match by customerId
        if (itemNormCustId && uNormCustId && itemNormCustId === uNormCustId) return true;

        // 2. Strict match by exact username or exact name
        if (itemNormName && (uNormName === itemNormName || uNormUsername === itemNormName)) return true;

        // 3. Strict match by phone number
        if (itemNormPhone && uNormPhone && itemNormPhone.length > 7 && uNormPhone === itemNormPhone) return true;

        // 4. Alias match fallback
        if (aliases.length > 0) {
          if (aliases.includes(uNormName) || aliases.includes(uNormUsername) || aliases.includes(uNormCustId)) return true;
        }

        return false;
      });

      if (matched.length === 0) {
        report[sheetName].missingItems.push(item);
      } else {
        for (const u of matched) {
          assignedUserIds.add(u.id);
          await prisma.pppoeUser.update({
            where: { id: u.id },
            data: {
              areaId: areaId,
              address: (item.address && item.address.length > 5 && (!u.address || u.address.length < 5)) ? item.address : u.address,
            }
          });
          report[sheetName].matchedInDb++;
        }
      }
    }
  }

  // 6. Check unassigned (Citeureup vs Cibinong)
  const remainingUnassigned = allUsers.filter(u => !assignedUserIds.has(u.id));

  console.log('\n================ FINAL SEEDING REPORT ================');
  for (const [sheetName, stat] of Object.entries(report)) {
    console.log(`📌 Area: "${areaMapping[sheetName]}" | Excel List: ${stat.totalInSheet} | Assigned in DB: ${stat.matchedInDb}`);
    if (stat.missingItems.length > 0) {
      console.log(`   ⚠️ Missing in DB: ${stat.missingItems.length} items:`);
      stat.missingItems.forEach((m, i) => console.log(`      ${i+1}. ${m.name} (${m.customerId})`));
    } else {
      console.log(`   ✓ All ${stat.totalInSheet} customers matched 100%!`);
    }
  }
  console.log(`\n📌 Total Unassigned Users (Tepat 37 Citeureup): ${remainingUnassigned.length} users`);
  console.log('======================================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
