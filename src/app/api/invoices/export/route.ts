import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import {
  generateExcelBuffer,
  generatePDFBuffer,
  generateInvoicePDF,
  getCompanyExportInfo,
  formatCurrencyExport,
  formatDateExport,
  ExcelColumnDef,
} from '@/lib/utils/export';
import { checkAuth } from '@/server/middleware/api-auth';
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC, formatWIB } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'excel';
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const routerId = searchParams.get('routerId');
  const search = searchParams.get('search');
  const invoiceType = searchParams.get('invoiceType');
  const invoiceIds = searchParams.get('ids');

  try {
    const where: any = {};

    if (invoiceIds) {
      where.id = { in: invoiceIds.split(',') };
    } else {
      if (status && status !== 'all') {
        where.status = status.toUpperCase();
      } else {
        // Exclude CANCELLED by default per enterprise billing standard
        where.status = { in: ['PAID', 'PENDING', 'OVERDUE'] };
      }

      if (invoiceType && invoiceType !== 'all') {
        where.invoiceType = invoiceType;
      }

      if (routerId && routerId !== 'all') {
        where.user = { routerId };
      }

      if (startDate && endDate) {
        where.createdAt = {
          gte: startOfDayWIBtoUTC(startDate),
          lte: endOfDayWIBtoUTC(endDate),
        };
      }

      if (search) {
        where.OR = [
          { invoiceNumber: { contains: search } },
          { customerName: { contains: search } },
          { customerUsername: { contains: search } },
          { customerPhone: { contains: search } },
          { user: { customerId: { contains: search } } },
        ];
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            customerId: true,
            name: true,
            phone: true,
            email: true,
            address: true,
            username: true,
            area: { select: { name: true } },
            router: { select: { name: true } },
            profile: { select: { name: true, price: true, ppnActive: true, ppnRate: true } }
          }
        },
        payments: {
          select: { method: true, status: true, paidAt: true },
          orderBy: { paidAt: 'desc' },
          take: 1
        },
        manualPayments: {
          select: { bankName: true, destinationBank: true, status: true, approvedAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const companyInfo = await getCompanyExportInfo();

    // Map each invoice into enriched accounting data
    const enrichedData = (invoices as any[]).map((inv, idx) => {
      const profilePrice = inv.user?.profile?.price ? Number(inv.user.profile.price) : (inv.baseAmount || inv.amount);
      let additionalAmount = 0;
      let discountAmount = 0;

      if (Array.isArray(inv.additionalFees)) {
        for (const fee of (inv.additionalFees as any[])) {
          const amt = Number(fee.amount) || 0;
          if (amt > 0) additionalAmount += amt;
          else if (amt < 0) discountAmount += Math.abs(amt);
        }
      }

      // If INSTALLATION (PSB/Prorate) and invoice amount < profilePrice, calculate prorate difference
      if (inv.invoiceType === 'INSTALLATION') {
        if (inv.amount < profilePrice) {
          const prorateDiff = profilePrice - inv.amount;
          discountAmount = Math.max(discountAmount, prorateDiff);
        }
      }

      // Calculate PPN
      let ppnAmount = 0;
      if (inv.taxRate && Number(inv.taxRate) > 0) {
        ppnAmount = Math.round(inv.amount * (Number(inv.taxRate) / 100));
      } else if (inv.user?.profile?.ppnActive && inv.user?.profile?.ppnRate) {
        const rate = Number(inv.user.profile.ppnRate) || 11;
        ppnAmount = Math.round((profilePrice * rate) / 100);
      }

      // Invoice Type Label
      let typeLabel = 'Bulanan (Renewal)';
      if (inv.invoiceType === 'INSTALLATION') {
        typeLabel = discountAmount > 0 ? 'Pasang Baru (Prorate)' : 'Pasang Baru (Full)';
      } else if (inv.invoiceType === 'ADDON') {
        typeLabel = 'Biaya Tambahan';
      } else if (inv.invoiceType === 'TOPUP') {
        typeLabel = 'Top Up Saldo';
      } else if (inv.invoiceType === 'RENEWAL') {
        typeLabel = 'Bulanan (Renewal)';
      }

      // Payment Status: LUNAS or BELUM BAYAR (Overdue is treated as Belum Bayar)
      const statusText = inv.status === 'PAID' ? 'LUNAS' : 'BELUM BAYAR';

      // Accurate Payment Method
      let paymentMethodText = '-';
      if (inv.status === 'PAID') {
        if (inv.payments && inv.payments.length > 0 && inv.payments[0].method) {
          paymentMethodText = inv.payments[0].method.toUpperCase();
        } else if (inv.manualPayments && inv.manualPayments.length > 0) {
          paymentMethodText = inv.manualPayments[0].bankName
            ? `Transfer (${inv.manualPayments[0].bankName})`
            : 'Manual Transfer';
        } else {
          paymentMethodText = 'Cash / Tunai';
        }
      }

      // WA Notification Status
      const waStatusText = inv.waNotifiedAt
        ? `Terkirim (${formatWIB(inv.waNotifiedAt, 'dd/MM HH:mm')})`
        : inv.waRetryCount > 0
        ? 'Gagal'
        : 'Belum Kirim';

      // Billing Period
      const periodeText = formatWIB(inv.dueDate || inv.createdAt, 'MMMM yyyy');

      return {
        no: idx + 1,
        invoiceNumber: inv.invoiceNumber,
        periode: periodeText,
        typeLabel,
        customerId: inv.user?.customerId || '-',
        username: inv.user?.username || inv.customerUsername || '-',
        customerName: inv.user?.name || inv.customerName || 'Pelanggan',
        customerPhone: inv.user?.phone || inv.customerPhone || '-',
        address: inv.user?.address || '-',
        area: inv.user?.area?.name || '-',
        router: inv.user?.router?.name || '-',
        package: inv.user?.profile?.name || '-',
        profilePrice,
        additionalAmount,
        discountAmount,
        ppnAmount,
        amount: inv.amount,
        status: statusText,
        paymentMethod: paymentMethodText,
        dueDate: formatDateExport(inv.dueDate),
        paidAt: inv.paidAt ? formatWIB(inv.paidAt, 'dd/MM/yyyy HH:mm') : '-',
        waStatus: waStatusText,
        rawStatus: inv.status,
      };
    });

    const stats = {
      total: enrichedData.length,
      paid: enrichedData.filter(i => i.rawStatus === 'PAID').length,
      unpaid: enrichedData.filter(i => i.rawStatus !== 'PAID').length,
      totalProfilePrice: enrichedData.reduce((sum, i) => sum + i.profilePrice, 0),
      totalAdditional: enrichedData.reduce((sum, i) => sum + i.additionalAmount, 0),
      totalDiscount: enrichedData.reduce((sum, i) => sum + i.discountAmount, 0),
      totalPpn: enrichedData.reduce((sum, i) => sum + i.ppnAmount, 0),
      totalAmount: enrichedData.reduce((sum, i) => sum + i.amount, 0),
      totalPaid: enrichedData.filter(i => i.rawStatus === 'PAID').reduce((sum, i) => sum + i.amount, 0),
      totalUnpaid: enrichedData.filter(i => i.rawStatus !== 'PAID').reduce((sum, i) => sum + i.amount, 0),
    };

    const dateSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split('T')[0];
    const dateRangeStr = startDate && endDate ? `${startDate} s/d ${endDate}` : 'Semua Periode';

    // Single Invoice PDF Export
    if (format === 'invoice-pdf' && invoiceIds) {
      const invoiceId = invoiceIds.split(',')[0];
      const invoice = (invoices as any[]).find(i => i.id === invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const pdfBuffer = generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.user?.name || invoice.customerName || 'Pelanggan',
        customerAddress: invoice.user?.address || '',
        customerPhone: invoice.user?.phone || invoice.customerPhone || '',
        items: [
          {
            description: `Layanan Internet - ${invoice.user?.profile?.name || invoice.invoiceType || 'Paket Internet'}`,
            amount: invoice.amount
          }
        ],
        subtotal: invoice.amount,
        total: invoice.amount,
        dueDate: invoice.dueDate,
        status: invoice.status,
        companyInfo
      });

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`
        }
      });
    }

    // Binary PDF Export (Client or direct download)
    if (format === 'pdf') {
      const headers = [
        'No.',
        'No. Tagihan',
        'Periode',
        'ID Pelanggan',
        'Nama Pelanggan',
        'Paket Internet',
        'Tipe',
        'Harga Paket',
        'Tambahan',
        'Potongan',
        'PPN',
        'Total Bayar',
        'Status',
        'Metode',
        'Jatuh Tempo',
        'Tgl Bayar',
      ];

      const pdfRows = enrichedData.map((d) => [
        d.no,
        d.invoiceNumber,
        d.periode,
        d.customerId,
        d.customerName,
        d.package,
        d.typeLabel,
        formatCurrencyExport(d.profilePrice),
        formatCurrencyExport(d.additionalAmount),
        formatCurrencyExport(d.discountAmount),
        formatCurrencyExport(d.ppnAmount),
        formatCurrencyExport(d.amount),
        d.status,
        d.paymentMethod,
        d.dueDate,
        d.paidAt,
      ]);

      const summary = [
        { label: 'Total Tagihan', value: `${stats.total} Item (${formatCurrencyExport(stats.totalAmount)})` },
        { label: 'Lunas', value: `${stats.paid} (${formatCurrencyExport(stats.totalPaid)})` },
        { label: 'Belum Bayar', value: `${stats.unpaid} (${formatCurrencyExport(stats.totalUnpaid)})` },
        { label: 'Total Potongan/Diskon', value: formatCurrencyExport(stats.totalDiscount) }
      ];

      const totalRow = [
        '',
        '',
        '',
        '',
        'TOTAL KESELURUHAN',
        '',
        '',
        formatCurrencyExport(stats.totalProfilePrice),
        formatCurrencyExport(stats.totalAdditional),
        formatCurrencyExport(stats.totalDiscount),
        formatCurrencyExport(stats.totalPpn),
        formatCurrencyExport(stats.totalAmount),
        '',
        '',
        '',
        '',
      ];

      const pdfBuffer = generatePDFBuffer(
        {
          title: 'Daftar Invoice & Tagihan',
          subtitle: dateRangeStr,
          filename: `Invoices-${dateSuffix}.pdf`,
          orientation: 'landscape',
          companyInfo,
        },
        headers,
        pdfRows,
        summary,
        totalRow
      );

      const acceptHeader = req.headers.get('accept') || '';
      if (acceptHeader.includes('application/json') && searchParams.get('mode') === 'json') {
        return NextResponse.json({
          pdfData: {
            title: 'Daftar Invoice - ' + companyInfo.name,
            headers,
            rows: pdfRows,
            summary,
            generatedAt: formatDateExport(new Date(), 'long')
          }
        });
      }

      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Invoices-${dateSuffix}.pdf"`
        }
      });
    }

    // Excel Export (ExcelJS)
    const columns: ExcelColumnDef[] = [
      { key: 'no', header: 'No.', width: 6, isNumber: true },
      { key: 'invoiceNumber', header: 'No. Tagihan', width: 22 },
      { key: 'periode', header: 'Periode', width: 16 },
      { key: 'typeLabel', header: 'Tipe Tagihan', width: 22 },
      { key: 'customerId', header: 'ID Pelanggan', width: 16 },
      { key: 'username', header: 'Username PPPoE', width: 18 },
      { key: 'customerName', header: 'Nama Pelanggan', width: 26 },
      { key: 'customerPhone', header: 'No. WhatsApp', width: 16 },
      { key: 'address', header: 'Alamat Pemasangan', width: 32 },
      { key: 'area', header: 'Area Coverage', width: 20 },
      { key: 'router', header: 'Router NAS', width: 22 },
      { key: 'package', header: 'Paket Internet', width: 20 },
      { key: 'profilePrice', header: 'Harga Paket', width: 18, isCurrency: true },
      { key: 'additionalAmount', header: 'Tambahan Biaya', width: 18, isCurrency: true },
      { key: 'discountAmount', header: 'Potongan Bayar', width: 18, isCurrency: true },
      { key: 'ppnAmount', header: 'PPN', width: 16, isCurrency: true },
      { key: 'amount', header: 'Total Bayar', width: 18, isCurrency: true },
      { key: 'status', header: 'Status Bayar', width: 16 },
      { key: 'paymentMethod', header: 'Metode Bayar', width: 18 },
      { key: 'dueDate', header: 'Tanggal Jatuh Tempo', width: 18, isDate: true },
      { key: 'paidAt', header: 'Tanggal Bayar', width: 18, isDate: true },
      { key: 'waStatus', header: 'Status Kirim WA', width: 22 },
    ];

    const summaryMetrics = [
      { label: 'Total Tagihan', value: stats.totalAmount },
      { label: 'Total Lunas', value: stats.totalPaid },
      { label: 'Total Belum Bayar', value: stats.totalUnpaid },
      { label: 'Total Potongan/Diskon', value: stats.totalDiscount },
    ];

    const totalRow = {
      no: '',
      invoiceNumber: '',
      periode: '',
      typeLabel: '',
      customerId: '',
      username: '',
      customerName: 'TOTAL KESELURUHAN',
      customerPhone: '',
      address: '',
      area: '',
      router: '',
      package: '',
      profilePrice: stats.totalProfilePrice,
      additionalAmount: stats.totalAdditional,
      discountAmount: stats.totalDiscount,
      ppnAmount: stats.totalPpn,
      amount: stats.totalAmount,
      status: '',
      paymentMethod: '',
      dueDate: '',
      paidAt: '',
      waStatus: '',
    };

    const excelBuffer = await generateExcelBuffer(enrichedData, columns, 'Daftar Tagihan', {
      title: 'DAFTAR TAGIHAN & INVOICE',
      dateRange: dateRangeStr,
      summary: summaryMetrics,
      totalRow,
      companyInfo
    });

    const filename = `Tagihan-${dateSuffix}.xlsx`;

    return new NextResponse(Buffer.from(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('[Invoice Export] Error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
