const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Berdasarkan log error Bapak sebelumnya, error "Bad MAC" pertama kali 
  // terlihat sekitar tanggal 28 Juli 2026 pukul 09:38 WIB.
  // Oleh karena itu, semua pesan yang terkirim semenjak waktu itu berpotensi GAGAL diterima pelanggan
  // meskipun statusnya dibilang 'sent' oleh Baileys.
  
  const badMacStartTime = new Date('2026-07-28T09:38:00+07:00');

  const suspiciousMessages = await prisma.whatsapp_history.findMany({
    where: {
      status: 'sent',
      providerType: 'baileys',
      sentAt: {
        gte: badMacStartTime
      }
    },
    orderBy: { sentAt: 'desc' }
  });

  console.log('====================================');
  console.log(`Menemukan ${suspiciousMessages.length} pesan WA yang berpotensi "Gagal Terkirim" (False Success)`);
  console.log(`karena dikirim saat sesi enkripsi Baileys sedang rusak (sejak 28 Jul 09:38).`);
  console.log('====================================\n');

  if (suspiciousMessages.length > 0) {
    suspiciousMessages.forEach((msg, i) => {
      // Ambil sebagian kecil pesan untuk referensi
      const snippet = msg.message.substring(0, 50).replace(/\n/g, ' ') + '...';
      console.log(`${i + 1}. Waktu: ${msg.sentAt.toLocaleString('id-ID')}`);
      console.log(`   Nomor: ${msg.phone}`);
      console.log(`   Pesan: ${snippet}`);
      console.log('------------------------------------');
    });
    console.log(`\nSaran: Bapak bisa mengirim ulang tagihan atau notifikasi ini secara manual.`);
  } else {
    console.log('Aman! Tidak ada pesan yang tercatat terkirim di periode kerusakan tersebut.');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
