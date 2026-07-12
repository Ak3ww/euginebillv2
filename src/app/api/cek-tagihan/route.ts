import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customerId');

    if (!customerId) {
      return NextResponse.json({ success: false, error: 'ID Pelanggan (customerId) harus diisi' }, { status: 400 });
    }

    const invoices = await prisma.invoice.findMany({
      where: {
        user: {
          customerId: customerId
        },
        status: {
          in: ['PENDING', 'OVERDUE']
        }
      },
      select: {
        id: true,
        invoiceNumber: true,
        amount: true,
        dueDate: true,
        status: true,
        paymentToken: true,
        user: {
          select: {
            name: true,
            status: true,
            profile: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        dueDate: 'asc'
      }
    });

    if (invoices.length > 0) {
      const customer = invoices[0].user;
      return NextResponse.json({
        success: true,
        data: {
          customer,
          invoices: invoices.map(({ user, ...inv }) => inv)
        }
      });
    }

    // If no invoices, let's just check if the user exists
    const user = await prisma.pppoeUser.findFirst({
      where: { customerId: customerId },
      select: { 
        name: true, 
        status: true,
        profile: {
          select: { name: true }
        }
      }
    });

    if (!user) {
      return NextResponse.json({ success: false, error: 'Pelanggan tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        customer: user,
        invoices: []
      }
    });

  } catch (error: any) {
    console.error('Check bill API error:', error);
    return NextResponse.json({ success: false, error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
