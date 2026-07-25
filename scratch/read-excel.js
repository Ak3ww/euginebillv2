const ExcelJS = require('exceljs');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile('C:/Users/User/Downloads/Daftar_Pelanggan_Per_Wilayah.xlsx');
  
  wb.worksheets.forEach(ws => {
    console.log(`\n=============================================`);
    console.log(`SHEET NAME: "${ws.name}"`);
    console.log(`=============================================`);
    const customers = [];
    ws.eachRow((row, rowNumber) => {
      const vals = row.values.slice(1).map(v => (v !== null && typeof v === 'object' && v.result !== undefined) ? v.result : v);
      const name = vals[0] ? String(vals[0]).trim() : '';
      const customerId = vals[1] ? String(vals[1]).trim() : '';
      const address = vals[2] ? String(vals[2]).trim() : '';
      const phone = vals[3] ? String(vals[3]).trim() : '';

      if (name && !name.toUpperCase().startsWith('NAMA') && !name.toUpperCase().startsWith('NO') && !name.toUpperCase().startsWith('TOTAL')) {
        customers.push({ name, customerId, address, phone, sheet: ws.name });
      }
    });
    console.log(`TOTAL VALID CUSTOMERS IN SHEET "${ws.name}": ${customers.length}`);
    if (customers.length > 0) {
      console.log(`First 3:`, customers.slice(0, 3));
      console.log(`Last 3:`, customers.slice(-3));
    }
  });
}

main().catch(console.error);
