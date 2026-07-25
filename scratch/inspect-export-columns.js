import ExcelJS from 'exceljs';

async function main() {
  const excelPath = 'C:/Users/User/Downloads/pelanggan-export-2026-07-25_12-24-42.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);
  const ws = wb.worksheets[0];

  const row1 = ws.getRow(1).values.slice(1);
  const row2 = ws.getRow(2).values.slice(1);

  console.log('Headers:', row1);
  console.log('Row 2:', row2);

  // Check unique values in columns
  const statusValues = new Set();
  ws.eachRow((row, i) => {
    if (i === 1) return;
    const vals = row.values.slice(1);
    vals.forEach((v, idx) => {
      const headerName = String(row1[idx] || '').toLowerCase();
      if (headerName.includes('status') || headerName.includes('isolir') || headerName.includes('mode') || headerName.includes('aktif')) {
        statusValues.add(`Col ${idx+1} (${headerName}): ${v}`);
      }
    });
  });

  console.log('Status related column values:', Array.from(statusValues).slice(0, 30));
}

main().catch(console.error);
