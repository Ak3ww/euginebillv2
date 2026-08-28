'use strict';
const net = require('net');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { RouterOSAPI } = require('node-routeros');

async function main() {
  const ontIp = '192.168.20.113';
  const proxyPort = 24000;

  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) return;

  const mikrotikVpnIp = router.ipAddress;
  console.log(`=== TESTING FIXED NAT RULES (DSTNAT + SRCNAT) TO ZTE (${ontIp}) ===\n`);

  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 10,
  });

  try {
    await api.connect();
    console.log('[1] Connected to MikroTik RouterOS API');

    // 1. Clean existing port 24000 and ontIp test NAT rules
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (String(r['dst-port']) === String(proxyPort) || r.comment?.includes('test-zte') || r.comment?.includes('ont-remote-24000')) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

    // 2. Add correct DST-NAT rule
    console.log('[2] Adding DST-NAT: port 24000 -> 192.168.20.113:80');
    await api.write('/ip/firewall/nat/add', [
      '=chain=dstnat',
      '=protocol=tcp',
      `=dst-port=${proxyPort}`,
      `=to-addresses=${ontIp}`,
      '=to-ports=80',
      '=action=dst-nat',
      `=comment=ont-remote-24000 dstnat`,
    ]);

    // 3. Add correct SRCNAT masquerade rule (WITHOUT invalid to-ports parameter)
    console.log('[3] Adding SRCNAT: dst-address=192.168.20.113 action=masquerade');
    await api.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      `=dst-address=${ontIp}`,
      '=action=masquerade',
      `=comment=ont-remote-24000 srcnat`,
    ]);

    // 4. Test fetch with dst-path=tmp_fetch.txt
    console.log('\n[4] Testing /tool/fetch directly from MikroTik to ONT port 80:');
    try {
      const fetchRes = await api.write('/tool/fetch', [
        `=url=http://${ontIp}/`,
        '=dst-path=tmp_fetch.txt',
      ]);
      console.log('  /tool/fetch Success!', fetchRes);
    } catch (fErr) {
      console.log('  /tool/fetch Status:', fErr.message);
    }

  } catch (err) {
    console.error('MikroTik API error:', err);
  } finally {
    try { api.close(); } catch (_) {}
  }

  // 5. Probe from VPS to MikroTik:24000 via TCP socket
  console.log(`\n[5] Probing TCP connection from VPS to ${mikrotikVpnIp}:${proxyPort}...`);
  const probePromise = new Promise((resolve) => {
    const sock = net.connect(proxyPort, mikrotikVpnIp);
    sock.setTimeout(5000);
    let buf = '';

    sock.on('connect', () => {
      console.log('  >>> TCP CONNECT SUCCESS! Sending HTTP GET / with Host: ' + ontIp);
      sock.write(`GET / HTTP/1.1\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`);
    });

    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
    });

    sock.on('timeout', () => {
      console.log('  [TIMEOUT] No response within 5s');
      sock.destroy();
      resolve(null);
    });

    sock.on('error', (err) => {
      console.log('  [TCP ERROR]:', err.message);
      resolve(null);
    });

    sock.on('close', () => {
      console.log('  >>> TCP CONNECTION CLOSED');
      console.log('  === RAW RESPONSE RECEIVED FROM ONT ===');
      console.log(buf.substring(0, 1000));
      resolve(buf);
    });
  });

  await probePromise;
  await prisma.$disconnect();
}

main();
