const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/User/Downloads/pelanggan-export-2026-07-25_12-24-42.xlsx');
  
  const ws = wb.worksheets[0];
  console.log(`Worksheet: "${ws.name}", Total Rows: ${ws.rowCount}`);

  const rows = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header
    const vals = row.values.slice(1);
    const idPelanggan = vals[4] ? String(vals[4]).trim() : '';
    const nama = vals[5] ? String(vals[5]).trim() : '';
    const router = vals[20] ? String(vals[20]).trim() : 'Tanpa Router';
    const username = vals[22] ? String(vals[22]).trim() : '';

    if (nama || username || idPelanggan) {
      rows.push({
        rowNumber,
        idPelanggan,
        nama,
        router,
        username,
      });
    }
  });

  console.log(`\nTotal Customers in Export File: ${rows.length}`);

  const routerCounts = {};
  rows.forEach(r => {
    routerCounts[r.router] = (routerCounts[r.router] || 0) + 1;
  });

  console.log('\nBreakdown by Router in Export File:');
  console.dir(routerCounts);

  // Check MUHAMMAD JUHDI
  const juhdi = rows.filter(r => r.nama.toUpperCase().includes('JUHDI') || r.username.toUpperCase().includes('JUHDI') || r.idPelanggan.toUpperCase().includes('JUHDI'));
  console.log('\nMuhammad Juhdi in Export File:', juhdi);
}

main().catch(console.error);
