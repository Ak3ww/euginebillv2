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

    // Try Baileys WA service port 3001
    try {
      const response = await fetch('http://127.0.0.1:3001/groups', {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.status && Array.isArray(data.groups)) {
          return ok({
            success: true,
            groups: data.groups,
            currentPsbWaGroupId: company?.psbWaGroupId || null,
          });
        }
      }
    } catch {
      /* Baileys service not running or offline */
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
