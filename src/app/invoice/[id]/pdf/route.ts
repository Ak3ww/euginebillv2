import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // id here is invoiceNumber because it's under /invoice/[id]
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            username: true,
            address: true,
            customerId: true,
            area: { select: { name: true } },
            profile: { select: { name: true, price: true } }
          }
        },
        payments: { take: 1 },
        manualPayments: { take: 1 },
      }
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const company = await prisma.company.findFirst();

    // Map data for PDF (similar to how frontend expects it)
    const isPaid = invoice.status === 'PAID';
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
    const createdDateStr = new Date(invoice.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
    const paidAtStr = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    }) : null;

    // Items
    let items = [];
    if (invoice.type === 'INSTALLATION') {
      items.push({ description: 'Biaya Pemasangan', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else if (invoice.type === 'TOPUP') {
      items.push({ description: `Topup Saldo`, quantity: 1, price: invoice.amount, total: invoice.amount });
    } else {
      const profileName = invoice.user?.profile?.name || 'Paket Internet';
      items.push({ description: `Langganan: ${profileName}`, quantity: 1, price: invoice.amount, total: invoice.amount });
    }

    const doc = new jsPDF();

    // Header
    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text(company?.name || 'EugineBill', 105, 20, { align: 'center' });
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    if (company?.address) doc.text(company.address, 105, 26, { align: 'center' });
    if (company?.phone) doc.text(`Tel: ${company.phone}`, 105, 31, { align: 'center' });

    // Invoice title
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    doc.text('INVOICE TAGIHAN', 105, 45, { align: 'center' });

    // Invoice details
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(`No. Invoice: ${invoice.invoiceNumber}`, 14, 55);
    doc.text(`Tanggal: ${createdDateStr}`, 14, 61);
    doc.text(`Jatuh Tempo: ${dueDateStr}`, 14, 67);
    doc.text(`Status: ${isPaid ? 'LUNAS' : 'BELUM BAYAR'}`, 14, 73);

    // Customer
    doc.setFont('helvetica', 'bold'); doc.text(`Ditagihkan Kepada:`, 130, 55);
    doc.setFont('helvetica', 'normal');
    const custName = invoice.customerName || invoice.user?.name || 'Pelanggan';
    doc.text(custName, 130, 61);
    const custPhone = invoice.customerPhone || invoice.user?.phone;
    if (custPhone) doc.text(custPhone, 130, 67);
    const custUsername = invoice.customerUsername || invoice.user?.username;
    if (custUsername) doc.text(`Username: ${custUsername}`, 130, 73);

    // Items table
    autoTable(doc, {
      head: [['Deskripsi', 'Qty', 'Harga', 'Total']],
      body: items.map((item: any) => [item.description, item.quantity, formatCurrency(item.price), formatCurrency(item.total)]),
      startY: 85,
      headStyles: { fillColor: [13, 148, 136] }, // primary color
      styles: { fontSize: 10 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(12); doc.setFont('helvetica', 'bold');
    doc.text(`Total: ${formatCurrency(invoice.amount)}`, 196, finalY, { align: 'right' });

    if (isPaid) {
      doc.setFontSize(14); doc.setTextColor(0, 128, 0);
      doc.text('L U N A S', 105, finalY + 15, { align: 'center' });
      if (paidAtStr) {
        doc.setFontSize(9); doc.text(`Dibayar pada: ${paidAtStr}`, 105, finalY + 21, { align: 'center' });
      }
    }

    // Get PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Return as downloadable PDF
    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
