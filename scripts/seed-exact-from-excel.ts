import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== SEEDING EXACT DATA FROM DAFTAR_PELANGGAN_PER_WILAYAH.XLSX ===');

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

  // 1. Ensure target areas exist in database
  const areaMapping: Record<string, string> = {
    'Puri Nirwana 3': 'PURI NIRWANA 3',
    'Kampung Pisang': 'KAMPUNG PISANG',
    'Kampung Muara Beres': 'KAMPUNG MUARA BERES',
  };

  const areaRecordMap = new Map<string, string>(); // sheetName -> areaId

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
      console.log(`Created Area: ${area.name} (${area.id})`);
    } else {
      console.log(`Found Area: ${area.name} (${area.id})`);
    }
    areaRecordMap.set(sheetName, area.id);
  }

  // 2. Fetch all users from DB
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

  // Track assigned user IDs across all sheets
  const assignedUserIds = new Set<string>();
  const report: Record<string, { totalInSheet: number; matchedInDb: number; details: string[] }> = {};

  // 3. Process each sheet
  for (const [sheetName, areaId] of areaRecordMap.entries()) {
    const ws = wb.getWorksheet(sheetName);
    if (!ws) {
      console.log(`Warning: Sheet "${sheetName}" not found in workbook.`);
      continue;
    }

    report[sheetName] = { totalInSheet: 0, matchedInDb: 0, details: [] };
    const sheetTargetUsers: { name: string; customerId: string; address: string; phone: string }[] = [];

    ws.eachRow((row) => {
      const vals = row.values.slice(1).map(v => (v !== null && typeof v === 'object' && (v as any).result !== undefined) ? (v as any).result : v);
      const name = vals[0] ? String(vals[0]).trim() : '';
      const customerId = vals[1] ? String(vals[1]).trim() : '';
      const address = vals[2] ? String(vals[2]).trim() : '';
      const phone = vals[3] ? String(vals[3]).trim() : '';

      // Skip headers and title rows
      if (name && !name.toUpperCase().startsWith('DAFTAR') && !name.toUpperCase().startsWith('TERMUK') && !name.toUpperCase().startsWith('NAMA') && !name.toUpperCase().startsWith('NO')) {
        sheetTargetUsers.push({ name, customerId, address, phone });
      }
    });

    report[sheetName].totalInSheet = sheetTargetUsers.length;

    for (const item of sheetTargetUsers) {
      const itemNormName = normalizeStr(item.name);
      const itemNormCustId = normalizeStr(item.customerId);
      const itemNormPhone = normalizePhone(item.phone);

      // Find matching user in DB
      const matched = allUsers.filter(u => {
        if (assignedUserIds.has(u.id)) return false;

        const uNormName = normalizeStr(u.name);
        const uNormUsername = normalizeStr(u.username);
        const uNormCustId = normalizeStr(u.customerId);
        const uNormPhone = normalizePhone(u.phone);

        // Match by customerId OR exact name/username OR phone
        if (itemNormCustId && uNormCustId && itemNormCustId === uNormCustId) return true;
        if (itemNormName && (uNormName === itemNormName || uNormUsername === itemNormName)) return true;
        if (itemNormPhone && uNormPhone && itemNormPhone.length > 7 && uNormPhone === itemNormPhone) return true;

        return false;
      });

      for (const u of matched) {
        assignedUserIds.add(u.id);
        await prisma.pppoeUser.update({
          where: { id: u.id },
          data: {
            areaId: areaId,
            // Update address from Excel if current address is short or generic
            address: (item.address && item.address.length > 5 && (!u.address || u.address.length < 5)) ? item.address : u.address,
          }
        });
        report[sheetName].matchedInDb++;
        report[sheetName].details.push(`${u.name} (${u.username}) -> ${areaMapping[sheetName]}`);
      }
    }
  }

  // 4. UNASSIGN ALL USERS NOT IN THE EXCEL DATA
  const unassignedUsers = allUsers.filter(u => !assignedUserIds.has(u.id) && u.areaId !== null);
  console.log(`\nUnassigning ${unassignedUsers.length} users who are NOT in the 100% valid Excel data...`);
  
  for (const u of unassignedUsers) {
    await prisma.pppoeUser.update({
      where: { id: u.id },
      data: { areaId: null }
    });
  }

  // 5. Final Summary Report
  console.log('\n================ FINAL SEEDING REPORT ================');
  for (const [sheetName, stat] of Object.entries(report)) {
    console.log(`✓ Area: "${areaMapping[sheetName]}" | Excel List: ${stat.totalInSheet} | Assigned in DB: ${stat.matchedInDb}`);
  }
  console.log(`✓ Total Unassigned (No Area): ${unassignedUsers.length} users`);
  console.log('======================================================\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());
