import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { ok, unauthorized, serverError } from '@/lib/api-response';
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone';

// GET /api/documents — list generated documents with filters
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== 'all') where.status = status;
    if (category && category !== 'all') where.category = category.toUpperCase();
    if (search && search.trim()) {
      where.OR = [
        { documentNumber: { contains: search.trim() } },
        { createdBy: { contains: search.trim() } },
        { relatedEntity: { contains: search.trim() } },
      ];
    }
    if (startDate && endDate) {
      where.issuedAt = {
        gte: startOfDayWIBtoUTC(startDate),
        lte: endOfDayWIBtoUTC(endDate),
      };
    }

    const [documents, total] = await Promise.all([
      prisma.generatedDocument.findMany({
        where,
        orderBy: { issuedAt: 'desc' },
        skip,
        take: limit,
        include: {
          template: {
            select: { id: true, name: true, category: true },
          },
        },
      }),
      prisma.generatedDocument.count({ where }),
    ]);

    return ok({
      success: true,
      documents,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: any) {
    console.error('GET /api/documents error:', error);
    return serverError(error?.message || 'Failed to fetch documents');
  }
}