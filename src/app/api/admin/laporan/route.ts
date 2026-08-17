import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC, nowWIB, formatWIB } from '@/lib/timezone';
import { prisma } from '@/server/db/client';
import {
  generateExcelBuffer,
  generatePDFBuffer,
  getCompanyExportInfo,
  formatCurrencyExport,
  formatDateExport,
  ExcelColumnDef,
} from '@/lib/utils/export';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '-';
  return formatWIB(date, 'dd/MM/yyyy');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'invoice'; // invoice | payment | customer
    const format = searchParams.get('format'); // excel | pdf | json (default json)
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const status = searchParams.get('status') || 'all';
    const routerId = searchParams.get('routerId');

    const nowLocal = nowWIB();
    const from = dateFrom
      ? startOfDayWIBtoUTC(dateFrom)
      : new Date(Date.UTC(nowLocal.getUTCFullYear(), nowLocal.getUTCMonth(), 1));
    const to = dateTo
      ? endOfDayWIBtoUTC(dateTo)
      : nowLocal;

    const dateRangeStr = `${dateFrom || formatDate(from)} s/d ${dateTo || formatDate(to)}`;
    const companyInfo = await getCompanyExportInfo();

    // ── INVOICE REPORT ────────────────────────────────────────────────────
    if (type === 'invoice') {
      const where: any = {
        createdAt: { gte: from, lte: to },
      };
      if (status !== 'all') {
        where.status = status.toUpperCase();
      }
      if (routerId && routerId !== 'all') {
        where.user = { routerId };
      }

      const invoices = await prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        select: {
          invoiceNumber: true,
          customerName: true,
          customerUsername: true,
          customerPhone: true,
          amount: true,
          status: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
          invoiceType: true,
          notes: true,
        },
        take: 5000,
      });

      const totalAmount = invoices.reduce((s, i) => s + i.amount, 0);
      const paidAmount = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.amount, 0);
      const paidCount = invoices.filter(i => i.status === 'PAID').length;
      const pendingCount = invoices.filter(i => i.status === 'PENDING').length;

      // Handle binary Export formats
      if (format === 'excel') {
        const columns: ExcelColumnDef[] = [
          { key: 'no', header: 'No.', width: 6, isNumber: true },
          { key: 'invoiceNumber', header: 'No. Invoice', width: 22 },
          { key: 'customerName', header: 'Nama Pelanggan', width: 26 },
          { key: 'username', header: 'Username', width: 18 },
          { key: 'phone', header: 'No. Telepon', width: 16 },
          { key: 'jenis', header: 'Jenis Tagihan', width: 15 },
          { key: 'amount', header: 'Jumlah Tagihan (Rp)', width: 20, isCurrency: true },
          { key: 'status', header: 'Status', width: 14 },
          { key: 'dueDate', header: 'Jatuh Tempo', width: 14, isDate: true },
          { key: 'paidAt', header: 'Tanggal Dibayar', width: 14, isDate: true },
          { key: 'createdAt', header: 'Tanggal Dibuat', width: 14, isDate: true },
          { key: 'notes', header: 'Catatan', width: 25 },
        ];

        const excelData = invoices.map((inv, idx) => ({
          no: idx + 1,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName || '-',
          username: inv.customerUsername || '-',
          phone: inv.customerPhone || '-',
          jenis: inv.invoiceType || 'PPPoE',
          amount: inv.amount,
          status: inv.status === 'PAID' ? 'LUNAS' : inv.status === 'PENDING' ? 'PENDING' : inv.status === 'OVERDUE' ? 'JATUH TEMPO' : 'BATAL',
          dueDate: formatDate(inv.dueDate),
          paidAt: formatDate(inv.paidAt),
          createdAt: formatDate(inv.createdAt),
          notes: inv.notes || '-',
        }));

        const summary = [
          { label: 'Total Invoice', value: `${invoices.length} Item` },
          { label: 'Lunas', value: `${paidCount} (${formatCurrencyExport(paidAmount)})` },
          { label: 'Belum Bayar', value: `${pendingCount} Item` },
          { label: 'Total Nominal', value: totalAmount },
        ];

        const totalRow = {
          no: '',
          invoiceNumber: '',
          customerName: 'TOTAL KESELURUHAN',
          username: '',
          phone: '',
          jenis: '',
          amount: totalAmount,
          status: '',
          dueDate: '',
          paidAt: '',
          createdAt: '',
          notes: '',
        };

        const buffer = await generateExcelBuffer(excelData, columns, 'Laporan Invoice', {
          title: 'LAPORAN INVOICE & TAGIHAN',
          dateRange: dateRangeStr,
          summary,
          totalRow,
          companyInfo,
        });

        return new NextResponse(Buffer.from(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Laporan-Invoice-${dateFrom || 'all'}_${dateTo || 'all'}.xlsx"`,
          },
        });
      }

      if (format === 'pdf') {
        const headers = ['No.', 'No. Invoice', 'Pelanggan', 'Username', 'Telepon', 'Jumlah (Rp)', 'Status', 'Jatuh Tempo', 'Dibayar'];
        const pdfRows = invoices.map((inv, idx) => [
          idx + 1,
          inv.invoiceNumber,
          inv.customerName || '-',
          inv.customerUsername || '-',
          inv.customerPhone || '-',
          formatCurrencyExport(inv.amount),
          inv.status === 'PAID' ? 'LUNAS' : inv.status === 'PENDING' ? 'PENDING' : inv.status,
          formatDate(inv.dueDate),
          formatDate(inv.paidAt),
        ]);

        const pdfSummary = [
          { label: 'Total Data', value: `${invoices.length} Invoice` },
          { label: 'Lunas', value: `${paidCount} Item (${formatCurrencyExport(paidAmount)})` },
          { label: 'Total Tagihan', value: formatCurrencyExport(totalAmount) },
        ];

        const pdfTotalRow = ['', '', 'TOTAL NOMINAL', '', '', formatCurrencyExport(totalAmount), '', '', ''];

        const pdfBuffer = generatePDFBuffer(
          {
            title: 'Laporan Invoice & Tagihan',
            subtitle: dateRangeStr,
            filename: `Laporan-Invoice-${dateFrom || 'all'}.pdf`,
            orientation: 'landscape',
            companyInfo,
          },
          headers,
          pdfRows,
          pdfSummary,
          pdfTotalRow
        );

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Laporan-Invoice-${dateFrom || 'all'}_${dateTo || 'all'}.pdf"`,
          },
        });
      }

      // JSON preview output
      const rows = invoices.map((inv) => ({
        'No. Invoice': inv.invoiceNumber,
        'Nama Pelanggan': inv.customerName || '-',
        'Username': inv.customerUsername || '-',
        'Telepon': inv.customerPhone || '-',
        'Jumlah': inv.amount,
        'Jumlah (Rp)': formatRupiah(inv.amount),
        'Status': inv.status,
        'Jenis': inv.invoiceType,
        'Jatuh Tempo': formatDate(inv.dueDate),
        'Dibayar': formatDate(inv.paidAt),
        'Dibuat': formatDate(inv.createdAt),
        'Catatan': inv.notes || '-',
      }));

      const summary = {
        total: invoices.length,
        paid: invoices.filter(i => i.status === 'PAID').length,
        pending: invoices.filter(i => i.status === 'PENDING').length,
        overdue: invoices.filter(i => i.status === 'OVERDUE').length,
        totalAmount,
        paidAmount,
      };

      return NextResponse.json({ success: true, rows, summary, type });
    }

    // ── PAYMENT REPORT ────────────────────────────────────────────────────
    if (type === 'payment') {
      const paymentWhere: any = {
        paidAt: { gte: from, lte: to },
      };
      if (routerId && routerId !== 'all') {
        paymentWhere.invoice = { user: { routerId } };
      }

      const payments = await prisma.payment.findMany({
        where: paymentWhere,
        orderBy: { paidAt: 'desc' },
        include: {
          invoice: {
            select: {
              invoiceNumber: true,
              customerName: true,
              customerUsername: true,
              customerPhone: true,
            },
          },
        },
        take: 5000,
      });

      const totalAmount = payments.reduce((s, p) => s + p.amount, 0);

      if (format === 'excel') {
        const columns: ExcelColumnDef[] = [
          { key: 'no', header: 'No.', width: 6, isNumber: true },
          { key: 'invoiceNumber', header: 'No. Invoice', width: 22 },
          { key: 'customerName', header: 'Nama Pelanggan', width: 26 },
          { key: 'username', header: 'Username', width: 18 },
          { key: 'phone', header: 'No. Telepon', width: 16 },
          { key: 'method', header: 'Metode Pembayaran', width: 20 },
          { key: 'amount', header: 'Jumlah Dibayar (Rp)', width: 20, isCurrency: true },
          { key: 'status', header: 'Status', width: 14 },
          { key: 'paidAt', header: 'Tanggal Bayar', width: 16, isDate: true },
          { key: 'notes', header: 'Catatan', width: 25 },
        ];

        const excelData = payments.map((pay, idx) => ({
          no: idx + 1,
          invoiceNumber: pay.invoice?.invoiceNumber || '-',
          customerName: pay.invoice?.customerName || '-',
          username: pay.invoice?.customerUsername || '-',
          phone: pay.invoice?.customerPhone || '-',
          method: pay.method || 'Transfer',
          amount: pay.amount,
          status: pay.status || 'SUCCESS',
          paidAt: formatDate(pay.paidAt),
          notes: pay.notes || '-',
        }));

        const summary = [
          { label: 'Total Transaksi', value: `${payments.length} Pembayaran` },
          { label: 'Total Terobayar', value: totalAmount },
        ];

        const totalRow = {
          no: '',
          invoiceNumber: '',
          customerName: 'TOTAL PEMBAYARAN',
          username: '',
          phone: '',
          method: '',
          amount: totalAmount,
          status: '',
          paidAt: '',
          notes: '',
        };

        const buffer = await generateExcelBuffer(excelData, columns, 'Laporan Pembayaran', {
          title: 'LAPORAN PEMBAYARAN & RENCANA PENERIMAAN',
          dateRange: dateRangeStr,
          summary,
          totalRow,
          companyInfo,
        });

        return new NextResponse(Buffer.from(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Laporan-Pembayaran-${dateFrom || 'all'}_${dateTo || 'all'}.xlsx"`,
          },
        });
      }

      if (format === 'pdf') {
        const headers = ['No.', 'No. Invoice', 'Pelanggan', 'Username', 'Metode', 'Jumlah (Rp)', 'Status', 'Tanggal Bayar'];
        const pdfRows = payments.map((pay, idx) => [
          idx + 1,
          pay.invoice?.invoiceNumber || '-',
          pay.invoice?.customerName || '-',
          pay.invoice?.customerUsername || '-',
          pay.method || 'Manual',
          formatCurrencyExport(pay.amount),
          pay.status || 'SUCCESS',
          formatDate(pay.paidAt),
        ]);

        const pdfSummary = [
          { label: 'Total Transaksi', value: `${payments.length} Item` },
          { label: 'Total Diterima', value: formatCurrencyExport(totalAmount) },
        ];

        const pdfTotalRow = ['', '', 'TOTAL DITERIMA', '', '', formatCurrencyExport(totalAmount), '', ''];

        const pdfBuffer = generatePDFBuffer(
          {
            title: 'Laporan Pembayaran',
            subtitle: dateRangeStr,
            filename: `Laporan-Pembayaran-${dateFrom || 'all'}.pdf`,
            orientation: 'landscape',
            companyInfo,
          },
          headers,
          pdfRows,
          pdfSummary,
          pdfTotalRow
        );

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Laporan-Pembayaran-${dateFrom || 'all'}_${dateTo || 'all'}.pdf"`,
          },
        });
      }

      const rows = payments.map((pay) => ({
        'No. Invoice': pay.invoice?.invoiceNumber || '-',
        'Nama Pelanggan': pay.invoice?.customerName || '-',
        'Username': pay.invoice?.customerUsername || '-',
        'Telepon': pay.invoice?.customerPhone || '-',
        'Jumlah': pay.amount,
        'Jumlah (Rp)': formatRupiah(pay.amount),
        'Metode': pay.method,
        'Status': pay.status,
        'Tanggal Bayar': formatDate(pay.paidAt),
        'Catatan': pay.notes || '-',
      }));

      const summary = {
        total: payments.length,
        totalAmount,
      };

      return NextResponse.json({ success: true, rows, summary, type });
    }

    // ── CUSTOMER REPORT ───────────────────────────────────────────────────
    if (type === 'customer') {
      const where: any = {
        createdAt: { gte: from, lte: to },
      };
      if (status !== 'all') {
        where.status = status;
      }
      if (routerId && routerId !== 'all') {
        where.routerId = routerId;
      }

      const customers = await prisma.pppoeUser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
          profile: { select: { name: true, price: true } },
          area: { select: { name: true } },
          pppoeCustomer: { select: { email: true } },
        },
        take: 5000,
      });

      const activeCount = customers.filter(c => c.status === 'active').length;
      const isolatedCount = customers.filter(c => c.status === 'isolated').length;
      const totalBalance = customers.reduce((s, c) => s + (c.balance || 0), 0);

      if (format === 'excel') {
        const columns: ExcelColumnDef[] = [
          { key: 'no', header: 'No.', width: 6, isNumber: true },
          { key: 'customerId', header: 'ID Pelanggan', width: 14 },
          { key: 'nama', header: 'Nama Lengkap', width: 25 },
          { key: 'username', header: 'Username PPPoE', width: 18 },
          { key: 'phone', header: 'No. Telepon', width: 16 },
          { key: 'email', header: 'Email', width: 22 },
          { key: 'status', header: 'Status Pelanggan', width: 15 },
          { key: 'subscriptionType', header: 'Tipe Langganan', width: 15 },
          { key: 'paket', header: 'Paket Internet', width: 18 },
          { key: 'hargaPaket', header: 'Harga Paket (Rp)', width: 18, isCurrency: true },
          { key: 'area', header: 'Wilayah / Area', width: 18 },
          { key: 'saldo', header: 'Saldo (Rp)', width: 16, isCurrency: true },
          { key: 'createdAt', header: 'Tanggal Terdaftar', width: 15, isDate: true },
          { key: 'expiredAt', header: 'Tanggal Expired', width: 15, isDate: true },
          { key: 'catatan', header: 'Catatan', width: 25 },
        ];

        const excelData = customers.map((c, idx) => ({
          no: idx + 1,
          customerId: c.customerId || c.id.slice(0, 8),
          nama: c.name,
          username: c.username,
          phone: c.phone,
          email: c.email || c.pppoeCustomer?.email || '-',
          status: c.status.toUpperCase(),
          subscriptionType: c.subscriptionType || 'POSTPAID',
          paket: c.profile?.name || '-',
          hargaPaket: c.profile?.price || 0,
          area: c.area?.name || '-',
          saldo: c.balance || 0,
          createdAt: formatDate(c.createdAt),
          expiredAt: formatDate(c.expiredAt),
          catatan: c.comment || '-',
        }));

        const summary = [
          { label: 'Total Pelanggan', value: `${customers.length} Orang` },
          { label: 'Pelanggan Aktif', value: `${activeCount} Orang` },
          { label: 'Terisolir', value: `${isolatedCount} Orang` },
          { label: 'Total Saldo', value: totalBalance },
        ];

        const totalRow = {
          no: '',
          customerId: '',
          nama: 'TOTAL KESELURUHAN',
          username: '',
          phone: '',
          email: '',
          status: '',
          subscriptionType: '',
          paket: '',
          hargaPaket: 0,
          area: '',
          saldo: totalBalance,
          createdAt: '',
          expiredAt: '',
          catatan: '',
        };

        const buffer = await generateExcelBuffer(excelData, columns, 'Laporan Pelanggan', {
          title: 'LAPORAN DATA PELANGGAN & SUBSCRIPTION',
          dateRange: dateRangeStr,
          summary,
          totalRow,
          companyInfo,
        });

        return new NextResponse(Buffer.from(buffer), {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename="Laporan-Pelanggan-${dateFrom || 'all'}_${dateTo || 'all'}.xlsx"`,
          },
        });
      }

      if (format === 'pdf') {
        const headers = ['No.', 'ID', 'Nama', 'Username', 'Telepon', 'Status', 'Paket', 'Harga (Rp)', 'Saldo (Rp)', 'Expired'];
        const pdfRows = customers.map((c, idx) => [
          idx + 1,
          c.customerId || c.id.slice(0, 8),
          c.name,
          c.username,
          c.phone,
          c.status.toUpperCase(),
          c.profile?.name || '-',
          formatCurrencyExport(c.profile?.price || 0),
          formatCurrencyExport(c.balance || 0),
          formatDate(c.expiredAt),
        ]);

        const pdfSummary = [
          { label: 'Total Pelanggan', value: `${customers.length} Orang` },
          { label: 'Aktif', value: `${activeCount} Orang` },
          { label: 'Terisolir', value: `${isolatedCount} Orang` },
        ];

        const pdfTotalRow = ['', '', 'TOTAL PELANGGAN: ' + customers.length, '', '', '', '', '', formatCurrencyExport(totalBalance), ''];

        const pdfBuffer = generatePDFBuffer(
          {
            title: 'Laporan Data Pelanggan',
            subtitle: dateRangeStr,
            filename: `Laporan-Pelanggan-${dateFrom || 'all'}.pdf`,
            orientation: 'landscape',
            companyInfo,
          },
          headers,
          pdfRows,
          pdfSummary,
          pdfTotalRow
        );

        return new NextResponse(Buffer.from(pdfBuffer), {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="Laporan-Pelanggan-${dateFrom || 'all'}_${dateTo || 'all'}.pdf"`,
          },
        });
      }

      const rows = customers.map((c) => ({
        'ID': c.customerId || c.id.slice(0, 8),
        'Nama': c.name,
        'Username': c.username,
        'Telepon': c.phone,
        'Email': c.email || c.pppoeCustomer?.email || '-',
        'Status': c.status,
        'Jenis': c.subscriptionType,
        'Paket': c.profile?.name || '-',
        'Harga Paket': c.profile?.price ? formatRupiah(c.profile.price) : '-',
        'Area': c.area?.name || '-',
        'Saldo': formatRupiah(c.balance),
        'Auto Renewal': c.autoRenewal ? 'Ya' : 'Tidak',
        'Terdaftar': formatDate(c.createdAt),
        'Expired': formatDate(c.expiredAt),
        'Catatan': c.comment || '-',
      }));

      const summary = {
        total: customers.length,
        active: activeCount,
        isolated: isolatedCount,
        stopped: customers.filter(c => c.status === 'stopped').length,
        expired: customers.filter(c => c.status === 'expired').length,
      };

      return NextResponse.json({ success: true, rows, summary, type });
    }

    return NextResponse.json({ error: 'Invalid type. Use: invoice | payment | customer' }, { status: 400 });
  } catch (error: any) {
    console.error('[LAPORAN API] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
