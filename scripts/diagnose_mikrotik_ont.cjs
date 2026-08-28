'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { RouterOSAPI } = require('node-routeros');

async function main() {
  const ontIp = '192.168.20.113';

  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) {
    console.error('No active router found');
    return;
  }

  console.log(`=== DIAGNOSIS MIKROTIK -> ONT (${ontIp}) via Router: ${router.name} (${router.ipAddress}) ===\n`);

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

    // 1. Check if ONT IP is active in PPP sessions
    console.log('\n[2] Checking active PPP sessions for ONT IP / EMG258...');
    const activeSessions = await api.write('/ppp/active/print');
    const userSession = activeSessions.find(s => s.address === ontIp || s.name?.includes('EMG258') || s.name?.toLowerCase().includes('nurhayati'));
    if (userSession) {
      console.log('  FOUND ACTIVE SESSION:', {
        name: userSession.name,
        service: userSession.service,
        callerId: userSession['caller-id'],
        address: userSession.address,
        uptime: userSession.uptime,
      });
    } else {
      console.log(`  WARNING: No active session found with IP ${ontIp}! Active sessions total: ${activeSessions.length}`);
      const similar = activeSessions.filter(s => s.address?.startsWith('192.168.20.')).slice(0, 5);
      console.log('  Sample active IPs:', similar.map(s => `${s.name} -> ${s.address}`));
    }

    // 2. Ping ONT from MikroTik
    console.log(`\n[3] Pinging ${ontIp} directly from MikroTik...`);
    const pingResult = await api.write('/ping', [
      `=address=${ontIp}`,
      '=count=3',
    ]).catch(err => [{ status: 'error', message: err.message }]);
    console.log('  Ping Result:', pingResult);

    // 3. Test HTTP fetch directly from MikroTik to ONT port 80
    console.log(`\n[4] Testing HTTP fetch from MikroTik to http://${ontIp}:80/...`);
    try {
      const fetch80 = await api.write('/tool/fetch', [
        `=url=http://${ontIp}/`,
        '=as-value=',
      ]);
      console.log('  Port 80 Fetch Success! Status:', fetch80);
    } catch (fetchErr) {
      console.log('  Port 80 Fetch Error:', fetchErr.message || fetchErr);
    }

    // 4. Test HTTP fetch directly from MikroTik to ONT port 8080
    console.log(`\n[5] Testing HTTP fetch from MikroTik to http://${ontIp}:8080/...`);
    try {
      const fetch8080 = await api.write('/tool/fetch', [
        `=url=http://${ontIp}:8080/`,
        '=as-value=',
      ]);
      console.log('  Port 8080 Fetch Success! Status:', fetch8080);
    } catch (fetchErr) {
      console.log('  Port 8080 Fetch Error:', fetchErr.message || fetchErr);
    }

    // 5. Test HTTP fetch to /getpage.gch?pid=1002
    console.log(`\n[6] Testing HTTP fetch from MikroTik to http://${ontIp}/getpage.gch?pid=1002...`);
    try {
      const fetchZte = await api.write('/tool/fetch', [
        `=url=http://${ontIp}/getpage.gch?pid=1002`,
        '=as-value=',
      ]);
      console.log('  ZTE Path Fetch Success! Status:', fetchZte);
    } catch (fetchErr) {
      console.log('  ZTE Path Fetch Error:', fetchErr.message || fetchErr);
    }

    // 6. Check Firewall Filter rules
    console.log('\n[7] Checking Firewall Filter rules...');
    const filters = await api.write('/ip/firewall/filter/print').catch(() => []);
    const dropRules = filters.filter(f => f.action === 'drop' || f.action === 'reject');
    console.log(`  Total filter rules: ${filters.length}, Drop/Reject rules: ${dropRules.length}`);
    for (const r of dropRules.slice(0, 5)) {
      console.log(`  - Chain: ${r.chain}, Action: ${r.action}, In-Interface: ${r['in-interface'] || 'any'}, Comment: ${r.comment || '-'}`);
    }

    // 7. Check NAT rules
    console.log('\n[8] Checking NAT rules for port 24000...');
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    const port24000Nats = nats.filter(n => String(n['dst-port']) === '24000');
    console.log('  Port 24000 NAT Rules:', port24000Nats);

  } catch (error) {
    console.error('Diagnostic error:', error);
  } finally {
    try { api.close(); } catch (_) {}
    await prisma.$disconnect();
  }
}

main();
