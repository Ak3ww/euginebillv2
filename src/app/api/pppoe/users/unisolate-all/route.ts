import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { logActivity } from '@/server/services/activity-log.service';
import { RouterOSAPI } from 'node-routeros';

export const dynamic = 'force-dynamic';

// Tanggal target: 6 September 2026 pukul 23:59:59 WIB (disimpan di Prisma UTC)
const TARGET_DATE = new Date('2026-09-06T23:59:59.999Z');

async function connectToMikroTik(router: any, timeoutMs = 8000) {
  const host = router.ipAddress && router.ipAddress !== router.nasname ? router.ipAddress : (router.ipAddress || router.nasname);
  const port = router.port || 8728;
  const tls = port === 8729;

  const conn = new RouterOSAPI({
    host,
    user: router.username,
    password: router.password,
    port,
    timeout: 8,
    ...(tls ? { tls: { rejectUnauthorized: false } } : {})
  });

  const connectPromise = conn.connect();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timeout koneksi ${timeoutMs / 1000}s ke MikroTik ${host}:${port}`)), timeoutMs)
  );

  await Promise.race([connectPromise, timeoutPromise]);
  return conn;
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Dapatkan Pengaturan Company & Update fixedBillingDate = 6
    const company = await prisma.company.findFirst();
    const isRadiusEnabled = company?.radiusEnabled ?? false;

    await prisma.company.updateMany({
      data: { fixedBillingDate: 6 }
    });

    // 2. Ambil Semua Pelanggan Berstatus 'isolated'
    const isolatedUsers = await prisma.pppoeUser.findMany({
      where: { status: 'isolated' },
      include: {
        profile: { select: { id: true, name: true, groupName: true, mikrotikProfileName: true } },
        router: { select: { id: true, name: true, ipAddress: true, username: true, password: true, port: true, nasname: true } },
      }
    });

    let mikrotikSuccess = 0;
    let mikrotikFailed = 0;

    if (isolatedUsers.length > 0) {
      // Kelompokkan user per router untuk optimasi koneksi TCP
      const usersByRouter = new Map<string, { router: any; users: typeof isolatedUsers }>();

      for (const u of isolatedUsers) {
        if (u.router) {
          const rid = u.router.id;
          if (!usersByRouter.has(rid)) {
            usersByRouter.set(rid, { router: u.router, users: [] });
          }
          usersByRouter.get(rid)!.users.push(u);
        }
      }

      // Sinkronisasi MikroTik
      for (const [routerId, { router, users }] of usersByRouter.entries()) {
        let conn: any = null;
        try {
          conn = await connectToMikroTik(router);

          const secrets = await conn.write('/ppp/secret/print') || [];
          const activeSessions = await conn.write('/ppp/active/print') || [];
          const addressListEntries = await conn.write('/ip/firewall/address-list/print', ['?list=isolir']) || [];

          const activeMap = new Map<string, any>();
          for (const s of activeSessions) {
            if (s.name) activeMap.set(s.name, s);
          }

          const secretMap = new Map<string, any>();
          for (const s of secrets) {
            if (s.name) secretMap.set(s.name, s);
          }

          for (const user of users) {
            const normalProfile = user.profile?.mikrotikProfileName || user.profile?.name || user.profile?.groupName || 'default';
            try {
              // Pulihkan Secret
              const existingSecret = secretMap.get(user.username);
              if (existingSecret && existingSecret['.id']) {
                await conn.write('/ppp/secret/set', [
                  `=.id=${existingSecret['.id']}`,
                  `=disabled=no`,
                  `=profile=${normalProfile}`
                ]);
              }

              // Kick Sesi Aktif
              const activeSess = activeMap.get(user.username);
              if (activeSess && activeSess['.id']) {
                await conn.write('/ppp/active/remove', [`=.id=${activeSess['.id']}`]);
              }

              // Bersihkan Address-List Isolir
              const userActiveIp = activeSess?.address || user.ipAddress;
              for (const entry of addressListEntries) {
                const matchIp = userActiveIp && entry.address === userActiveIp;
                const matchComment = entry.comment && entry.comment.includes(user.username);
                if ((matchIp || matchComment) && entry['.id']) {
                  await conn.write('/ip/firewall/address-list/remove', [`=.id=${entry['.id']}`]);
                }
              }

              mikrotikSuccess++;
            } catch (err) {
              mikrotikFailed++;
              console.error(`[Unisolate-All] Error MikroTik for ${user.username}:`, err);
            }
          }

          try { await conn.close(); } catch {}
        } catch (routerErr) {
          console.error(`[Unisolate-All] Cannot connect to router ${router.ipAddress}:`, routerErr);
          mikrotikFailed += users.length;
        }
      }

      // Sinkronisasi FreeRADIUS jika mode RADIUS aktif
      if (isRadiusEnabled) {
        for (const user of isolatedUsers) {
          try {
            const normalGroup = user.profile?.groupName || 'default';
            await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'Auth-Type' } });
            await prisma.radcheck.deleteMany({ where: { username: user.username, attribute: 'NAS-IP-Address' } });
            await prisma.radreply.deleteMany({ where: { username: user.username, attribute: 'Reply-Message' } });

            await prisma.$executeRaw`
              INSERT INTO radcheck (username, attribute, op, value)
              VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
              ON DUPLICATE KEY UPDATE value = ${user.password}
            `;

            await prisma.$executeRaw`DELETE FROM radusergroup WHERE username = ${user.username}`;
            await prisma.$executeRaw`
              INSERT INTO radusergroup (username, groupname, priority)
              VALUES (${user.username}, ${normalGroup}, 1)
            `;

            if (user.ipAddress) {
              await prisma.$executeRaw`
                INSERT INTO radreply (username, attribute, op, value)
                VALUES (${user.username}, 'Framed-IP-Address', ':=', ${user.ipAddress})
                ON DUPLICATE KEY UPDATE value = ${user.ipAddress}
              `;
            }

            await prisma.$executeRaw`
              UPDATE radacct 
              SET acctstoptime = NOW(), acctterminatecause = 'Admin-Reset'
              WHERE username = ${user.username} AND acctstoptime IS NULL
            `;
          } catch (radErr) {
            console.error(`[Unisolate-All] RADIUS sync error for ${user.username}:`, radErr);
          }
        }
      }

      // Update status database untuk seluruh pelanggan terisolir
      const unisolatedIds = isolatedUsers.map(u => u.id);
      await prisma.pppoeUser.updateMany({
        where: { id: { in: unisolatedIds } },
        data: {
          status: 'active',
          billingDay: 6,
          billingCycleDay: 6,
          expiredAt: TARGET_DATE,
        }
      });
    }

    // 3. Update Tanggal Isolir & Billing Day Pelanggan Lainnya
    const alignResult = await prisma.pppoeUser.updateMany({
      where: {
        status: { notIn: ['stop', 'blocked'] },
        OR: [
          { expiredAt: null },
          { expiredAt: { lte: TARGET_DATE } },
        ]
      },
      data: {
        billingDay: 6,
        billingCycleDay: 6,
        expiredAt: TARGET_DATE,
      }
    });

    // Update siklus billingDay = 6 untuk pelanggan yang sudah bayar bulan berikutnya
    await prisma.pppoeUser.updateMany({
      where: {
        status: { notIn: ['stop', 'blocked'] },
        expiredAt: { gt: TARGET_DATE },
      },
      data: {
        billingDay: 6,
        billingCycleDay: 6,
      }
    });

    // 4. Update Tagihan Invoice Belum Lunas September 2026
    const startOfSept = new Date('2026-09-01T00:00:00.000Z');
    const endOfSept = new Date('2026-09-30T23:59:59.999Z');

    const invResult = await prisma.invoice.updateMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        OR: [
          { dueDate: { gte: startOfSept, lte: endOfSept } },
          { dueDate: { lt: startOfSept } },
        ]
      },
      data: {
        dueDate: TARGET_DATE,
        status: 'PENDING',
      }
    });

    // Catat Activity Log
    await logActivity({
      username: session.user?.email || 'admin',
      userRole: session.user?.role || 'admin',
      action: 'unisolate_all',
      description: `Bulk un-isolated ${isolatedUsers.length} users and set billing/isolation date to 6 September 2026`,
      module: 'pppoe',
      status: 'success',
      metadata: {
        unisolatedCount: isolatedUsers.length,
        alignedUsersCount: alignResult.count,
        updatedInvoicesCount: invResult.count,
        mikrotikSuccess,
        mikrotikFailed,
        targetDueDate: TARGET_DATE.toISOString(),
      },
      request: request as any,
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil membuka isolir ${isolatedUsers.length} pelanggan dan menyelaraskan tanggal isolir ke 6 September 2026.`,
      data: {
        unisolatedCount: isolatedUsers.length,
        alignedUsersCount: alignResult.count,
        updatedInvoicesCount: invResult.count,
        mikrotikSuccess,
        mikrotikFailed,
        targetDate: TARGET_DATE.toISOString(),
        fixedBillingDate: 6,
      }
    });

  } catch (error: any) {
    console.error('[Unisolate-All] Fatal error:', error);
    return NextResponse.json(
      { error: error?.message || 'Gagal menjalankan proses un-isolir massal' },
      { status: 500 }
    );
  }
}
