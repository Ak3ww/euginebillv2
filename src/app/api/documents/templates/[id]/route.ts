import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';

// GET /api/documents/templates/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.id },
      include: {
        documents: {
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
        _count: { select: { documents: true } },
      },
    });
    if (!template) return notFound('Template');

    return ok({ success: true, template });
  } catch (error: any) {
    console.error('GET /api/documents/templates/[id] error:', error);
    return serverError(error?.message || 'Failed to fetch template');
  }
}

// PUT /api/documents/templates/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.id },
      include: { _count: { select: { documents: true } } },
    });
    if (!template) return notFound('Template');

    const body = await request.json();
    const { name, bodyHtml, fieldsSchema, isActive } = body;

    const issuedCount = await prisma.generatedDocument.count({
      where: { templateId: params.id, status: 'ISSUED' },
    });

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (fieldsSchema !== undefined) updateData.fieldsSchema = fieldsSchema;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (bodyHtml !== undefined) {
      if (issuedCount > 0) {
        return badRequest(
          'Tidak bisa mengubah bodyHtml: template ini sudah memiliki dokumen terbit (ISSUED). Nonaktifkan template ini dan buat template baru.'
        );
      }
      updateData.bodyHtml = bodyHtml;
    }

    const updated = await prisma.documentTemplate.update({
      where: { id: params.id },
      data: updateData,
    });

    return ok({ success: true, template: updated });
  } catch (error: any) {
    console.error('PUT /api/documents/templates/[id] error:', error);
    return serverError(error?.message || 'Failed to update template');
  }
}

// DELETE /api/documents/templates/[id] - soft delete
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const template = await prisma.documentTemplate.findUnique({
      where: { id: params.id },
    });
    if (!template) return notFound('Template');

    const updated = await prisma.documentTemplate.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    return ok({ success: true, message: 'Template dinonaktifkan', template: updated });
  } catch (error: any) {
    console.error('DELETE /api/documents/templates/[id] error:', error);
    return serverError(error?.message || 'Failed to delete template');
  }
}