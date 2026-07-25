import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const weakUsers = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { password: '123' },
          { password: '' },
          { password: null as any }
        ]
      },
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        portalPassword: true,
      }
    });

    let fixedCount = 0;
    const details: any[] = [];
    const targetPassword = 'eugine0909';

    for (const user of weakUsers) {
      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: {
          password: targetPassword,
          portalPassword: user.portalPassword || '123',
        }
      });

      try {
        await prisma.radcheck.upsert({
          where: { username_attribute: { username: user.username, attribute: 'Cleartext-Password' } },
          create: { username: user.username, attribute: 'Cleartext-Password', op: ':=', value: targetPassword },
          update: { value: targetPassword }
        });
      } catch (_) {}

      fixedCount++;
      details.push({ username: user.username, name: user.name, newPppoePassword: targetPassword });
    }

    return NextResponse.json({
      success: true,
      message: `Berhasil memperbaiki ${fixedCount} pelanggan yang memiliki password PPPoE default '123'/kosong menjadi '${targetPassword}'.`,
      fixedCount,
      details,
    });
  } catch (error: any) {
    console.error('Fix passwords error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mereset password PPPoE' },
      { status: 500 }
    );
  }
}
