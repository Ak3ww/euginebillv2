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
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from '@/lib/timezone';

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
        ];
      }
    }

    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            username: true,
            profile: { select: { name: true, price: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const companyInfo = await getCompanyExportInfo();

    const stats = {
      total: invoices.length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      overdue: invoices.filter(i => i.status === 'OVERDUE').length,
      totalAmount: invoices.reduce((sum, i) => sum + i.amount, 0),
      totalPaid: invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.amount, 0),
      totalUnpaid: invoices.filter(i => i.status !== 'PAID').reduce((sum, i) => sum + i.amount, 0)
    };

    const dateSuffix = startDate && endDate ? `${startDate}_to_${endDate}` : new Date().toISOString().split('T')[0];
    const dateRangeStr = startDate && endDate ? `${startDate} s/d ${endDate}` : 'Semua Periode';

    // Single Invoice PDF Export
    if (format === 'invoice-pdf' && invoiceIds) {
      const invoiceId = invoiceIds.split(',')[0];
      const invoice = invoices.find(i => i.id === invoiceId);

      if (!invoice) {
        return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
      }

      const pdfBuffer = generateInvoicePDF({
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.user?.name || invoice.customerName || 'Pelanggan',
        customerAddress: invoice.user?.email || '',
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
      const headers = ['No.', 'No. Invoice', 'Nama Pelanggan', 'No. Telepon', 'Username', 'Paket Internet', 'Jumlah (Rp)', 'Status', 'Jatuh Tempo', 'Paid At'];
      const pdfRows = invoices.map((inv, idx) => [
        idx + 1,
        inv.invoiceNumber,
        inv.user?.name || inv.customerName || '-',
        inv.user?.phone || inv.customerPhone || '-',
        inv.user?.username || inv.customerUsername || '-',
        inv.user?.profile?.name || inv.invoiceType || '-',
        formatCurrencyExport(inv.amount),
        inv.status === 'PAID' ? 'LUNAS' : inv.status === 'PENDING' ? 'PENDING' : inv.status === 'OVERDUE' ? 'JATUH TEMPO' : 'BATAL',
        formatDateExport(inv.dueDate),
        inv.paidAt ? formatDateExport(inv.paidAt) : '-'
      ]);

      const summary = [
        { label: 'Total Invoice', value: `${stats.total} Item` },
        { label: 'Lunas', value: `${stats.paid} (${formatCurrencyExport(stats.totalPaid)})` },
        { label: 'Belum Bayar', value: `${stats.pending + stats.overdue} (${formatCurrencyExport(stats.totalUnpaid)})` },
        { label: 'Total Tagihan', value: formatCurrencyExport(stats.totalAmount) }
      ];

      const totalRow = ['', '', 'TOTAL TAGIHAN KESELURUHAN', '', '', '', formatCurrencyExport(stats.totalAmount), '', '', ''];

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

      // Check if caller requests JSON metadata (backward compatibility) or binary file
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
      { key: 'invoiceNumber', header: 'No. Invoice', width: 22 },
      { key: 'customerName', header: 'Nama Pelanggan', width: 26 },
      { key: 'customerPhone', header: 'No. Telepon', width: 16 },
      { key: 'username', header: 'Username PPPoE', width: 18 },
      { key: 'package', header: 'Paket Internet', width: 18 },
      { key: 'jenis', header: 'Jenis Tagihan', width: 15 },
      { key: 'amount', header: 'Jumlah Tagihan (Rp)', width: 20, isCurrency: true },
      { key: 'status', header: 'Status', width: 14 },
      { key: 'dueDate', header: 'Jatuh Tempo', width: 14, isDate: true },
      { key: 'paidAt', header: 'Tanggal Dibayar', width: 14, isDate: true },
      { key: 'createdAt', header: 'Tanggal Dibuat', width: 14, isDate: true }
    ];

    const excelData = invoices.map((inv, idx) => ({
      no: idx + 1,
      invoiceNumber: inv.invoiceNumber,
      customerName: inv.user?.name || inv.customerName || 'Deleted',
      customerPhone: inv.user?.phone || inv.customerPhone || '',
      username: inv.user?.username || inv.customerUsername || '',
      package: inv.user?.profile?.name || '-',
      jenis: inv.invoiceType || 'PPPoE',
      amount: inv.amount,
      status: inv.status === 'PAID' ? 'LUNAS' : inv.status === 'PENDING' ? 'PENDING' : inv.status === 'OVERDUE' ? 'JATUH TEMPO' : 'BATAL',
      dueDate: formatDateExport(inv.dueDate),
      paidAt: inv.paidAt ? formatDateExport(inv.paidAt) : '-',
      createdAt: formatDateExport(inv.createdAt)
    }));

    const summaryMetrics = [
      { label: 'Total Invoice', value: `${stats.total} Item` },
      { label: 'Total Lunas', value: stats.totalPaid },
      { label: 'Total Belum Bayar', value: stats.totalUnpaid },
      { label: 'Grand Total', value: stats.totalAmount }
    ];

    const totalRow = {
      no: '',
      invoiceNumber: '',
      customerName: 'TOTAL KESELURUHAN',
      customerPhone: '',
      username: '',
      package: '',
      jenis: '',
      amount: stats.totalAmount,
      status: '',
      dueDate: '',
      paidAt: '',
      createdAt: ''
    };

    const excelBuffer = await generateExcelBuffer(excelData, columns, 'Daftar Invoice', {
      title: 'DAFTAR INVOICE & TAGIHAN',
      dateRange: dateRangeStr,
      summary: summaryMetrics,
      totalRow,
      companyInfo
    });

    const filename = `Invoices-${dateSuffix}.xlsx`;

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
