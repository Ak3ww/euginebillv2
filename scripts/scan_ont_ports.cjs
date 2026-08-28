'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { RouterOSAPI } = require('node-routeros');
const net = require('net');

async function main() {
  const ontIp = '192.168.20.113';
  const baseProxyPort = 24010;

  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) return;
  const mikrotikVpnIp = router.ipAddress;

  console.log(`=== SCANNING OPEN PORTS ON ZTE ONT (${ontIp}) via MikroTik ===\n`);

  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 10,
  });

  const portsToScan = [80, 8080, 443, 8000, 8081, 8888, 7547, 8443, 21, 22, 23];

  try {
    await api.connect();
    console.log('[1] Connected to RouterOS API');

    // Clean old scan NATs
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (r.comment?.includes('port-scan-ont')) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

    // Ensure general SRCNAT masquerade for this ONT is in place
    await api.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      `=dst-address=${ontIp}`,
      '=action=masquerade',
      '=comment=port-scan-ont-srcnat',
    ]);

    // Install DST-NAT for all probe ports
    for (let i = 0; i < portsToScan.length; i++) {
      const targetP = portsToScan[i];
      const proxyP = baseProxyPort + i;
      await api.write('/ip/firewall/nat/add', [
        '=chain=dstnat',
        '=protocol=tcp',
        `=dst-port=${proxyP}`,
        `=to-addresses=${ontIp}`,
        `=to-ports=${targetP}`,
        '=action=dst-nat',
        `=comment=port-scan-ont ${proxyP}->${targetP}`,
      ]);
    }
    console.log(`[2] Installed NAT forwarding for ${portsToScan.length} ports (ports 24010 - ${24010 + portsToScan.length - 1})\n`);

  } catch (err) {
    console.error('MikroTik API error:', err);
  } finally {
    try { api.close(); } catch (_) {}
  }

  // Scan all ports in parallel
  console.log('[3] Testing TCP connection to each port from VPS...');
  for (let i = 0; i < portsToScan.length; i++) {
    const targetP = portsToScan[i];
    const proxyP = baseProxyPort + i;

    const result = await new Promise((resolve) => {
      const sock = net.connect(proxyP, mikrotikVpnIp);
      sock.setTimeout(2500);

      sock.on('connect', () => {
        sock.destroy();
        resolve({ port: targetP, status: 'OPEN / ACTIVE' });
      });

      sock.on('timeout', () => {
        sock.destroy();
        resolve({ port: targetP, status: 'TIMEOUT (Closed / Filtered by ONT firewall)' });
      });

      sock.on('error', (err) => {
        resolve({ port: targetP, status: 'REFUSED (' + err.code + ')' });
      });
    });

    console.log(`  - Port ${result.port.toString().padEnd(6)} -> ${result.status}`);
  }

  // Clean up scan NATs
  try {
    const api2 = new RouterOSAPI({ host: router.ipAddress, port: router.port || 8728, user: router.username, password: router.password, timeout: 5 });
    await api2.connect();
    const nats = await api2.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (r.comment?.includes('port-scan-ont')) {
        if (r['.id']) await api2.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }
    api2.close();
  } catch (_) {}

  await prisma.$disconnect();
  console.log('\n=== SCANNING SELESAI ===');
}

main();
