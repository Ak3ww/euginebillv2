import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, unauthorized, notFound, serverError } from '@/lib/api-response';

// GET /api/documents/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const document = await prisma.generatedDocument.findUnique({
      where: { id: params.id },
      include: {
        template: true,
      },
    });
    if (!document) return notFound('Document');

    return ok({ success: true, document });
  } catch (error: any) {
    console.error('GET /api/documents/[id] error:', error);
    return serverError(error?.message || 'Failed to fetch document');
  }
}