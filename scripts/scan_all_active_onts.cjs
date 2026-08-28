'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { RouterOSAPI } = require('node-routeros');
const net = require('net');

async function main() {
  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) return;
  const mikrotikVpnIp = router.ipAddress;

  console.log(`=== SCANNING ACTIVE ONTS FOR OPEN WEB PORTS (80 & 8080) ===\n`);

  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 10,
  });

  try {
    await api.connect();
    const activeSessions = await api.write('/ppp/active/print');
    console.log(`Found ${activeSessions.length} active PPPoE sessions\n`);

    // Let's sample 15 active sessions
    const sample = activeSessions.slice(0, 15);

    // Clean old scan NATs
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (r.comment?.includes('multi-ont-scan')) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

    // Add general SRCNAT masquerade
    await api.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      '=action=masquerade',
      '=comment=multi-ont-scan-srcnat',
    ]);

    const basePort = 24100;
    for (let i = 0; i < sample.length; i++) {
      const sess = sample[i];
      const p80 = basePort + (i * 2);
      const p8080 = basePort + (i * 2) + 1;

      // Port 80
      await api.write('/ip/firewall/nat/add', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-port=${p80}`,
        `=to-addresses=${sess.address}`,
        '=to-ports=80',
        '=action=dst-nat',
        `=comment=multi-ont-scan ${p80}->80`,
      ]);

      // Port 8080
      await api.write('/ip/firewall/nat/add', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-port=${p8080}`,
        `=to-addresses=${sess.address}`,
        '=to-ports=8080',
        '=action=dst-nat',
        `=comment=multi-ont-scan ${p8080}->8080`,
      ]);
    }

    function checkPort(port) {
      return new Promise((resolve) => {
        const s = net.connect(port, mikrotikVpnIp);
        s.setTimeout(1200);
        s.on('connect', () => { s.destroy(); resolve(true); });
        s.on('timeout', () => { s.destroy(); resolve(false); });
        s.on('error', () => resolve(false));
      });
    }

    console.log('Testing open ports on 15 sampled active ONTs:');
    for (let i = 0; i < sample.length; i++) {
      const sess = sample[i];
      const p80 = basePort + (i * 2);
      const p8080 = basePort + (i * 2) + 1;

      const has80 = await checkPort(p80);
      const has8080 = await checkPort(p8080);

      const mac = sess['caller-id'] || '-';
      let vendor = 'Unknown';
      if (mac.startsWith('C8:4C:78') || mac.startsWith('CC:7B:35') || mac.startsWith('D0:15:4A') || mac.startsWith('70:9F:2D')) vendor = 'ZTE';
      else if (mac.startsWith('F8:F0:82') || mac.startsWith('48:EE:0C') || mac.startsWith('E0:67:B3')) vendor = 'Huawei';
      else if (mac.startsWith('00:0C:43') || mac.startsWith('00:E0:4C') || mac.startsWith('80:89:17')) vendor = 'SK / Realtek';

      let status = 'CLOSED ON WAN';
      if (has80 && has8080) status = 'PORT 80 & 8080 OPEN!';
      else if (has80) status = 'PORT 80 OPEN!';
      else if (has8080) status = 'PORT 8080 OPEN!';

      console.log(`  - [${sess.name.padEnd(10)}] IP: ${sess.address.padEnd(15)} | MAC: ${mac} (${vendor.padEnd(8)}) -> ${status}`);
    }

    // Cleanup
    const natsAfter = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of natsAfter) {
      if (r.comment?.includes('multi-ont-scan')) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

  } catch (err) {
    console.error('Scan error:', err);
  } finally {
    try { api.close(); } catch (_) {}
    await prisma.$disconnect();
    console.log('\n=== MULTI-ONT SCAN COMPLETED ===');
  }
}

main();
