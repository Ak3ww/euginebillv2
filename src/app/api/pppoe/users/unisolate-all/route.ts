import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { logActivity } from '@/server/services/activity-log.service';
import { PPPSecretService } from '@/server/services/mikrotik/ppp-secret.service';

export const dynamic = 'force-dynamic';

// Tanggal target: 6 September 2026 pukul 23:59:59 WIB (disimpan di Prisma UTC)
const TARGET_DATE = new Date('2026-09-06T23:59:59.999Z');

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Dapatkan Pengaturan Company & Update fixedBillingDate = 6
    const company = await prisma.company.findFirst();
    const isRadiusEnabled = company?.radiusPppoeEnabled ?? false;

    await prisma.company.updateMany({
      data: { fixedBillingDate: 6 }
    });

    // 2. Ambil Semua Pelanggan Berstatus 'isolated'
    const isolatedUsers = await prisma.pppoeUser.findMany({
      where: { status: 'isolated' },
      include: {
        profile: { select: { id: true, name: true, groupName: true, mikrotikProfileName: true } },
        router: { include: { vpnClient: true } },
      }
    });

    let mikrotikSuccess = 0;
    let mikrotikFailed = 0;

    if (isolatedUsers.length > 0) {
      // Sinkronisasi MikroTik menggunakan PPPSecretService (dinamis, aman, VPN-aware, 15s headroom)
      for (const u of isolatedUsers) {
        try {
          const res = await PPPSecretService.unisolateUser(u.id, u.router?.id);
          if (res.success) {
            mikrotikSuccess++;
          } else {
            mikrotikFailed++;
            console.warn(`[Unisolate-All] Gagal un-isolir ${u.username}: ${res.message}`);
          }
        } catch (err: any) {
          mikrotikFailed++;
          console.error(`[Unisolate-All] Exception un-isolir ${u.username}:`, err?.message || err);
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

      // Ambil daftar user yang memiliki tagihan belum lunas (PENDING atau OVERDUE)
      const unpaidInvoices = await prisma.invoice.findMany({
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        select: { userId: true },
        distinct: ['userId'],
      });
      const unpaidUserIdSet = new Set(unpaidInvoices.map(i => i.userId));

      const SEPTEMBER_TARGET = new Date('2026-09-06T23:59:59.999Z');
      const OCTOBER_TARGET = new Date('2026-10-06T23:59:59.999Z');

      // Update status database untuk seluruh pelanggan terisolir
      for (const user of isolatedUsers) {
        const hasUnpaid = unpaidUserIdSet.has(user.id);
        const targetExpiry = hasUnpaid ? SEPTEMBER_TARGET : OCTOBER_TARGET;

        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: {
            status: 'active',
            billingDay: 6,
            billingCycleDay: 6,
            expiredAt: targetExpiry,
          },
        });
      }
    }

    // 3. Update Tanggal Isolir & Billing Day Pelanggan Lainnya
    const SEPTEMBER_TARGET = new Date('2026-09-06T23:59:59.999Z');
    const OCTOBER_TARGET = new Date('2026-10-06T23:59:59.999Z');

    const allUnpaidInvoices = await prisma.invoice.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      select: { userId: true },
      distinct: ['userId'],
    });
    const allUnpaidSet = new Set(allUnpaidInvoices.map(i => i.userId));

    const activeUsers = await prisma.pppoeUser.findMany({
      where: { status: { notIn: ['stop', 'blocked'] } },
      select: { id: true, expiredAt: true },
    });

    let paidCount = 0;
    let unpaidCount = 0;

    for (const u of activeUsers) {
      const hasUnpaid = allUnpaidSet.has(u.id);
      let newExp = u.expiredAt;

      if (!hasUnpaid) {
        if (!u.expiredAt || u.expiredAt <= SEPTEMBER_TARGET) {
          newExp = OCTOBER_TARGET;
          paidCount++;
        }
      } else {
        if (!u.expiredAt || u.expiredAt <= SEPTEMBER_TARGET) {
          newExp = SEPTEMBER_TARGET;
          unpaidCount++;
        }
      }

      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: {
          billingDay: 6,
          billingCycleDay: 6,
          expiredAt: newExp,
        },
      });
    }

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
        alignedUsersCount: activeUsers.length,
        paidCount,
        unpaidCount,
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
        alignedUsersCount: activeUsers.length,
        paidCount,
        unpaidCount,
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
