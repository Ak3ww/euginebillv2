import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectRoutersAndOlts() {
  console.log('============== DATA ROUTER & OLT CITEUREUP VS CIBINONG ==============\n');

  try {
    // 1. Fetch Routers
    const routers = await prisma.router.findMany();
    console.log('📡 MIKROTIK ROUTERS:');
    routers.forEach(r => {
      console.log(`  - [ID: ${r.id}] Name: ${r.name}`);
      console.log(`    IP Address: ${r.ipAddress} | NAS Name: ${r.nasname}`);
      console.log(`    API Port: ${r.port || 8728} | Status: ${r.isActive ? 'AKTIF' : 'NONAKTIF'}`);
      console.log('    --------------------------------------------------');
    });

    // 2. Fetch OLTs
    const olts = await prisma.olt.findMany({
      include: { router: true }
    });
    console.log('\n⚡ OLT DEVICES:');
    if (olts.length === 0) {
      console.log('  (Belum ada OLT terdaftar di tabel OLT database)');
    } else {
      olts.forEach(o => {
        console.log(`  - [ID: ${o.id}] Name: ${o.name}`);
        console.log(`    IP Address: ${o.ipAddress} | Brand: ${o.brand} | Model: ${o.model}`);
        console.log(`    Router Linked: ${o.router?.name || 'Unlinked'} (${o.routerId || '-'})`);
        console.log('    --------------------------------------------------');
      });
    }

    // 3. Count Users per Router
    console.log('\n👥 JUMLAH PELANGGAN PER ROUTER:');
    for (const r of routers) {
      const count = await prisma.pppoeUser.count({ where: { routerId: r.id } });
      console.log(`  - Router "${r.name}": ${count} Pelanggan PPPoE`);
    }

  } catch (error) {
    console.error('❌ Error inspecting:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

inspectRoutersAndOlts();
