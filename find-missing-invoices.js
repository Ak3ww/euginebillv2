const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Ambil semua user selain Citeureup
  const users = await prisma.pppoeUser.findMany({
    where: {
      router: {
        isNot: {
          name: {
            contains: 'citeureup'
          }
        }
      }
    },
    include: {
      router: true,
      profile: true
    }
  });

  // 2. Ambil semua invoice
  const invoices = await prisma.invoice.findMany({
    select: {
      id: true,
      customerUsername: true,
      status: true
    }
  });

  // Ambil list username yang sudah punya invoice
  const usersWithInvoices = new Set(invoices.map(inv => inv.customerUsername));

  // 3. Cari user yang TIDAK ADA di list username invoice
  const missingUsers = users.filter(u => !usersWithInvoices.has(u.username));

  console.log('====================================');
  console.log(`Total Pelanggan Tanpa Citeureup: ${users.length}`);
  console.log(`Total Pelanggan Tanpa Citeureup yang tidak punya tagihan: ${missingUsers.length}`);
  console.log('====================================');
  
  if (missingUsers.length > 0) {
    console.log('Daftar Pelanggan yang Belum Punya Tagihan Sama Sekali:');
    missingUsers.forEach((u, i) => {
      console.log(`${i + 1}. Nama: ${u.name}`);
      console.log(`   Username: ${u.username}`);
      console.log(`   Status: ${u.status}`);
      console.log(`   Router: ${u.router?.name || '-'}`);
      console.log(`   Paket: ${u.profile?.name || '-'}`);
      console.log('------------------------------------');
    });
  } else {
    console.log('Semua pelanggan (tanpa citeureup) sudah memiliki tagihan.');
    
    // Jika ternyata semua punya tagihan, coba kita hitung berapa jumlah tagihannya
    // Mungkin ada 2 orang yang punya > 1 tagihan? atau ada tagihan yang tidak terkait ke user?
    const invoicesWithoutCiteureup = invoices.filter(inv => {
      const user = users.find(u => u.username === inv.customerUsername);
      return user !== undefined;
    });
    
    console.log(`Total Tagihan yang dimiliki oleh pelanggan tanpa citeureup: ${invoicesWithoutCiteureup.length}`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
