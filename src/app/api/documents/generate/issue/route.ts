import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { issueNextNumber } from '@/server/services/document-numbering.service';
import { ok, badRequest, unauthorized, notFound, serverError } from '@/lib/api-response';

function substituteTemplate(bodyHtml: string, dataJson: Record<string, any>): string {
  return bodyHtml.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = dataJson[key];
    return val !== undefined && val !== null ? String(val) : `{{${key}}}`;
  });
}

// POST /api/documents/generate/issue
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { templateId, dataJson = {}, dept, relatedEntity } = body;

    if (!templateId) return badRequest('templateId wajib diisi');

    const template = await prisma.documentTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) return notFound('Template');

    // Issue number — this INCREMENTS the sequence and logs to issuedNumber table
    const { issuedNumber: documentNumber } = await issueNextNumber({
      category: template.category,
      dept: dept || undefined,
    });

    // Build merged data including the auto-filled document number
    const mergedData = { ...dataJson, nomor_dokumen: documentNumber };

    // Render HTML for storage reference (stored in dataJson._renderedHtml)
    const renderedHtml = substituteTemplate(template.bodyHtml, mergedData);

    // Create generatedDocument record (id uses Prisma @default(cuid()))
    const document = await prisma.generatedDocument.create({
      data: {
        templateId: template.id,
        category: template.category,
        documentNumber,
        status: 'ISSUED',
        dataJson: { ...mergedData, _renderedHtml: renderedHtml },
        pdfPath: null,
        relatedEntity: relatedEntity || null,
        createdBy: session.user?.email || null,
        issuedAt: new Date(),
      },
    });

    return ok({ success: true, document, documentNumber, renderedHtml });
  } catch (error: any) {
    console.error('POST /api/documents/generate/issue error:', error);
    return serverError(error?.message || 'Failed to issue document');
  }
}