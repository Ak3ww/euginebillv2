const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/User/Downloads/pelanggan-export-2026-07-25_12-24-42.xlsx');
  
  const ws = wb.worksheets[0];
  console.log(`Worksheet: "${ws.name}", Total Rows: ${ws.rowCount}`);

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const vals = row.values.slice(1);
    const area = vals[0] ? String(vals[0]).trim() : '';
    const idPelanggan = vals[4] ? String(vals[4]).trim() : '';
    const nama = vals[5] ? String(vals[5]).trim() : '';
    const router = vals[20] ? String(vals[20]).trim() : '';
    const username = vals[22] ? String(vals[22]).trim() : '';

    rows.push({ rowNumber, area, idPelanggan, nama, router, username });
  });

  console.log('Total customers in export:', rows.length);

  const areas = {};
  rows.forEach(r => {
    areas[r.area || 'TANPA AREA'] = (areas[r.area || 'TANPA AREA'] || 0) + 1;
  });
  console.log('\nBreakdown by Area in Export File:', areas);

  const emptyUsername = rows.filter(r => !r.username);
  console.log(`\nCustomers with empty username (${emptyUsername.length}):`);
  emptyUsername.forEach(r => console.log(`  - Row ${r.rowNumber}: Name: "${r.nama}", ID: "${r.idPelanggan}", Area: "${r.area}"`));
}

main().catch(console.error);
