import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { previewNextNumber } from '@/server/services/document-numbering.service';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';

function substituteTemplate(bodyHtml: string, dataJson: Record<string, any>): string {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = dataJson[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

// POST /api/documents/generate/preview
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { templateId, dataJson = {}, dept } = body;

    if (!templateId) return badRequest('templateId wajib diisi');

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return notFound('Template');

    const { previewNumber } = await previewNextNumber({
      category: template.category,
      dept: dept || undefined,
    });

    const mergedData = { ...dataJson, nomor_dokumen: previewNumber };
    const previewHtml = substituteTemplate(template.bodyHtml, mergedData);

    return ok({ success: true, previewHtml, previewNumber, template });
  } catch (error: any) {
    console.error('POST /api/documents/generate/preview error:', error);
    return serverError(error?.message || 'Failed to generate preview');
  }
}