import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, created, badRequest, unauthorized, serverError } from '@/lib/api-response';

// GET /api/documents/templates — list templates, optional ?category=
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: any = {};
    if (category) where.category = category.toUpperCase();

    const templates = await prisma.documentTemplate.findMany({
      where,
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { documents: true } },
      },
    });

    return ok({ success: true, templates });
  } catch (error: any) {
    console.error('GET /api/documents/templates error:', error);
    return serverError(error?.message || 'Failed to fetch templates');
  }
}

// POST /api/documents/templates — create template
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { category, name, bodyHtml, fieldsSchema } = body;

    if (!category || !name || !bodyHtml) {
      return badRequest('category, name, dan bodyHtml wajib diisi');
    }

    const template = await prisma.documentTemplate.create({
      data: {
        category: category.toUpperCase().trim(),
        name: name.trim(),
        bodyHtml,
        fieldsSchema: fieldsSchema || [],
        isActive: true,
      },
    });

    return created({ success: true, template });
  } catch (error: any) {
    console.error('POST /api/documents/templates error:', error);
    return serverError(error?.message || 'Failed to create template');
  }
}
