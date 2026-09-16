import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { DEFAULT_NUMBERING_RULES } from '@/server/services/document-numbering.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ensure all default rules exist in database
    for (const [cat, def] of Object.entries(DEFAULT_NUMBERING_RULES)) {
      const existing = await prisma.numberingRule.findUnique({ where: { category: cat } });
      if (!existing) {
        await prisma.numberingRule.create({
          data: {
            category: cat,
            pattern: def.pattern,
            resetFrequency: def.resetFrequency,
            currentSeq: 0,
            lastResetPeriod: null,
          }
        });
      }
    }

    const rules = await prisma.numberingRule.findMany({
      orderBy: { category: 'asc' },
    });

    return NextResponse.json({ success: true, rules });
  } catch (error: any) {
    console.error('Error fetching numbering rules:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch rules' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { id, pattern, resetFrequency } = body;

    if (!id || !pattern) {
      return NextResponse.json({ error: 'ID and pattern are required' }, { status: 400 });
    }

    const updated = await prisma.numberingRule.update({
      where: { id },
      data: {
        pattern,
        resetFrequency: resetFrequency || 'yearly',
      }
    });

    return NextResponse.json({ success: true, rule: updated });
  } catch (error: any) {
    console.error('Error updating numbering rule:', error);
    return NextResponse.json({ error: error.message || 'Failed to update rule' }, { status: 500 });
  }
}
