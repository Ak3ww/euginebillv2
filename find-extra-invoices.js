const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Ambil semua invoice aktif
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      customerUsername: true,
      customerName: true,
      status: true,
      createdAt: true
    }
  });

  // Ambil semua user untuk referensi
  const users = await prisma.pppoeUser.findMany({
    include: { router: true }
  });

  console.log('====================================');
  console.log(`Total Semua Tagihan di Database: ${invoices.length}`);
  
  // 1. Cek Tagihan Ganda (Satu User Punya Lebih dari 1 Tagihan)
  const invoiceCountByUser = {};
  invoices.forEach(inv => {
    const user = inv.customerUsername || inv.customerName; // fallback if no username
    if (!invoiceCountByUser[user]) invoiceCountByUser[user] = [];
    invoiceCountByUser[user].push(inv);
  });

  const duplicateInvoices = Object.entries(invoiceCountByUser).filter(([user, invs]) => invs.length > 1);

  if (duplicateInvoices.length > 0) {
    console.log('\n⚠️ PELANGGAN DENGAN TAGIHAN GANDA (>1 Tagihan):');
    duplicateInvoices.forEach(([username, invs]) => {
      console.log(`\n- Username: ${username}`);
      invs.forEach((inv, i) => {
        console.log(`  ${i+1}. No Invoice: ${inv.invoiceNumber} | Status: ${inv.status} | Dibuat: ${inv.createdAt.toISOString().split('T')[0]}`);
      });
    });
  } else {
    console.log('\n✅ Tidak ada pelanggan dengan tagihan ganda.');
  }

  // 2. Cek Tagihan Milik Pelanggan Citeureup
  const citeureupInvoices = invoices.filter(inv => {
    const user = users.find(u => u.username === inv.customerUsername);
    return user && user.router?.name?.toLowerCase().includes('citeureup');
  });

  if (citeureupInvoices.length > 0) {
    console.log(`\n⚠️ TAGIHAN MILIK PELANGGAN CITEUREUP (${citeureupInvoices.length} tagihan):`);
    citeureupInvoices.forEach(inv => {
      console.log(`- Username: ${inv.customerUsername} | Nama: ${inv.customerName} | Invoice: ${inv.invoiceNumber} | Status: ${inv.status}`);
    });
  } else {
    console.log('\n✅ Tidak ada tagihan milik pelanggan Citeureup.');
  }

  // 3. Cek Tagihan Tanpa User (Orphan)
  const orphanInvoices = invoices.filter(inv => {
    return !users.some(u => u.username === inv.customerUsername);
  });

  if (orphanInvoices.length > 0) {
    console.log(`\n⚠️ TAGIHAN TANPA USER / ORPHAN (${orphanInvoices.length} tagihan):`);
    orphanInvoices.forEach(inv => {
      console.log(`- Nama: ${inv.customerName} | Invoice: ${inv.invoiceNumber} | Status: ${inv.status}`);
    });
  } else {
    console.log('\n✅ Tidak ada tagihan tanpa user.');
  }
  
  console.log('====================================');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
