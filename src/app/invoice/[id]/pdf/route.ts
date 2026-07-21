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

    const isPaid = invoice.status === 'PAID';
    const isOverdue = invoice.status === 'OVERDUE';
    
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
    let items: any[] = [];
    if (invoice.type === 'INSTALLATION') {
      items.push({ description: 'Biaya Pemasangan / Instalasi', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else if (invoice.type === 'TOPUP') {
      items.push({ description: 'Top Up Saldo Akun', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else {
      const profileName = invoice.user?.profile?.name || 'Paket Internet';
      items.push({ description: `Langganan Internet: ${profileName}`, quantity: 1, price: invoice.amount, total: invoice.amount });
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Top Brand Accent Bar (#002c60)
    doc.setFillColor(0, 44, 96);
    doc.rect(0, 0, 210, 8, 'F');

    // Company Header
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 44, 96);
    doc.text(company?.name || 'EugineBill', 14, 24);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    let headerY = 29;
    if (company?.address) {
      const cleanAddress = company.address.replace(/<[^>]*>?/gm, '');
      doc.text(cleanAddress, 14, headerY);
      headerY += 5;
    }
    const contactText = [
      company?.phone ? `Tel: ${company.phone}` : '',
      company?.email ? `Email: ${company.email}` : ''
    ].filter(Boolean).join('  |  ');
    if (contactText) {
      doc.text(contactText, 14, headerY);
      headerY += 5;
    }

    // Right side Invoice Number badge
    doc.setFontSize(14);
    doc.setFont('courier', 'bold');
    doc.setTextColor(27, 67, 124);
    doc.text(invoice.invoiceNumber, 196, 24, { align: 'right' });
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    doc.text(`Dicetak: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 196, 29, { align: 'right' });

    // Hairline Divider
    headerY = Math.max(headerY + 2, 38);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.5);
    doc.line(14, headerY, 196, headerY);
    headerY += 8;

    // Status Badge Box
    const statusText = isPaid ? 'LUNAS' : isOverdue ? 'JATUH TEMPO' : 'BELUM DIBAYAR';
    const statusRgb = isPaid ? [5, 150, 105] : isOverdue ? [220, 38, 38] : [217, 119, 6];
    const statusBgRgb = isPaid ? [236, 253, 245] : isOverdue ? [254, 242, 242] : [255, 251, 235];

    doc.setFillColor(statusBgRgb[0], statusBgRgb[1], statusBgRgb[2]);
    doc.setDrawColor(statusRgb[0], statusRgb[1], statusRgb[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, headerY, 36, 7, 1.5, 1.5, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(statusRgb[0], statusRgb[1], statusRgb[2]);
    doc.text(statusText, 32, headerY + 4.8, { align: 'center' });

    headerY += 12;

    // Invoice Metadata & Customer Info Grid
    const infoY = headerY;

    // Left Column: Meta
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('TANGGAL INVOICE', 14, infoY);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 28, 32);
    doc.text(createdDateStr, 14, infoY + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('JATUH TEMPO', 14, infoY + 12);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(26, 28, 32);
    doc.text(dueDateStr, 14, infoY + 17);

    // Right Column: Customer Info
    const custName = invoice.customerName || invoice.user?.name || 'Pelanggan';
    const custUsername = invoice.customerUsername || invoice.user?.customerId || invoice.user?.username || '-';
    const custPhone = invoice.customerPhone || invoice.user?.phone || '-';
    const custAddress = invoice.user?.address || '-';

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('DITAGIHKAN KEPADA', 120, infoY);

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text(custName, 120, infoY + 5);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(67, 71, 80);
    doc.text(`ID Pelanggan: ${custUsername}`, 120, infoY + 10);
    doc.text(`Telepon: ${custPhone}`, 120, infoY + 15);
    if (custAddress && custAddress !== '-') {
      doc.text(`Alamat: ${custAddress.substring(0, 45)}`, 120, infoY + 20);
    }

    const tableStartY = infoY + 28;

    // Items Table
    autoTable(doc, {
      head: [['Deskripsi Layanan', 'Qty', 'Harga', 'Total']],
      body: items.map((item: any) => [
        item.description,
        item.quantity.toString(),
        formatCurrency(item.price),
        formatCurrency(item.total)
      ]),
      startY: tableStartY,
      theme: 'grid',
      headStyles: {
        fillColor: [0, 44, 96],
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'left'
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center', cellWidth: 20 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 30 }
      },
      styles: {
        fontSize: 9,
        cellPadding: 4,
        lineColor: [226, 232, 240],
        lineWidth: 0.3
      },
      alternateRowStyles: {
        fillColor: [249, 249, 254]
      }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;

    // Total Box (Red / Dark Blue Banner like Web Invoice)
    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.rect(14, finalY, 182, 12, 'FD');

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text('TOTAL TAGIHAN', 20, finalY + 8);

    doc.setFontSize(12);
    doc.setFont('courier', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(formatCurrency(invoice.amount), 190, finalY + 8.2, { align: 'right' });

    let footerY = finalY + 22;

    // LUNAS Emerald Stamp if paid
    if (isPaid) {
      doc.setDrawColor(5, 150, 105);
      doc.setLineWidth(1.2);
      doc.roundedRect(14, footerY, 70, 18, 2, 2, 'D');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(5, 150, 105);
      doc.text('L U N A S', 49, footerY + 8, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(115, 119, 129);
      doc.text(`Dibayar: ${paidAtStr || '-'}${invoice.paymentSource ? ` (${invoice.paymentSource})` : ''}`, 49, footerY + 14, { align: 'center' });

      footerY += 26;
    }

    // Bottom Footer note
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 275, 196, 275);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    doc.text(`Terima kasih atas kepercayaan Anda — ${company?.name || 'EugineBill'}`, 105, 281, { align: 'center' });
    doc.text('Dokumen ini merupakan bukti tagihan / pembayaran sah dari sistem EugineBill RADIUS.', 105, 285, { align: 'center' });

    // Get PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
