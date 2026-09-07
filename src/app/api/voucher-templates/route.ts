import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { DEFAULT_CARD_TEMPLATE, THERMAL_TEMPLATE } from '@/lib/utils/templateRenderer';

// GET all templates
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let templates = await prisma.voucherTemplate.findMany({
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    // Auto-seed standard templates if none exist
    if (templates.length === 0) {
      await prisma.voucherTemplate.createMany({
        data: [
          {
            id: crypto.randomUUID(),
            name: 'Voucher Card (QR Auto-Login)',
            htmlTemplate: DEFAULT_CARD_TEMPLATE,
            isDefault: true,
            isActive: true,
          },
          {
            id: crypto.randomUUID(),
            name: 'Struk Kasir Thermal (QR Auto-Login)',
            htmlTemplate: THERMAL_TEMPLATE,
            isDefault: false,
            isActive: true,
          }
        ]
      });

      templates = await prisma.voucherTemplate.findMany({
        orderBy: [
          { isDefault: 'desc' },
          { createdAt: 'desc' }
        ]
      });
    }

    return NextResponse.json(templates);
  } catch (error) {
    console.error('Get templates error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}

// POST create new template
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, htmlTemplate, isDefault, isActive } = body;

    if (!name || !htmlTemplate) {
      return NextResponse.json(
        { error: 'Name and htmlTemplate are required' },
        { status: 400 }
      );
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.voucherTemplate.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const template = await prisma.voucherTemplate.create({
      data: {
        id: crypto.randomUUID(),
        name,
        htmlTemplate,
        isDefault: isDefault || false,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error('Create template error:', error);
    return NextResponse.json(
      { error: 'Failed to create template' },
      { status: 500 }
    );
  }
}
