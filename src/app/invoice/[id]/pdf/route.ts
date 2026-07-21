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

    // Additional fees parsing
    const parsedFees = (() => {
      try {
        if (!invoice.additionalFees) return [];
        const parsed = typeof invoice.additionalFees === 'string'
          ? JSON.parse(invoice.additionalFees)
          : invoice.additionalFees;
        return Array.isArray(parsed) ? parsed : (parsed.items || []);
      } catch { return []; }
    })();

    // Items
    let items: any[] = [];
    if (invoice.type === 'INSTALLATION') {
      items.push({ description: 'Biaya Pemasangan', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else if (invoice.type === 'TOPUP') {
      items.push({ description: 'Top Up Saldo', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else {
      const profileName = invoice.user?.profile?.name || 'Paket Internet';
      items.push({
        description: `Langganan Internet (${new Date(invoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}) - ${profileName}`,
        quantity: 1,
        price: invoice.amount,
        total: invoice.amount
      });
    }

    // Tax calculation
    const taxRateNum = Number(company?.taxRate || 0);
    const hasTax = taxRateNum > 0;
    const baseAmt = hasTax ? Math.round(invoice.amount / (1 + taxRateNum / 100)) : invoice.amount;
    const taxAmt = hasTax ? invoice.amount - baseAmt : 0;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    let currentY = 15;

    // 1. Company Name & Contact Header (Left Side)
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text(company?.name || 'EugineBill', 14, currentY + 4);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    let contactY = currentY + 9;
    if (company?.address) {
      const cleanAddr = company.address.replace(/<[^>]*>?/gm, '');
      doc.text(cleanAddr.substring(0, 50), 14, contactY);
      contactY += 4.5;
    }
    if (company?.phone) {
      doc.text(`Telp: ${company.phone}`, 14, contactY);
      contactY += 4.5;
    }
    if (company?.email) {
      doc.text(company.email, 14, contactY);
      contactY += 4.5;
    }

    // Right Side: INVOICE Title, Number & Status Badge (Exact web invoice match!)
    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text('INVOICE', 196, currentY + 4, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38); // Red-600
    doc.text(invoice.invoiceNumber, 196, currentY + 10, { align: 'right' });

    // Status Pill
    const badgeText = isPaid ? '✓ SUDAH BAYAR' : isOverdue ? '⚠️ TERLAMBAT' : 'BELUM BAYAR';
    const badgeRgb = isPaid ? [6, 95, 70] : isOverdue ? [153, 27, 27] : [146, 64, 14];
    const badgeBgRgb = isPaid ? [209, 250, 229] : isOverdue ? [254, 226, 226] : [254, 243, 199];

    doc.setFillColor(badgeBgRgb[0], badgeBgRgb[1], badgeBgRgb[2]);
    doc.setDrawColor(badgeRgb[0], badgeRgb[1], badgeRgb[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(156, currentY + 13, 40, 6.5, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(badgeRgb[0], badgeRgb[1], badgeRgb[2]);
    doc.text(badgeText, 176, currentY + 17.2, { align: 'center' });

    currentY = Math.max(contactY, currentY + 22);

    // Thick Black HR Line (Exact Web Invoice Match!)
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(14, currentY, 196, currentY);
    currentY += 6;

    // Grid 1: DARI vs KEPADA Box Cards
    const boxW = 89;
    const boxH = 24;

    // DARI Box
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('DARI', 18, currentY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text(company?.name || 'EugineBill', 18, currentY + 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(67, 71, 80);
    if (company?.address) doc.text(company.address.replace(/<[^>]*>?/gm, '').substring(0, 42), 18, currentY + 14.5);
    if (company?.phone) doc.text(`Telp: ${company.phone}`, 18, currentY + 19);

    // KEPADA Box
    doc.roundedRect(107, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('KEPADA', 111, currentY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    const custName = invoice.customerName || invoice.user?.name || 'Pelanggan';
    doc.text(custName.substring(0, 35), 111, currentY + 10);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(67, 71, 80);
    const custId = invoice.customerUsername || invoice.user?.customerId || invoice.user?.username || '-';
    doc.text(`ID Pelanggan: ${custId}`, 111, currentY + 14.5);
    const custPhone = invoice.customerPhone || invoice.user?.phone || '-';
    doc.text(`Telp: ${custPhone}`, 111, currentY + 19);

    currentY += boxH + 4;

    // Grid 2: DETAIL INVOICE vs STATUS PEMBAYARAN Box Cards
    doc.roundedRect(14, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('DETAIL INVOICE', 18, currentY + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(67, 71, 80);
    doc.text(`No Invoice: ${invoice.invoiceNumber}`, 18, currentY + 10);
    doc.text(`Tanggal: ${createdDateStr}`, 18, currentY + 14.5);
    doc.text(`Jatuh Tempo: ${dueDateStr}`, 18, currentY + 19);

    doc.roundedRect(107, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('STATUS PEMBAYARAN', 111, currentY + 5);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(67, 71, 80);
    doc.text(`Status: ${isPaid ? '✓ LUNAS' : isOverdue ? '⚠️ TERLAMBAT' : 'BELUM BAYAR'}`, 111, currentY + 10);
    if (paidAtStr) {
      doc.text(`Dibayar pada: ${paidAtStr}`, 111, currentY + 14.5);
      const paidViaText = invoice.paymentSource || 'Payment Gateway';
      doc.text(`Via: ${paidViaText}`, 111, currentY + 19);
    } else {
      doc.text('Metode: Transfer Bank / Online Payment', 111, currentY + 14.5);
    }

    currentY += boxH + 6;

    // Section Header: RINCIAN LAYANAN
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(115, 119, 129);
    doc.text('RINCIAN LAYANAN', 14, currentY);
    currentY += 3;

    // Rincian Layanan Table (Exact Web Invoice styling: Black Header!)
    const tableBody = [
      ...items.map((item: any) => [
        item.description,
        item.quantity.toString(),
        formatCurrency(hasTax ? baseAmt : item.price),
        formatCurrency(hasTax ? baseAmt : item.total)
      ]),
      ...parsedFees.map((fee: any) => [
        fee.name || fee.description || 'Biaya Tambahan',
        '1',
        formatCurrency(fee.amount || fee.price || 0),
        formatCurrency(fee.amount || fee.price || 0)
      ])
    ];

    if (hasTax) {
      tableBody.push(['Subtotal', '', '', formatCurrency(baseAmt)]);
      tableBody.push([`PPN ${taxRateNum}%`, '', '', formatCurrency(taxAmt)]);
    }

    autoTable(doc, {
      head: [['DESKRIPSI', 'QTY', 'HARGA', 'TOTAL']],
      body: tableBody,
      startY: currentY,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 0, 0], // Black background (Exact Web Invoice Match!)
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 32 }
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [226, 232, 240],
        lineWidth: 0.3
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    // TOTAL ROW Box (Red Banner - Exact Web Invoice Match!)
    doc.setFillColor(254, 242, 242); // bg-red-50
    doc.setDrawColor(220, 38, 38);   // border-red-600
    doc.setLineWidth(0.8);
    doc.rect(14, currentY, 182, 11, 'FD');

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text('TOTAL', 18, currentY + 7.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(formatCurrency(invoice.amount), 192, currentY + 7.5, { align: 'right' });

    currentY += 18;

    // LUNAS Stamp (Emerald Green Box - Exact Web Invoice Match!)
    if (isPaid) {
      doc.setDrawColor(16, 185, 129); // emerald-500
      doc.setLineWidth(1.2);
      doc.roundedRect(14, currentY, 65, 18, 3, 3, 'D');

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('L U N A S', 46.5, currentY + 8, { align: 'center' });

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(115, 119, 129);
      doc.text(`Dibayar pada ${paidAtStr || '-'}`, 46.5, currentY + 14, { align: 'center' });
    }

    // Print Footer Note
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 275, 196, 275);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    doc.text(`Terima kasih atas kepercayaan Anda — ${company?.name || 'EugineBill'}`, 105, 281, { align: 'center' });

    // Output PDF buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Directly trigger device download (attachment disposition)
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
