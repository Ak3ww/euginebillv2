import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const juhdiUser = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { customerId: '0DKC53CCPJ' },
          { name: { contains: 'JUHDI' } }
        ]
      }
    });

    if (juhdiUser) {
      await prisma.pppoeUser.update({
        where: { id: juhdiUser.id },
        data: {
          customerId: '267001',
          username: juhdiUser.username || 'EMG267',
        }
      });
    }

    await prisma.pppoeUser.updateMany({
      data: { status: 'active' }
    });

    await prisma.pppoeUser.updateMany({
      data: { areaId: null }
    });

    let excelPath = 'C:/Users/User/Downloads/Daftar_Pelanggan_Per_Wilayah.xlsx';
    if (!fs.existsSync(excelPath)) {
      excelPath = path.join(process.cwd(), 'scripts', 'Daftar_Pelanggan_Per_Wilayah.xlsx');
    }

    if (!fs.existsSync(excelPath)) {
      return NextResponse.json({ success: false, error: `File Excel tidak ditemukan di ${excelPath}` }, { status: 404 });
    }

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

    const specificOverrides: Record<string, string> = {
      'EMG011': areaRecordMap.get('Kampung Pisang')!,       // Andriansyah KPS
      '850575839480': areaRecordMap.get('Kampung Pisang')!, // Andriansyah KPS Excel ID
      'EMG299': areaRecordMap.get('Kampung Muara Beres')!,  // Andriansyah KMB
      '422883': areaRecordMap.get('Kampung Muara Beres')!,  // Andriansyah KMB Excel ID
      'EMG157': areaRecordMap.get('Kampung Muara Beres')!,  // Yunus
      '612093': areaRecordMap.get('Kampung Muara Beres')!,  // Yunus Excel ID
      'EMG182': areaRecordMap.get('Kampung Muara Beres')!,  // Yunus POS
      '117008': areaRecordMap.get('Kampung Muara Beres')!,  // Yunus POS Excel ID
      'EMG050': areaRecordMap.get('Puri Nirwana 3')!,       // Syaiful Anwar / Saepul Anwar
      '952649': areaRecordMap.get('Puri Nirwana 3')!,       // Syaiful Anwar Excel ID
      '267001': areaRecordMap.get('Kampung Muara Beres')!,  // Muhammad Juhdi
      '0DKC53CCPJ': areaRecordMap.get('Kampung Muara Beres')!,// Muhammad Juhdi Excel ID
    };

    for (const [key, targetAreaId] of Object.entries(specificOverrides)) {
      const userRec = allUsers.find(u => u.username === key || u.customerId === key || normalizeStr(u.name) === normalizeStr(key));
      if (userRec) {
        assignedUserIds.add(userRec.id);
        await prisma.pppoeUser.update({
          where: { id: userRec.id },
          data: { areaId: targetAreaId }
        });
      }
    }

    const report: Record<string, { totalInSheet: number; matchedInDb: number; missingItems: any[] }> = {};

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

        const isOverrideOrAssigned = allUsers.find(u => {
          if (!assignedUserIds.has(u.id)) return false;
          if (u.areaId !== areaId) return false;

          const uNormName = normalizeStr(u.name);
          const uNormUsername = normalizeStr(u.username);
          const uNormCustId = normalizeStr(u.customerId);

          return (
            (itemNormCustId && (uNormCustId === itemNormCustId || uNormUsername === itemNormCustId)) ||
            (itemNormName && (uNormName === itemNormName || uNormUsername === itemNormName)) ||
            specificOverrides[itemNormCustId] === areaId ||
            specificOverrides[itemNormName] === areaId
          );
        });

        if (isOverrideOrAssigned) {
          report[sheetName].matchedInDb++;
          continue;
        }

        const matched = allUsers.filter(u => {
          if (assignedUserIds.has(u.id)) return false;

          const uNormName = normalizeStr(u.name);
          const uNormUsername = normalizeStr(u.username);
          const uNormCustId = normalizeStr(u.customerId);
          const uNormPhone = normalizePhone(u.phone);

          if (itemNormCustId && uNormCustId && itemNormCustId === uNormCustId) return true;
          if (itemNormName && (uNormName === itemNormName || uNormUsername === itemNormName)) return true;
          if (itemNormPhone && uNormPhone && itemNormPhone.length > 7 && uNormPhone === itemNormPhone) return true;

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

    return NextResponse.json({
      success: true,
      message: 'Berhasil meng-seed dengan penghitungan override presisi.',
      report,
      unassignedCount: remainingUnassigned,
    });
  } catch (error: any) {
    console.error('Activate and seed error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
