import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Inspecting PPPoE Customers Data in Database...\n');

  const users = await prisma.pppoeUser.findMany({
    select: {
      id: true,
      name: true,
      username: true,
      phone: true,
      address: true,
      area: true,
      profileName: true,
      routerId: true,
      router: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  console.log(`📊 Total Pelanggan di Database: ${users.length}`);

  // Grouping by Area
  const areaGroups: Record<string, typeof users> = {};
  users.forEach(u => {
    const areaName = u.area || 'TANPA_AREA';
    if (!areaGroups[areaName]) areaGroups[areaName] = [];
    areaGroups[areaName].push(u);
  });

  console.log('\n📌 Kelompok Pelanggan Berdasarkan Area:');
  Object.entries(areaGroups).forEach(([area, list]) => {
    console.log(`  - Area "${area}": ${list.length} pelanggan`);
  });

  console.log('\n📌 Kelompok Pelanggan Berdasarkan Router Saat Ini:');
  const routerGroups: Record<string, typeof users> = {};
  users.forEach(u => {
    const rName = u.router?.name || 'TIDAK_ADA_ROUTER';
    if (!routerGroups[rName]) routerGroups[rName] = [];
    routerGroups[rName].push(u);
  });

  Object.entries(routerGroups).forEach(([rName, list]) => {
    console.log(`  - Router "${rName}": ${list.length} pelanggan`);
  });

  // Check potential Citeureup keywords in address / area / username
  const citeureupCandidates = users.filter(u => {
    const text = `${u.name} ${u.username} ${u.address || ''} ${u.area || ''}`.toLowerCase();
    return text.includes('citeureup') || text.includes('ctr') || text.includes('tajur') || text.includes('puspanegara');
  });

  console.log(`\n💡 Pelanggan yang Terdeteksi Memiliki Kata Kunci Citeureup (${citeureupCandidates.length} orang):`);
  citeureupCandidates.forEach((u, i) => {
    console.log(`  [${i + 1}] ID: ${u.id} | Nama: ${u.name} | User: ${u.username} | Area: ${u.area || '-'} | Alamat: ${u.address || '-'}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
