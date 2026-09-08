import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { generateManualInvoicePdfBuffer } from '@/lib/manual-invoice-pdf';

type RouteParams = { params: Promise<{ id: string }> };

// GET - Generate and return PDF for a manual invoice (public by ID or invoiceNumber)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const invoice = await prisma.manualInvoice.findFirst({
      where: { OR: [{ id }, { invoiceNumber: id }] },
    });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const company = await prisma.company.findFirst();

    const pdfBuffer = await generateManualInvoicePdfBuffer(invoice, company);

    return new NextResponse(pdfBuffer as any, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('GET /api/manual-invoices/[id]/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
