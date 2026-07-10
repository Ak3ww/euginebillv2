import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'ID Pelanggan diperlukan' }, { status: 400 });
    }

    const user = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { customerId: id },
          { username: id }
        ]
      },
      include: { profile: true }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        userId: user.id,
        status: { in: ['UNPAID', 'OVERDUE'] }
      },
      orderBy: { dueDate: 'asc' }
    });

    return NextResponse.json({
      success: true,
      data: {
        customer: {
          name: user.name,
          profileName: user.profile?.name || '-',
          status: user.status
        },
        invoices: invoices.map(inv => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          amount: inv.amount,
          dueDate: inv.dueDate,
          paymentToken: inv.paymentToken
        }))
      }
    });

  } catch (error) {
    console.error('Check bill error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
