'use strict';
const http = require('http');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { RouterOSAPI } = require('node-routeros');

async function main() {
  const ontIp = '192.168.20.113';
  const proxyPort = 24000;
  const targetPort = 80;

  const router = await prisma.router.findFirst({
    where: { isActive: true, ipAddress: { not: '' } },
  });

  if (!router) return;
  const mikrotikVpnIp = router.ipAddress;

  console.log(`=== STARTING FULL HTTP REVERSE PROXY FOR ZTE ONT (${ontIp}) ===\n`);

  // 1. Install NAT rules on MikroTik
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

    // Clean old NAT rules
    const nats = await api.write('/ip/firewall/nat/print').catch(() => []);
    for (const r of nats) {
      if (String(r['dst-port']) === String(proxyPort) || r.comment?.includes('ont-proxy-test')) {
        if (r['.id']) await api.write('/ip/firewall/nat/remove', [`=.id=${r['.id']}`]).catch(() => {});
      }
    }

    // Add DSTNAT
    await api.write('/ip/firewall/nat/add', [
      '=chain=dstnat',
      '=protocol=tcp',
      `=dst-port=${proxyPort}`,
      `=to-addresses=${ontIp}`,
      `=to-ports=${targetPort}`,
      '=action=dst-nat',
      '=comment=ont-proxy-test dstnat',
    ]);

    // Add SRCNAT masquerade
    await api.write('/ip/firewall/nat/add', [
      '=chain=srcnat',
      '=protocol=tcp',
      `=dst-address=${ontIp}`,
      '=action=masquerade',
      '=comment=ont-proxy-test srcnat',
    ]);

    console.log('[2] MikroTik DSTNAT & SRCNAT installed');
  } catch (e) {
    console.error('MikroTik setup error:', e.message);
  } finally {
    try { api.close(); } catch (_) {}
  }

  // 2. Start HTTP Reverse Proxy on 0.0.0.0:24000
  const server = http.createServer((req, res) => {
    const clientIp = req.socket.remoteAddress;
    console.log(`[HTTP PROXY] ${req.method} ${req.url} from ${clientIp}`);

    // Auto-redirect root path / to ZTE login page if requested
    if (req.url === '/' || req.url === '') {
      console.log('  -> Auto-redirecting root / to /getpage.gch?pid=1002');
      res.writeHead(302, {
        'Location': '/getpage.gch?pid=1002',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      });
      res.end();
      return;
    }

    // Clean headers for ZTE thttpd compatibility
    const cleanHeaders = { ...req.headers };
    cleanHeaders['host'] = ontIp;
    cleanHeaders['connection'] = 'close';
    if (cleanHeaders['referer']) {
      cleanHeaders['referer'] = `http://${ontIp}/`;
    }
    if (cleanHeaders['origin']) {
      cleanHeaders['origin'] = `http://${ontIp}`;
    }

    // Strip modern browser headers that overflow thttpd
    delete cleanHeaders['sec-fetch-mode'];
    delete cleanHeaders['sec-fetch-site'];
    delete cleanHeaders['sec-fetch-dest'];
    delete cleanHeaders['sec-fetch-user'];
    delete cleanHeaders['sec-ch-ua'];
    delete cleanHeaders['sec-ch-ua-mobile'];
    delete cleanHeaders['sec-ch-ua-platform'];
    delete cleanHeaders['upgrade-insecure-requests'];

    const options = {
      hostname: mikrotikVpnIp,
      port: proxyPort,
      path: req.url,
      method: req.method,
      headers: cleanHeaders,
      timeout: 10000,
    };

    const proxyReq = http.request(options, (proxyRes) => {
      console.log(`  <- ONT Response: ${proxyRes.statusCode} for ${req.url}`);

      const responseHeaders = { ...proxyRes.headers };

      // Rewrite Location header in redirects from ONT
      if (responseHeaders['location']) {
        const originalLoc = responseHeaders['location'];
        responseHeaders['location'] = originalLoc.replace(/https?:\/\/[^\/]+/i, '');
        console.log(`  -> Rewrote Location: ${originalLoc} -> ${responseHeaders['location']}`);
      }

      res.writeHead(proxyRes.statusCode || 200, responseHeaders);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.error(`  [PROXY ERROR] ${req.url}:`, err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain' });
        res.end(`Bad Gateway: Failed to connect to ONT (${err.message})`);
      }
    });

    req.pipe(proxyReq);
  });

  server.listen(proxyPort, '0.0.0.0', () => {
    console.log(`\n======================================================`);
    console.log(`HTTP PROXY BERJALAN PADA: http://43.173.14.236:${proxyPort}/`);
    console.log(`Silakan buka URL tersebut di browser sekarang!`);
    console.log(`Tekan Ctrl+C untuk berhenti.`);
    console.log(`======================================================\n`);
  });
}

main().catch(console.error);
