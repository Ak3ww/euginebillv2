const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');

const prisma = new PrismaClient();

const L2TP_SCRIPT = `
:do {/interface l2tp-client remove [find comment="ultravpn-894da29623084bd1801683b3277ddfe3"]} on-error={}
:do {/interface l2tp-client remove [find name="uvl2-894da2962308"]} on-error={}
:do {/interface l2tp-client remove [find name="l2tp-ultravpn-894da29623084bd1801683b3277ddfe3"]} on-error={}
:if ([:len [/ppp profile find name="uvpn-remote"]] = 0) do={/ppp profile add name=uvpn-remote use-encryption=no change-tcp-mss=yes only-one=no}
/interface l2tp-client add name=uvl2-894da2962308 connect-to=vpn.billinghub.id user=894DA29623084BD1801683B3277DDFE3 password="ccge258LAzVwRjFD" profile=uvpn-remote use-ipsec=no allow=chap,mschap2 disabled=no add-default-route=no dial-on-demand=no comment=ultravpn-894da29623084bd1801683b3277ddfe3
`;

async function main() {
  console.log('====================================================');
  console.log('  PUSH L2TP SCRIPT TO MIKROTIK CITEUREUP VIA API');
  console.log('====================================================\n');

  try {
    // 1. Find Router or VPN Client for Citeureup
    const routers = await prisma.router.findMany({
      include: { vpnClient: true },
    });

    const vpnClients = await prisma.vpnClient.findMany();

    console.log(`Found ${routers.length} router(s) and ${vpnClients.length} VPN client(s) in DB.`);

    // Find Citeureup router
    let targetRouter = routers.find(r => 
      r.name.toLowerCase().includes('citeureup') || 
      r.name.toLowerCase().includes('ctp') ||
      r.ipAddress === '10.201.0.15'
    );

    // Find Citeureup vpnClient
    let targetVpnClient = vpnClients.find(v => 
      v.name.toLowerCase().includes('citeureup') || 
      v.name.toLowerCase().includes('ctp') ||
      v.vpnIp === '10.201.0.15'
    );

    let host = '';
    let port = 8728;
    let user = '';
    let password = '';
    let label = '';

    if (targetRouter) {
      label = `Router: ${targetRouter.name}`;
      host = targetRouter.ipAddress;
      port = targetRouter.port || 8728;
      user = targetRouter.username;
      password = targetRouter.password;

      // If router is linked to a vpnClient, prefer the vpnClient IP/credentials if router IP is default
      if (targetRouter.vpnClient) {
        console.log(`Router has linked vpnClient: ${targetRouter.vpnClient.name} (${targetRouter.vpnClient.vpnIp})`);
        if (targetRouter.vpnClient.vpnIp) host = targetRouter.vpnClient.vpnIp;
        if (targetRouter.vpnClient.apiUsername) user = targetRouter.vpnClient.apiUsername;
        if (targetRouter.vpnClient.apiPassword) password = targetRouter.vpnClient.apiPassword;
      }
    } else if (targetVpnClient) {
      label = `VPN Client: ${targetVpnClient.name}`;
      host = targetVpnClient.vpnIp;
      port = 8728;
      user = targetVpnClient.apiUsername || targetVpnClient.username || 'admin';
      password = targetVpnClient.apiPassword || targetVpnClient.password;
    } else {
      console.log('Available routers:');
      routers.forEach(r => console.log(`  - [Router] ${r.name} | Host: ${r.ipAddress}:${r.port} | User: ${r.username}`));
      console.log('Available VPN clients:');
      vpnClients.forEach(v => console.log(`  - [VpnClient] ${v.name} | VPN IP: ${v.vpnIp} | User: ${v.apiUsername || v.username}`));

      // Check if there is only 1 non-cibinong router
      const nonCibRouter = routers.find(r => !r.name.toLowerCase().includes('cibinong') && !r.name.toLowerCase().includes('cib'));
      if (nonCibRouter) {
        console.log(`\nUsing secondary router: ${nonCibRouter.name}`);
        label = `Router: ${nonCibRouter.name}`;
        host = nonCibRouter.ipAddress;
        port = nonCibRouter.port || 8728;
        user = nonCibRouter.username;
        password = nonCibRouter.password;
      } else {
        throw new Error('Router or VPN Client for Citeureup could not be uniquely identified in DB.');
      }
    }

    console.log(`\nConnecting to target [${label}] at ${host}:${port} with user "${user}"...`);

    const api = new RouterOSAPI({
      host,
      port,
      user,
      password,
      timeout: 15,
    });

    await api.connect();
    console.log(`Connected successfully to MikroTik!`);

    // Verify identity
    const identity = await api.write('/system/identity/print');
    console.log(`Router Identity: ${identity[0]?.name || 'Unknown'}\n`);

    // Execute via /system/script to ensure 100% native RouterOS script execution
    const scriptName = `tmp_l2tp_setup_${Date.now()}`;
    console.log(`1. Uploading temporary script "${scriptName}"...`);
    await api.write([
      '/system/script/add',
      `=name=${scriptName}`,
      `=source=${L2TP_SCRIPT.trim()}`,
      '=policy=ftp,reboot,read,write,policy,test,password,sniff,sensitive,romon',
    ]);
    console.log('   Script created successfully.');

    console.log('2. Executing script on MikroTik...');
    await api.write([
      '/system/script/run',
      `=number=${scriptName}`,
    ]);
    console.log('   Script executed successfully.');

    console.log('3. Cleaning up temporary script...');
    const allScripts = await api.write('/system/script/print');
    const createdScript = allScripts.find(s => s.name === scriptName);
    if (createdScript) {
      await api.write([
        '/system/script/remove',
        `=.id=${createdScript['.id']}`,
      ]);
      console.log('   Temporary script removed.');
    }

    // 4. Verify created L2TP client interface
    console.log('\n4. Verifying /interface/l2tp-client on MikroTik...');
    const l2tpClients = await api.write('/interface/l2tp-client/print');
    const targetL2tp = l2tpClients.find(i => i.name === 'uvl2-894da2962308' || i.comment?.includes('ultravpn-894da29623084bd1801683b3277ddfe3'));

    if (targetL2tp) {
      console.log('SUCCESS! L2TP Client interface found:');
      console.log(`  - Name: ${targetL2tp.name}`);
      console.log(`  - Connect To: ${targetL2tp['connect-to']}`);
      console.log(`  - User: ${targetL2tp.user}`);
      console.log(`  - Profile: ${targetL2tp.profile}`);
      console.log(`  - Running: ${targetL2tp.running}`);
      console.log(`  - Disabled: ${targetL2tp.disabled}`);
      console.log(`  - Comment: ${targetL2tp.comment}`);
    } else {
      console.log('WARNING: L2TP Client interface uvl2-894da2962308 was not found in /interface/l2tp-client/print.');
    }

    await api.close();
    console.log('\n====================================================');
    console.log('  ALL DONE! L2TP SCRIPT SUCCESSFULLY PUSHED.');
    console.log('====================================================\n');

  } catch (err) {
    console.error('\nFAILED to push script:', err.message || err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
