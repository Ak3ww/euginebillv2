import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { mkdir } from 'fs/promises';

export async function POST(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;
    const formData = await request.formData();
    
    const bankName = formData.get('bankName') as string;
    const accountNumber = formData.get('accountNumber') as string;
    const accountName = formData.get('accountName') as string;
    const notes = formData.get('notes') as string;
    const file = formData.get('receiptImage') as File;

    if (!bankName || !accountName || !file) {
      return NextResponse.json(
        { error: 'Mohon lengkapi data pembayaran dan bukti transfer' },
        { status: 400 }
      );
    }

    // Cari invoice
    const invoice = await prisma.invoice.findUnique({
      where: { paymentToken: token },
      include: { user: true }
    });

    if (!invoice || !invoice.userId) {
      return NextResponse.json(
        { error: 'Invoice tidak valid' },
        { status: 404 }
      );
    }

    // Upload file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads/receipts
    const uploadDir = join(process.cwd(), 'public', 'uploads', 'receipts');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // ignore
    }

    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);
    const receiptUrl = `/uploads/receipts/${filename}`;

    // Create manual payment
    const manualPayment = await prisma.manualPayment.create({
      data: {
        userId: invoice.userId,
        invoiceId: invoice.id,
        amount: invoice.amount,
        paymentDate: new Date(),
        bankName,
        accountNumber,
        accountName,
        receiptImage: receiptUrl,
        notes,
        status: 'PENDING'
      }
    });

    return NextResponse.json({ success: true, manualPayment });
  } catch (error: any) {
    console.error('Manual payment error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses pembayaran manual' },
      { status: 500 }
    );
  }
}
