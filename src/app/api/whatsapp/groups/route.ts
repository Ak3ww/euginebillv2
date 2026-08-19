import { NextRequest } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { ok, unauthorized, serverError } from '@/lib/api-response';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const company = await prisma.company.findFirst({ select: { psbWaGroupId: true } });

    // Try Baileys WA ports (4000, 3001, WA_SERVICE_PORT)
    const ports = Array.from(new Set([
      process.env.WA_SERVICE_PORT || 4000,
      4000,
      3001
    ]));

    for (const port of ports) {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/groups`, {
          headers: { 'Cache-Control': 'no-cache' },
          signal: AbortSignal.timeout(4000),
        });
        if (response.ok) {
          const data = await response.json();
          if (data.status && Array.isArray(data.groups) && data.groups.length > 0) {
            return ok({
              success: true,
              groups: data.groups,
              currentPsbWaGroupId: company?.psbWaGroupId || null,
            });
          }
        }
      } catch {
        /* try next port */
      }
    }

    return ok({
      success: true,
      groups: [],
      currentPsbWaGroupId: company?.psbWaGroupId || null,
      message: 'Layanan WhatsApp Baileys tidak terhubung. Silakan hubungkan WhatsApp QR terlebih dahulu.',
    });
  } catch (error) {
    console.error('Fetch WA groups error:', error);
    return serverError('Gagal mengambil daftar grup WhatsApp');
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { groupId } = body;

    const company = await prisma.company.findFirst();
    if (company) {
      await prisma.company.update({
        where: { id: company.id },
        data: { psbWaGroupId: groupId || null },
      });
    }

    return ok({
      success: true,
      message: 'ID Grup WA Laporan PSB berhasil disimpan',
      groupId,
    });
  } catch (error) {
    console.error('Update PSB WA Group ID error:', error);
    return serverError('Gagal menyimpan ID Grup WA');
  }
}
