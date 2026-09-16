import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';

// POST /api/documents/[id]/void — mark document as VOID
// The issued number is permanently consumed and not recycled.
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.id },
    });
    if (!document) return notFound('Document');

    if (document.status === 'VOID') {
      return badRequest('Dokumen sudah berstatus VOID');
    }

    const body = await request.json().catch(() => ({}));
    const { reason } = body;

    if (!reason || !String(reason).trim()) {
      return badRequest('Alasan pembatalan (reason) wajib diisi');
    }

    const updated = await prisma.generatedDocument.update({
      where: { id: params.id },
      data: {
        status: 'VOID',
        // Store void reason in dataJson alongside existing data
        dataJson: {
          ...(typeof document.dataJson === 'object' && document.dataJson !== null
            ? (document.dataJson as Record<string, any>)
            : {}),
          _voidReason: String(reason).trim(),
          _voidedAt: new Date().toISOString(),
          _voidedBy: session.user?.email || null,
        },
      },
    });

    return ok({
      success: true,
      message: 'Dokumen berhasil dibatalkan (VOID). Nomor dokumen tetap dikonsumsi.',
      document: updated,
    });
  } catch (error: any) {
    console.error('POST /api/documents/[id]/void error:', error);
    return serverError(error?.message || 'Failed to void document');
  }
}