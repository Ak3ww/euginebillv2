import { PrismaClient } from '@prisma/client';
import ExcelJS from 'exceljs';

const prisma = new PrismaClient();

async function main() {
  console.log('=== RESTORING ORIGINAL CUSTOMER STATUSES FROM EXPORT EXCEL ===');

  const excelPath = 'C:/Users/User/Downloads/pelanggan-export-2026-07-25_12-24-42.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.worksheets[0];

  let activeCount = 0;
  let isolatedCount = 0;
  let stopCount = 0;

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // Skip header

    const vals = row.values.slice(1).map(v => (v !== null && typeof v === 'object' && v.result !== undefined) ? v.result : v);
    const customerId = vals[4] ? String(vals[4]).trim() : '';
    const username = vals[21] ? String(vals[21]).trim() : '';
    const name = vals[5] ? String(vals[5]).trim() : '';
    const rawStatus = vals[22] ? String(vals[22]).trim().toLowerCase() : '';

    let status = 'active';
    if (rawStatus.includes('isolir') || rawStatus.includes('isolated') || rawStatus.includes('non-aktif') || rawStatus.includes('nonaktif')) {
      status = 'isolated';
      isolatedCount++;
    } else if (rawStatus.includes('stop') || rawStatus.includes('suspend') || rawStatus.includes('putus')) {
      status = 'stop';
      stopCount++;
    } else {
      activeCount++;
    }
  });

  console.log(`Summary from Export Excel: Active: ${activeCount}, Isolated: ${isolatedCount}, Stop: ${stopCount}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
