import ExcelJS from 'exceljs';

async function main() {
  const excelPath = 'C:/Users/User/Downloads/Daftar_Pelanggan_Per_Wilayah.xlsx';
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(excelPath);

  for (const ws of wb.worksheets) {
    console.log(`\nSheet: ${ws.name}`);
    ws.eachRow((row, r) => {
      const vals = row.values.slice(1).map(v => (v !== null && typeof v === 'object' && v.result !== undefined) ? v.result : v);
      const str = vals.join(' | ');
      if (str.toLowerCase().includes('stop') || str.toLowerCase().includes('isolir') || str.toLowerCase().includes('status')) {
        console.log(`Row ${r}: ${str}`);
      }
    });
  }
}

main().catch(console.error);
