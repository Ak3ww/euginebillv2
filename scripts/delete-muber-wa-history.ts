import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function deleteMuberWaHistory() {
  console.log('🗑️ Memulai pembersihan riwayat WA untuk area Muara Beres / KMB...\n');

  try {
    // 1. Fetch all users belonging to Muara Beres / KMB area or address
    const muberUsers = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { area: { name: { contains: 'Muara Beres', mode: 'insensitive' } } },
          { area: { name: { contains: 'KMB', mode: 'insensitive' } } },
          { address: { contains: 'Muara Beres', mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        name: true,
        phone: true,
        username: true,
      },
    });

    console.log(`👤 Ditemukan ${muberUsers.length} pelanggan di area Muara Beres / KMB.`);

    // 2. Build list of phone variations and names for deletion
    const phoneSet = new Set<string>();
    const nameList: string[] = [];

    for (const u of muberUsers) {
      if (u.name) nameList.push(u.name.trim());
      if (!u.phone) continue;

      const clean = u.phone.replace(/[^0-9]/g, '');
      if (clean) {
        phoneSet.add(clean);
        if (clean.startsWith('62')) {
          phoneSet.add('0' + clean.slice(2));
        } else if (clean.startsWith('0')) {
          phoneSet.add('62' + clean.slice(1));
        }
      }
    }

    const phoneList = Array.from(phoneSet);

    // 3. Delete matching logs from whatsapp_history
    const whereCondition: any = {
      OR: [
        ...(phoneList.length > 0 ? [{ phone: { in: phoneList } }] : []),
        ...nameList.map(name => ({ message: { contains: name } })),
      ],
    };

    const countToDelete = await prisma.whatsapp_history.count({
      where: whereCondition,
    });

    console.log(`📊 Ditemukan ${countToDelete} log riwayat WA Muara Beres yang akan dihapus.`);

    if (countToDelete > 0) {
      const result = await prisma.whatsapp_history.deleteMany({
        where: whereCondition,
      });
      console.log(`\n🎉 BERHASIL! Dihapus ${result.count} riwayat pesan WA untuk area Muara Beres.`);
    } else {
      console.log('\n✅ Tidak ada riwayat WA Muara Beres yang perlu dihapus.');
    }
  } catch (error) {
    console.error('❌ Error deleting Muber WA history:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

deleteMuberWaHistory();
