#!/usr/bin/env node

/**
 * EugineBill Router Connection Diagnostic Tool
 * Usage: node scripts/test-router-cli.js [router_name_or_ip]
 * Example: node scripts/test-router-cli.js CIBINONG
 */

const net = require('net');
const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');

const prisma = new PrismaClient();

async function testTcp(host, port, timeoutMs = 3000) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.connect(port, host, () => {
      if (!resolved) {
        resolved = true;
        const latency = Date.now() - start;
        socket.destroy();
        resolve({ ok: true, latency });
      }
    });

    socket.on('timeout', () => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ok: false, error: `TCP TIMEOUT after ${timeoutMs}ms (host tidak merespon SYN — firewall drop atau IP tidak rute)` });
      }
    });

    socket.on('error', (err) => {
      if (!resolved) {
        resolved = true;
        socket.destroy();
        resolve({ ok: false, error: `TCP ERROR: ${err.message} (${err.code})` });
      }
    });
  });
}

async function main() {
  const searchTerm = process.argv[2] || 'CIBINONG';
  console.log(`\n=== EUGINEBILL MIKROTIK DIAGNOSTIC TOOL ===`);
  console.log(`Mencari router dengan keyword: "${searchTerm}"...\n`);

  const routers = await prisma.router.findMany({
    where: {
      OR: [
        { name: { contains: searchTerm } },
        { ipAddress: { contains: searchTerm } },
        { nasname: { contains: searchTerm } },
      ],
    },
    include: { vpnClient: true },
  });

  if (routers.length === 0) {
    console.log(`Router tidak ditemukan dengan keyword "${searchTerm}".`);
    console.log(`Menampilkan semua router di database:\n`);
    const all = await prisma.router.findMany({
      select: { id: true, name: true, ipAddress: true, port: true, username: true },
    });
    console.table(all);
    return;
  }

  for (const router of routers) {
    const vpnClient = router.vpnClient;
    const configuredHost = router.ipAddress || router.nasname;
    const configuredPort = router.port || 8728;
    const user = router.username || vpnClient?.apiUsername || 'admin';
    const pass = router.password || vpnClient?.apiPassword || '';
    const vpnTargetPort = (vpnClient?.publicPorts)?.services?.api?.target;

    console.log(`--------------------------------------------------`);
    console.log(`Router ID       : ${router.id}`);
    console.log(`Nama            : ${router.name}`);
    console.log(`Host / IP       : ${configuredHost}`);
    console.log(`Port API        : ${configuredPort}`);
    console.log(`Username        : ${user}`);
    console.log(`Password        : ${pass ? '•••••••• (' + pass.length + ' chars)' : '(KOSONG)'}`);
    console.log(`VPN Linked      : ${vpnClient ? `YES (VPN IP: ${vpnClient.vpnIp}, Type: ${vpnClient.vpnType})` : 'NO'}`);
    if (vpnTargetPort) {
      console.log(`VPN API Target  : ${vpnTargetPort}`);
    }
    console.log(`--------------------------------------------------`);

    // STEP 1: TCP Port Test
    console.log(`\n[STEP 1] Menguji TCP Socket ke ${configuredHost}:${configuredPort}...`);
    const tcpResult = await testTcp(configuredHost, configuredPort, 3500);

    if (!tcpResult.ok) {
      console.error(`  [GAGAL] ${tcpResult.error}`);
      console.log(`\n  DIAGNOSA:`);
      if (tcpResult.error.includes('TIMEOUT')) {
        console.log(`  -> Paket TCP ke port ${configuredPort} di-drop oleh MikroTik.`);
        console.log(`  -> Solusi MikroTik Terminal:`);
        console.log(`     /ip service set api port=${configuredPort} disabled=no address=""`);
        console.log(`     /ip firewall filter add chain=input action=accept protocol=tcp dst-port=${configuredPort} comment="Allow EugineBill API" place-before=0`);
      } else if (tcpResult.error.includes('ECONNREFUSED')) {
        console.log(`  -> Port ${configuredPort} ditolak (Closed / Refused). Service API MikroTik tidak aktif di port ini.`);
        console.log(`  -> Solusi MikroTik Terminal:`);
        console.log(`     /ip service set api port=${configuredPort} disabled=no`);
      }
      console.log(``);
      continue;
    }

    console.log(`  [OK] TCP Port ${configuredPort} TERBUKA dan merespon dalam ${tcpResult.latency}ms!`);

    // STEP 2: RouterOS API Authentication Test
    console.log(`\n[STEP 2] Melakukan login RouterOS API ke ${configuredHost}:${configuredPort} (user: ${user})...`);
    const api = new RouterOSAPI({
      host: configuredHost,
      port: configuredPort,
      user,
      password: pass,
      timeout: 5,
      tls: configuredPort === 8729,
    });

    try {
      await api.connect();
      console.log(`  [OK] Login RouterOS API BERHASIL!`);

      // STEP 3: Identity & Resource
      console.log(`\n[STEP 3] Mengambil informasi sistem MikroTik...`);
      const identity = await api.write('/system/identity/print');
      const resource = await api.write('/system/resource/print');
      const routerName = identity[0]?.name || 'Unknown';
      const version = resource[0]?.version || 'Unknown';
      const uptime = resource[0]?.uptime || 'Unknown';
      const board = resource[0]?.['board-name'] || resource[0]?.boardName || 'Unknown';

      console.log(`  - Router Identity : ${routerName}`);
      console.log(`  - RouterOS Version: ${version}`);
      console.log(`  - Hardware Board  : ${board}`);
      console.log(`  - Uptime          : ${uptime}`);

      // STEP 4: Test PPP Secret Read
      console.log(`\n[STEP 4] Menguji query /ppp/secret/print...`);
      const secrets = await api.write('/ppp/secret/print');
      console.log(`  [OK] Berhasil membaca /ppp/secret! Total secret di router: ${secrets.length}`);

      // STEP 5: Test PPP Profiles
      console.log(`\n[STEP 5] Menguji query /ppp/profile/print...`);
      const profiles = await api.write('/ppp/profile/print');
      console.log(`  [OK] Berhasil membaca /ppp/profile! Total profil di router: ${profiles.length}`);
      console.log(`  Daftar profil: ${profiles.map(p => p.name).join(', ')}`);

      console.log(`\n==================================================`);
      console.log(`STATUS: SEMUA TES BERHASIL 100%!`);
      console.log(`Billing EugineBill siap membaca dan menulis ke router ${router.name}!`);
      console.log(`==================================================\n`);

      await api.close();
    } catch (apiErr) {
      console.error(`  [GAGAL LOGIN API] ${apiErr.message || apiErr}`);
      console.log(`\n  DIAGNOSA:`);
      console.log(`  -> Username '${user}' atau password di database tidak cocok dengan MikroTik.`);
      console.log(`  -> Solusi MikroTik Terminal:`);
      console.log(`     /user add name="${user}" group=full password="${pass}" comment="EugineBill API User"`);
      console.log(`     (atau jika user sudah ada: /user set [find name="${user}"] password="${pass}" group=full)`);
      console.log(``);
      try { await api.close(); } catch {}
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
