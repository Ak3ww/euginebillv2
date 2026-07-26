import { PrismaClient } from '@prisma/client';
import { MikroTikConnection } from '../src/server/services/mikrotik/client';

const prisma = new PrismaClient();

async function printMikrotikCiteureupConfig() {
  console.log('🔍 MENGAMBIL INFORMASI DARI DATABASE & TERHUBUNG KE MIKROTIK CITEUREUP...\n');

  try {
    // 1. Get Routers & OLTs
    const routers = await prisma.router.findMany();
    const olts = await prisma.networkOLT.findMany();

    const citeureupRouter = routers.find(r => r.name.toLowerCase().includes('citeureup'));

    if (!citeureupRouter) {
      console.log('❌ Router Citeureup tidak ditemukan di database.');
      return;
    }

    console.log(`==================================================`);
    console.log(`📡 ROUTER CITEUREUP IN DATABASE:`);
    console.log(`   ID: ${citeureupRouter.id}`);
    console.log(`   Name: ${citeureupRouter.name}`);
    console.log(`   IP/Host: ${citeureupRouter.ipAddress}:${citeureupRouter.port || 8728}`);
    console.log(`   NAS Name: ${citeureupRouter.nasname}`);
    console.log(`==================================================\n`);

    const citeureupOlts = olts.filter(o => o.routerId === citeureupRouter.id);
    console.log(`⚡ OLT REGISTERED FOR CITEUREUP (${citeureupOlts.length} OLT):`);
    citeureupOlts.forEach(o => console.log(`   - ${o.name} | Host: ${o.ipAddress} | Brand: ${o.brand}`));
    console.log('\n');

    // 2. Connect via RouterOS API to Citeureup Router
    console.log(`🔌 Menghubungkan langsung ke RouterOS API Citeureup (${citeureupRouter.ipAddress}:${citeureupRouter.port || 8728})...\n`);

    const conn = new MikroTikConnection({
      host: citeureupRouter.ipAddress,
      username: citeureupRouter.username,
      password: citeureupRouter.password,
      port: citeureupRouter.port || 8728,
      tls: false,
    });

    await conn.connect();
    console.log('✅ BERHASIL TERHUBUNG KE MIKROTIK CITEUREUP!\n');

    // 3. Fetch Configuration
    console.log('=== 1. INTERFACES ===');
    const interfaces = await conn.execute('/interface/print');
    interfaces.forEach((item: any) => console.log(`  - [${item.name}] type=${item.type} running=${item.running} disabled=${item.disabled}`));

    console.log('\n=== 2. VLAN INTERFACES ===');
    const vlans = await conn.execute('/interface/vlan/print');
    if (vlans.length === 0) console.log('  (Tidak ada VLAN)');
    vlans.forEach((v: any) => console.log(`  - Name: ${v.name} | VLAN-ID: ${v['vlan-id']} | Interface: ${v.interface}`));

    console.log('\n=== 3. BRIDGES ===');
    const bridges = await conn.execute('/interface/bridge/print');
    bridges.forEach((b: any) => console.log(`  - Name: ${b.name}`));

    console.log('\n=== 4. BRIDGE PORTS ===');
    const bridgePorts = await conn.execute('/interface/bridge/port/print');
    bridgePorts.forEach((bp: any) => console.log(`  - Bridge: ${bp.bridge} <== Interface: ${bp.interface}`));

    console.log('\n=== 5. IP ADDRESSES ===');
    const ipAddresses = await conn.execute('/ip/address/print');
    ipAddresses.forEach((ip: any) => console.log(`  - Address: ${ip.address} | Interface: ${ip.interface} | Network: ${ip.network}`));

    console.log('\n=== 6. IP POOLS ===');
    const pools = await conn.execute('/ip/pool/print');
    pools.forEach((p: any) => console.log(`  - Pool Name: ${p.name} | Ranges: ${p.ranges}`));

    console.log('\n=== 7. DHCP SERVERS ===');
    const dhcpServers = await conn.execute('/ip/dhcp-server/print');
    dhcpServers.forEach((ds: any) => console.log(`  - Name: ${ds.name} | Interface: ${ds.interface} | Address-Pool: ${ds['address-pool']}`));

    console.log('\n=== 8. DHCP SERVER NETWORKS ===');
    const dhcpNetworks = await conn.execute('/ip/dhcp-server/network/print');
    dhcpNetworks.forEach((dn: any) => console.log(`  - Address: ${dn.address} | Gateway: ${dn.gateway} | DNS: ${dn['dns-server'] || '-'}`));

    console.log('\n=== 9. FIREWALL NAT RULES ===');
    const natRules = await conn.execute('/ip/firewall/nat/print');
    natRules.forEach((n: any) => console.log(`  - Chain: ${n.chain} | Src-Addr: ${n['src-address'] || 'any'} | Dst-Addr: ${n['dst-address'] || 'any'} | Action: ${n.action} | Comment: ${n.comment || '-'}`));

  } catch (error) {
    console.error('❌ Error fetching Mikrotik Citeureup config:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

printMikrotikCiteureupConfig();
