import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SEEDING EXACT DATA FROM EXCEL (UNASSIGN ALL FIRST) ===');

  // STEP 1: Unassign all users first
  console.log('Step 1: Unassigning ALL users from all areas first...');
  const resetResult = await prisma.pppoeUser.updateMany({
    data: { areaId: null }
  });
  console.log(`✓ Successfully reset / unassigned ${resetResult.count} users in database.\n`);

  // STEP 2: Read Excel file
  let excelPath = 'C:/Users/User/Downloads/Daftar_Pelanggan_Per_Wilayah.xlsx';
  if (!fs.existsSync(excelPath)) {
    excelPath = path.join(__dirname, 'Daftar_Pelanggan_Per_Wilayah.xlsx');
  }

  if (!fs.existsSync(excelPath)) {
    throw new Error(`File Excel tidak ditemukan di ${excelPath}`);
  }

  console.log(`Reading Excel file: ${excelPath}`);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

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

  const allUsers = await prisma.pppoeUser.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      customerId: true,
      phone: true,
      address: true,
      areaId: true,
    }
  });

  const normalizeStr = (s?: string | null) => s ? s.trim().toLowerCase().replace(/[^a-z0-9]/g, '') : '';
  const normalizePhone = (p?: string | null) => p ? p.replace(/[^0-9]/g, '').replace(/^62/, '0') : '';

  const assignedUserIds = new Set<string>();
  const report: Record<string, { totalInSheet: number; matchedInDb: number; missingItems: any[] }> = {};

  // STEP 3: Process matching and assignment
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

      if (name && !name.toUpperCase().startsWith('DAFTAR') && !name.toUpperCase().startsWith('TERMUK') && !name.toUpperCase().startsWith('NAMA') && !name.toUpperCase().startsWith('NO')) {
        sheetTargetUsers.push({ name, customerId, address, phone });
      }
    });

    report[sheetName].totalInSheet = sheetTargetUsers.length;

    for (const item of sheetTargetUsers) {
      const itemNormName = normalizeStr(item.name);
      const itemNormCustId = normalizeStr(item.customerId);
      const itemNormPhone = normalizePhone(item.phone);

      const matched = allUsers.filter(u => {
        if (assignedUserIds.has(u.id)) return false;

        const uNormName = normalizeStr(u.name);
        const uNormUsername = normalizeStr(u.username);
        const uNormCustId = normalizeStr(u.customerId);
        const uNormPhone = normalizePhone(u.phone);

        // 1. Match by customerId
        if (itemNormCustId && uNormCustId && itemNormCustId === uNormCustId) return true;
        
        // 2. Match by exact name or username
        if (itemNormName && (uNormName === itemNormName || uNormUsername === itemNormName)) return true;

        // 3. Match by phone number
        if (itemNormPhone && uNormPhone && itemNormPhone.length > 7 && uNormPhone === itemNormPhone) return true;

        // 4. Match fuzzy/contain name if name is sufficiently long (> 6 chars)
        if (itemNormName.length > 6 && (uNormName.includes(itemNormName) || itemNormName.includes(uNormName))) return true;

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

  const remainingUnassigned = allUsers.length - assignedUserIds.size;

  console.log('\n================ FINAL AUDIT & SEEDING REPORT ================');
  for (const [sheetName, stat] of Object.entries(report)) {
    console.log(`\n📌 Area: "${areaMapping[sheetName]}" | Total di Excel: ${stat.totalInSheet} | Ter-assign ke DB: ${stat.matchedInDb}`);
    if (stat.missingItems.length > 0) {
      console.log(`   ⚠️ Ada ${stat.missingItems.length} pelanggan di Excel yang TIDAK DITEMUKAN di database:`);
      stat.missingItems.forEach((m, idx) => {
        console.log(`      ${idx + 1}. Nama: "${m.name}" | ID: "${m.customerId}" | Telp: "${m.phone}" | Alamat: "${m.address}"`);
      });
    } else {
      console.log(`   ✓ All ${stat.totalInSheet} customers matched 100%!`);
    }
  }
  console.log(`\n📌 Total Unassigned (Bukan Anggota 3 Wilayah): ${remainingUnassigned} users`);
  console.log('==============================================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
