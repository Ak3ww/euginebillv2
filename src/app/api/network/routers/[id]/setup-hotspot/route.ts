import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { MikroTikConnection } from '@/server/services/mikrotik/client';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routerId } = await params;
    const body = await request.json().catch(() => ({}));

    // Get router details
    const router = await prisma.router.findUnique({
      where: { id: routerId },
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    // Company settings
    const company = await prisma.company.findFirst({
      select: { radiusHotspotEnabled: true, radiusEnabled: true },
    });
    const useRadiusHotspot = company?.radiusHotspotEnabled ?? false;

    // Configurable parameters with smart defaults
    const vlanId = parseInt(body.vlanId || '10');
    const parentInterface = body.parentInterface || 'bridge-LAN';
    const vlanInterface = body.vlanInterface || `vlan${vlanId}-hotspot`;
    const hotspotAddress = body.hotspotAddress || '10.50.10.1';
    const hotspotSubnet = body.hotspotSubnet || '10.50.10.0/24';
    const poolRange = body.poolRange || '10.50.10.10-10.50.10.250';
    const dnsName = body.dnsName || 'wifi.euginemediagroup.com';
    const serverName = body.serverName || `hotspot-vlan${vlanId}`;
    const profileName = body.profileName || `hsprof-${vlanId}`;
    const poolName = `hs-pool-${vlanId}`;
    const dhcpServerName = `dhcp-hs${vlanId}`;
    const applyToRouter = Boolean(body.applyToRouter);

    // Build RouterOS scripts
    const buildScript = (rosVersion: 6 | 7) => `
# ============================================
# EugineBill Hotspot Setup Script (RouterOS ${rosVersion}.x)
# Router: ${router.name}
# VLAN: ${vlanId} (${vlanInterface} on ${parentInterface})
# Subnet: ${hotspotSubnet} (Gateway: ${hotspotAddress})
# Pool: ${poolRange}
# DNS Name: ${dnsName}
# RADIUS Mode: ${useRadiusHotspot ? 'YES (FreeRADIUS)' : 'NO (MikroTik Local Auth)'}
# Generated: ${new Date().toISOString()}
# ============================================

# 1. Buat VLAN Interface untuk Hotspot
:if ([:len [/interface vlan find name="${vlanInterface}"]] = 0) do={
    /interface vlan add name=${vlanInterface} vlan-id=${vlanId} interface=${parentInterface} comment="EugineBill Hotspot VLAN ${vlanId}"
}

# 2. Set IP Address Gateway pada VLAN Interface
:if ([:len [/ip address find interface="${vlanInterface}"]] = 0) do={
    /ip address add address=${hotspotAddress}/24 interface=${vlanInterface} comment="EugineBill Hotspot Gateway"
}

# 3. Buat IP Pool untuk Hotspot
:if ([:len [/ip pool find name="${poolName}"]] = 0) do={
    /ip pool add name=${poolName} ranges=${poolRange} comment="EugineBill Hotspot Pool"
}

# 4. Buat DHCP Server & DHCP Network
:if ([:len [/ip dhcp-server find name="${dhcpServerName}"]] = 0) do={
    /ip dhcp-server add name=${dhcpServerName} interface=${vlanInterface} address-pool=${poolName} lease-time=1h disabled=no comment="EugineBill Hotspot DHCP"
}
:if ([:len [/ip dhcp-server network find address="${hotspotSubnet}"]] = 0) do={
    /ip dhcp-server network add address=${hotspotSubnet} gateway=${hotspotAddress} dns-server=${hotspotAddress},1.1.1.1,8.8.8.8 domain=${dnsName} comment="EugineBill Hotspot Network"
}

# 5. Buat Hotspot Server Profile
:if ([:len [/ip hotspot profile find name="${profileName}"]] = 0) do={
    /ip hotspot profile add name=${profileName} hotspot-address=${hotspotAddress} dns-name="${dnsName}" login-by=http-chap,http-pap use-radius=${useRadiusHotspot ? 'yes' : 'no'} comment="EugineBill Hotspot Profile"
} else={
    /ip hotspot profile set [find name="${profileName}"] dns-name="${dnsName}" hotspot-address=${hotspotAddress} login-by=http-chap,http-pap use-radius=${useRadiusHotspot ? 'yes' : 'no'}
}

# 6. Buat Hotspot Server
:if ([:len [/ip hotspot find name="${serverName}"]] = 0) do={
    /ip hotspot add name=${serverName} interface=${vlanInterface} address-pool=${poolName} profile=${profileName} disabled=no comment="EugineBill Hotspot Server"
}

# 7. Firewall NAT Masquerade
:if ([:len [/ip firewall nat find src-address="${hotspotSubnet}" action=masquerade]] = 0) do={
    /ip firewall nat add chain=srcnat src-address=${hotspotSubnet} action=masquerade comment="EugineBill Hotspot NAT"
}

# 8. Walled Garden (Billing & Payment Gateways)
/ip hotspot walled-garden remove [find where comment~"EugineBill"]
/ip hotspot walled-garden add dst-host="*.euginemediagroup.com" action=allow comment="EugineBill Billing Domain"
/ip hotspot walled-garden add dst-host="euginemediagroup.com" action=allow comment="EugineBill Billing Root"
/ip hotspot walled-garden add dst-host="*.midtrans.com" action=allow comment="EugineBill Midtrans Payment"
/ip hotspot walled-garden add dst-host="*.xendit.co" action=allow comment="EugineBill Xendit Payment"
/ip hotspot walled-garden add dst-host="*.tripay.co.id" action=allow comment="EugineBill Tripay Payment"
/ip hotspot walled-garden add dst-host="*.duitku.com" action=allow comment="EugineBill Duitku Payment"

# ============================================
# SELESAI! Verifikasi:
# /ip hotspot print
# /ip hotspot profile print where name="${profileName}"
# /ip dhcp-server lease print where server="${dhcpServerName}"
# ============================================
`.trim();

    const scriptRos6 = buildScript(6);
    const scriptRos7 = buildScript(7);

    // If applyToRouter is requested, execute directly via MikroTik API
    let applied = false;
    let applyError: string | null = null;

    if (applyToRouter) {
      const apiPort = router.port || 8728;
      const conn = new MikroTikConnection({
        host: router.ipAddress,
        username: router.username,
        password: router.password,
        port: apiPort,
        tls: false,
        timeout: 15000,
      });

      try {
        await conn.connect();

        // 1. VLAN
        const vlans = await conn.execute('/interface/vlan/print', [`?name=${vlanInterface}`]);
        if (!vlans.length) {
          await conn.execute('/interface/vlan/add', [
            `=name=${vlanInterface}`,
            `=vlan-id=${vlanId}`,
            `=interface=${parentInterface}`,
            `=comment=EugineBill Hotspot VLAN ${vlanId}`,
          ]);
        }

        // 2. IP Address
        const addrs = await conn.execute('/ip/address/print', [`?interface=${vlanInterface}`]);
        if (!addrs.length) {
          await conn.execute('/ip/address/add', [
            `=address=${hotspotAddress}/24`,
            `=interface=${vlanInterface}`,
            `=comment=EugineBill Hotspot Gateway`,
          ]);
        }

        // 3. IP Pool
        const pools = await conn.execute('/ip/pool/print', [`?name=${poolName}`]);
        if (!pools.length) {
          await conn.execute('/ip/pool/add', [
            `=name=${poolName}`,
            `=ranges=${poolRange}`,
            `=comment=EugineBill Hotspot Pool`,
          ]);
        }

        // 4. DHCP Server & Network
        const dhcps = await conn.execute('/ip/dhcp-server/print', [`?name=${dhcpServerName}`]);
        if (!dhcps.length) {
          await conn.execute('/ip/dhcp-server/add', [
            `=name=${dhcpServerName}`,
            `=interface=${vlanInterface}`,
            `=address-pool=${poolName}`,
            `=lease-time=1h`,
            `=disabled=no`,
            `=comment=EugineBill Hotspot DHCP`,
          ]);
        }
        const dhcpNets = await conn.execute('/ip/dhcp-server/network/print', [`?address=${hotspotSubnet}`]);
        if (!dhcpNets.length) {
          await conn.execute('/ip/dhcp-server/network/add', [
            `=address=${hotspotSubnet}`,
            `=gateway=${hotspotAddress}`,
            `=dns-server=${hotspotAddress},1.1.1.1,8.8.8.8`,
            `=domain=${dnsName}`,
            `=comment=EugineBill Hotspot Network`,
          ]);
        }

        // 5. Hotspot Profile
        const profs = await conn.execute('/ip/hotspot/profile/print', [`?name=${profileName}`]);
        if (!profs.length) {
          await conn.execute('/ip/hotspot/profile/add', [
            `=name=${profileName}`,
            `=hotspot-address=${hotspotAddress}`,
            `=dns-name=${dnsName}`,
            `=login-by=http-chap,http-pap`,
            `=use-radius=${useRadiusHotspot ? 'yes' : 'no'}`,
            `=comment=EugineBill Hotspot Profile`,
          ]);
        } else {
          await conn.execute('/ip/hotspot/profile/set', [
            `=.id=${profs[0]['.id']}`,
            `=hotspot-address=${hotspotAddress}`,
            `=dns-name=${dnsName}`,
            `=login-by=http-chap,http-pap`,
            `=use-radius=${useRadiusHotspot ? 'yes' : 'no'}`,
          ]);
        }

        // 6. Hotspot Server
        const hsServers = await conn.execute('/ip/hotspot/print', [`?name=${serverName}`]);
        if (!hsServers.length) {
          await conn.execute('/ip/hotspot/add', [
            `=name=${serverName}`,
            `=interface=${vlanInterface}`,
            `=address-pool=${poolName}`,
            `=profile=${profileName}`,
            `=disabled=no`,
            `=comment=EugineBill Hotspot Server`,
          ]);
        }

        // 7. NAT Masquerade
        const nats = await conn.execute('/ip/firewall/nat/print', [
          `?chain=srcnat`,
          `?src-address=${hotspotSubnet}`,
          `?action=masquerade`,
        ]);
        if (!nats.length) {
          await conn.execute('/ip/firewall/nat/add', [
            `=chain=srcnat`,
            `=src-address=${hotspotSubnet}`,
            `=action=masquerade`,
            `=comment=EugineBill Hotspot NAT`,
          ]);
        }

        // 8. Walled Garden
        const wgDomains = [
          '*.euginemediagroup.com',
          'euginemediagroup.com',
          '*.midtrans.com',
          '*.xendit.co',
          '*.tripay.co.id',
          '*.duitku.com',
        ];
        for (const dom of wgDomains) {
          const existingWg = await conn.execute('/ip/hotspot/walled-garden/print', [`?dst-host=${dom}`]);
          if (!existingWg.length) {
            await conn.execute('/ip/hotspot/walled-garden/add', [
              `=dst-host=${dom}`,
              `=action=allow`,
              `=comment=EugineBill Walled Garden`,
            ]);
          }
        }

        // 9. Auto-Patch hotspot/login.html for QR Code Auto-Login
        try {
          const loginFiles = await conn.execute('/file/print', ['?name=hotspot/login.html']);
          if (loginFiles.length > 0) {
            const loginFileId = loginFiles[0]['.id'];
            const fileContents = await conn.execute('/file/get', [`=.id=${loginFileId}`, '=value-name=contents']);
            const currentContent = fileContents[0]?.ret || '';
            if (currentContent && (!currentContent.includes('URLSearchParams') || !currentContent.includes('p.get'))) {
              const autoLoginScript = `
    <script>
        (function() {
            try {
                var p = new URLSearchParams(window.location.search);
                var u = p.get('username') || p.get('code');
                var pass = p.get('password') || p.get('secret') || u;
                if (u && document.login) {
                    if (document.login.username) document.login.username.value = u;
                    if (document.login.password) document.login.password.value = pass;
                    setTimeout(function() {
                        if (typeof doLogin === 'function') {
                            doLogin();
                        } else {
                            document.login.submit();
                        }
                    }, 200);
                }
            } catch(e) {}
        })();
    </script>
</body>`;
              if (currentContent.includes('</body>')) {
                const patched = currentContent.replace('</body>', autoLoginScript);
                await conn.execute('/file/set', [`=.id=${loginFileId}`, `=contents=${patched}`]);
              }
            }
          }
        } catch (fileErr) {
          console.warn('Auto-patch login.html skipped or non-fatal:', fileErr);
        }

        await conn.disconnect();
        applied = true;
      } catch (err: any) {
        console.error('Failed to apply hotspot config directly to MikroTik:', err);
        try { await conn.disconnect(); } catch { /* ignore */ }
        applyError = err.message || 'Unknown connection error';
      }
    }

    return NextResponse.json({
      success: true,
      script: scriptRos7,
      scriptRos6,
      scriptRos7,
      applied,
      applyError,
      config: {
        vlanId,
        vlanInterface,
        parentInterface,
        hotspotAddress,
        hotspotSubnet,
        poolRange,
        dnsName,
        profileName,
        serverName,
        useRadiusHotspot,
      },
    });
  } catch (error: any) {
    console.error('Setup Hotspot error:', error);
    return NextResponse.json(
      { error: 'Failed to generate Hotspot setup script', details: error.message },
      { status: 500 }
    );
  }
}
