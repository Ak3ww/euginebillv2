import { prisma } from '../src/server/db/client';

async function main() {
  console.log('[sync-router-vpn-ports] Starting router port auto-synchronization...');
  const routers = await prisma.router.findMany({
    where: { vpnClientId: { not: null } },
    include: { vpnClient: true },
  });

  let syncedCount = 0;
  for (const r of routers) {
    const vpnApiTarget = (r.vpnClient?.publicPorts as any)?.services?.api?.target;
    if (vpnApiTarget && r.port !== vpnApiTarget) {
      console.log(`[sync-router-vpn-ports] Updating router '${r.name}' API port: ${r.port} -> ${vpnApiTarget}`);
      await prisma.router.update({
        where: { id: r.id },
        data: { port: vpnApiTarget },
      });
      syncedCount++;
    }
  }

  console.log(`[sync-router-vpn-ports] Completed. ${syncedCount} router(s) synchronized.`);
}

main()
  .catch((e) => {
    console.error('[sync-router-vpn-ports] Error:', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });

