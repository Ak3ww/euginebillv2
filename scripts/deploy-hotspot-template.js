const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');

const prisma = new PrismaClient();

async function deployHotspotTemplate() {
  console.log('====================================================');
  console.log('   DEPLOY HALLMARK HOTSPOT LOGIN TEMPLATE');
  console.log('====================================================\n');

  try {
    const templatePath = path.join(__dirname, '..', 'templates', 'hotspot', 'login.html');
    if (!fs.existsSync(templatePath)) {
      console.error('❌ File template tidak ditemukan di:', templatePath);
      return;
    }

    const htmlContent = fs.readFileSync(templatePath, 'utf8');
    console.log(`✓ Template loaded (${htmlContent.length} bytes)\n`);

    const routers = await prisma.router.findMany({ where: { isActive: true } });
    console.log(`Ditemukan ${routers.length} router aktif.\n`);

    for (const router of routers) {
      const apiHost = router.ipAddress || router.nasname;
      const apiPort = router.port || 8728;
      console.log(`Connecting to router: ${router.name} (${apiHost}:${apiPort})...`);

      const api = new RouterOSAPI({
        host: apiHost,
        port: apiPort,
        user: router.username,
        password: router.password,
        timeout: 10,
      });

      try {
        await api.connect();
        console.log(`✓ Terhubung ke ${router.name}!`);

        const files = await api.write('/file/print');
        const loginFile = files.find(f => f.name === 'hotspot/login.html');

        if (!loginFile) {
          console.warn(`⚠️ File hotspot/login.html belum ada di ${router.name}. Lewati router ini.`);
          await api.close();
          continue;
        }

        console.log(`Updating hotspot/login.html on ${router.name} (.id=${loginFile['.id']})...`);
        await api.write(['/file/set', `=.id=${loginFile['.id']}`, `=contents=${htmlContent}`]);

        console.log(`✓ Berhasil deploy template ke ${router.name}!\n`);
        await api.close();
      } catch (rErr) {
        console.error(`❌ Gagal update di router ${router.name}:`, rErr.message);
      }
    }

    console.log('====================================================');
    console.log('✓ SELESAI DEPLOY TEMPLATE KE SEMUA ROUTER!');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Fatal error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

deployHotspotTemplate();
