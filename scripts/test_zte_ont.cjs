'use strict';
const net = require('net');
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ontIp = '192.168.20.113';
  const proxyPort = 24000;

  // 1. Get router with VPN
  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) {
    console.error('No active router found');
    return;
  }

  const mikrotikVpnIp = router.ipAddress;
  console.log(`=== PROBING ZTE ONT (${ontIp}) via MikroTik (${mikrotikVpnIp}:${proxyPort}) ===\n`);

  // Ensure MikroTik NAT rules are installed for port 24000 -> 192.168.20.113:80
  const { RouterOSAPI } = require('node-routeros');
  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 5,
  });

  try {
    await api.connect();
    console.log('[MikroTik] Connected to RouterOS API');

    // Clean old NAT rules for port 24000
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (String(r['dst-port']) === String(proxyPort)) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

    // Add DST-NAT: 24000 -> 192.168.20.113:80
    await api.write('/ip/firewall/nat/add', [
      '=chain=dstnat',
      '=protocol=tcp',
      `=dst-port=${proxyPort}`,
      `=to-addresses=${ontIp}`,
      '=to-ports=80',
      '=action=dst-nat',
      `=comment=test-zte ${proxyPort}`,
    ]);

    // Add SRCNAT masquerade
    await api.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      `=dst-address=${ontIp}`,
      '=to-ports=80',
      '=action=masquerade',
      `=comment=test-zte-srcnat ${proxyPort}`,
    ]);

    console.log('[MikroTik] NAT rules installed for port 24000 -> 192.168.20.113:80\n');
  } catch (e) {
    console.warn('[MikroTik Warning]:', e.message);
  } finally {
    try { api.close(); } catch (_) {}
  }

  // Helper to send raw TCP request to MikroTik:24000 and return raw response
  function probeRaw(name, rawPayload) {
    return new Promise((resolve) => {
      console.log(`--- TEST: ${name} ---`);
      const socket = net.connect(proxyPort, mikrotikVpnIp);
      socket.setTimeout(4000);
      let response = '';

      socket.on('connect', () => {
        socket.write(rawPayload);
      });

      socket.on('data', (chunk) => {
        response += chunk.toString('latin1');
      });

      socket.on('timeout', () => {
        console.log(`  [TIMEOUT] No response from ONT within 4s`);
        socket.destroy();
        resolve(null);
      });

      socket.on('error', (err) => {
        console.log(`  [SOCKET ERROR] ${err.message}`);
        resolve(null);
      });

      socket.on('close', () => {
        const firstLine = response.split('\n')[0].trim();
        const headerBlock = response.split('\r\n\r\n')[0] || response.slice(0, 300);
        console.log(`  [RESPONSE] First Line: ${firstLine}`);
        if (firstLine.includes('200') || firstLine.includes('302') || firstLine.includes('301')) {
          console.log(`  >>> SUCCESS! Response Headers:\n${headerBlock}\n`);
        } else {
          console.log(`  >>> Failed (${firstLine})\n`);
        }
        resolve(response);
      });
    });
  }

  // 1. Test standard HTTP/1.1 with Host: 192.168.20.113
  await probeRaw('1. GET / HTTP/1.1 with Host: 192.168.20.113', 
    `GET / HTTP/1.1\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 2. Test HTTP/1.0 with Host: 192.168.20.113
  await probeRaw('2. GET / HTTP/1.0 with Host: 192.168.20.113', 
    `GET / HTTP/1.0\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 3. Test HTTP/1.1 with Host: 192.168.1.1 (ZTE Default LAN IP)
  await probeRaw('3. GET / HTTP/1.1 with Host: 192.168.1.1', 
    `GET / HTTP/1.1\r\nHost: 192.168.1.1\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 4. Test HTTP/1.0 without Host header (Minimal HTTP 1.0)
  await probeRaw('4. GET / HTTP/1.0 (No Host Header)', 
    `GET / HTTP/1.0\r\nUser-Agent: Mozilla/5.0\r\n\r\n`
  );

  // 5. Test GET /getpage.gch?pid=1002 (ZTE Login Page Direct Path) with Host: 192.168.20.113
  await probeRaw('5. GET /getpage.gch?pid=1002 HTTP/1.1 with Host: 192.168.20.113', 
    `GET /getpage.gch?pid=1002 HTTP/1.1\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 6. Test GET /getpage.gch?pid=1002 HTTP/1.1 with Host: 192.168.1.1
  await probeRaw('6. GET /getpage.gch?pid=1002 HTTP/1.1 with Host: 192.168.1.1', 
    `GET /getpage.gch?pid=1002 HTTP/1.1\r\nHost: 192.168.1.1\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 7. Test GET /login.gch HTTP/1.1 with Host: 192.168.20.113
  await probeRaw('7. GET /login.gch HTTP/1.1 with Host: 192.168.20.113', 
    `GET /login.gch HTTP/1.1\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 8. Test GET /login.gch HTTP/1.1 with Host: 192.168.1.1
  await probeRaw('8. GET /login.gch HTTP/1.1 with Host: 192.168.1.1', 
    `GET /login.gch HTTP/1.1\r\nHost: 192.168.1.1\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 9. Test GET /cgi-bin/index2.asp HTTP/1.1 (SK Style)
  await probeRaw('9. GET /cgi-bin/index2.asp HTTP/1.1 with Host: 192.168.20.113', 
    `GET /cgi-bin/index2.asp HTTP/1.1\r\nHost: ${ontIp}\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  // 10. Test with port 8080 (Change NAT to to-ports=8080)
  console.log('\n--- Switching MikroTik NAT to to-ports=8080 to test Port 8080 ---');
  try {
    const api2 = new RouterOSAPI({ host: router.ipAddress, port: router.port || 8728, user: router.username, password: router.password, timeout: 5 });
    await api2.connect();
    const nats = await api2.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (String(r['dst-port']) === String(proxyPort)) {
        if (r['.id']) await api2.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }
    await api2.write('/ip/firewall/nat/add', [
      '=chain=dstnat',
      '=protocol=tcp',
      `=dst-port=${proxyPort}`,
      `=to-addresses=${ontIp}`,
      '=to-ports=8080',
      '=action=dst-nat',
      `=comment=test-zte-8080 ${proxyPort}`,
    ]);
    await api2.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      `=dst-address=${ontIp}`,
      '=to-ports=8080',
      '=action=masquerade',
      `=comment=test-zte-srcnat-8080 ${proxyPort}`,
    ]);
    api2.close();
  } catch (_) {}

  await probeRaw('10. Port 8080: GET / HTTP/1.1 with Host: 192.168.20.113:8080', 
    `GET / HTTP/1.1\r\nHost: ${ontIp}:8080\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  await probeRaw('11. Port 8080: GET /getpage.gch?pid=1002 HTTP/1.1', 
    `GET /getpage.gch?pid=1002 HTTP/1.1\r\nHost: ${ontIp}:8080\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  await probeRaw('12. Port 8080: GET /cgi-bin/index2.asp HTTP/1.1', 
    `GET /cgi-bin/index2.asp HTTP/1.1\r\nHost: ${ontIp}:8080\r\nUser-Agent: Mozilla/5.0\r\nConnection: close\r\n\r\n`
  );

  console.log('=== SELESAI PENGUJIAN PROBE ZTE ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
