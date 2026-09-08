import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { formatCurrencyExport, formatDateExport, getCompanyExportInfo, generateInvoicePDF } from '@/lib/utils/export';

type RouteParams = { params: Promise<{ id: string }> };

// GET - Generate and return PDF for a manual invoice (no auth - public by ID)
export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const invoice = await prisma.manualInvoice.findUnique({ where: { id } });
    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const companyInfo = await getCompanyExportInfo();

    const items = (() => {
      try {
        const raw = invoice.items as any;
        return Array.isArray(raw) ? raw : JSON.parse(raw);
      } catch { return []; }
    })() as Array<{ description: string; qty: number; unitPrice: number; total: number }>;

    // Build line items for generateInvoicePDF (description + amount)
    const lineItems = items.map((item) => ({
      description: item.qty > 1
        ? `${item.description} (${item.qty} x ${formatCurrencyExport(item.unitPrice)})`
        : item.description,
      amount: item.total,
    }));

    // generateInvoicePDF expects Uint8Array — use it and send as binary PDF
    const pdfBuffer = generateInvoicePDF({
      invoiceNumber: invoice.invoiceNumber,
      customerName: invoice.recipientName,
      customerAddress: invoice.recipientAddress || '',
      customerPhone: invoice.recipientPhone || '',
      items: lineItems,
      subtotal: invoice.subtotal,
      discount: invoice.discountAmount > 0 ? invoice.discountAmount : undefined,
      total: invoice.totalAmount,
      dueDate: invoice.createdAt,
      status: invoice.status,
      companyInfo,
    });

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('GET /api/manual-invoices/[id]/pdf error:', error);
    return NextResponse.json({ error: 'Failed to generate PDF' }, { status: 500 });
  }
}
