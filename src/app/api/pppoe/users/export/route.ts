import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { generateExcelBuffer, formatCurrencyExport, formatDateExport, generatePDFBuffer } from '@/lib/utils/export';
import { checkAuth } from '@/server/middleware/api-auth';
import { formatWIB } from '@/lib/timezone';

export async function GET(req: NextRequest) {
  const auth = await checkAuth();
  if (!auth.authorized) {
    return auth.response;
  }

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'excel';
  const profileId = searchParams.get('profileId');
  const routerId = searchParams.get('routerId');
  const status = searchParams.get('status');
  const paymentStatus = searchParams.get('paymentStatus');

  try {
    // Build query filters
    const where: any = {};
    
    if (profileId) {
      where.profileId = profileId;
    }
    
    if (routerId) {
      if (routerId === 'global') {
        where.routerId = null;
      } else {
        where.routerId = routerId;
      }
    }
    
    if (status) {
      where.status = status;
    }

    // Payment status filter via invoice join
    if (paymentStatus === 'unpaid') {
      where.invoices = { some: { status: { in: ['PENDING', 'OVERDUE'] } } };
    } else if (paymentStatus === 'paid') {
      where.NOT = { invoices: { some: { status: { in: ['PENDING', 'OVERDUE'] } } } };
    } else if (paymentStatus === 'isolated') {
      where.status = 'isolated';
    }

    // Fetch PPPoE users with relations (includes password for backup purposes)
    const users = await prisma.pppoeUser.findMany({
      where,
      include: {
        profile: true,
        router: {
          select: { id: true, name: true, nasname: true }
        },
        area: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (format === 'pdf') {
      // Generate PDF data for client-side rendering
      const headers = ['No', 'Username', 'Password', 'Nama', 'Phone', 'Profile', 'Status', 'Expired', 'Router'];
      const rows = users.map((u, idx) => [
        idx + 1,
        u.username,
        u.password,
        u.name,
        u.phone,
        u.profile.name,
        u.status === 'active' ? 'Aktif' : u.status === 'isolated' ? 'Isolir' : u.status === 'blocked' ? 'Block' : 'Stop',
        u.expiredAt ? formatDateExport(u.expiredAt) : '-',
        u.router?.name || 'Global'
      ]);

      const summary = [
        { label: 'Total Pelanggan', value: users.length.toString() },
        { label: 'Aktif', value: users.filter(u => u.status === 'active').length.toString() },
        { label: 'Isolir', value: users.filter(u => u.status === 'isolated').length.toString() },
        { label: 'Block', value: users.filter(u => u.status === 'blocked').length.toString() },
        { label: 'Stop', value: users.filter(u => u.status === 'stop').length.toString() }
      ];

      return NextResponse.json({
        pdfData: {
          title: 'Daftar Pelanggan PPPoE - EugineBill RADIUS',
          headers,
          rows,
          summary,
          generatedAt: formatWIB(new Date())
        }
      });
    }

    // Excel export
    const unifiedHeaders = [
      'ID Pelanggan (kosongkan = auto)',
      'PPPoE Pelanggan',
      'Password PPPoE',
      'Password Portal Pelanggan',
      'Nama Lengkap *',
      'No. Telepon *',
      'Email',
      'Alamat',
      'Area/Wilayah',
      'IP Address',
      'Tipe Langganan (Wajib isi: POSTPAID atau PREPAID)',
      'Profile (opsional)',
      'Router (opsional)',
      'Tanggal Expired (YYYY-MM-DD)',
      'Hari Tagihan (1-31)',
      'Latitude',
      'Longitude',
      'Auto Isolasi (true/false)',
      'Tagihan Pertama (none/prorate/full)',
      'Status (abaikan saat import)',
      'MAC Address',
      'Komentar',
      'No. KTP'
    ];

    const columns = unifiedHeaders.map(h => ({ key: h, header: h, width: 20 }));

    const data = users.map(u => ({
      'ID Pelanggan (kosongkan = auto)': (u as any).customerId || '',
      'PPPoE Pelanggan': u.username,
      'Password PPPoE': u.password,
      'Password Portal Pelanggan': u.portalPassword || '123',
      'Nama Lengkap *': u.name,
      'No. Telepon *': u.phone,
      'Email': u.email || '',
      'Alamat': u.address || '',
      'Area/Wilayah': (u as any).area?.name || '',
      'IP Address': u.ipAddress || '',
      'Tipe Langganan (Wajib isi: POSTPAID atau PREPAID)': u.subscriptionType || 'POSTPAID',
      'Profile (opsional)': u.profile?.name || '',
      'Router (opsional)': u.router?.name || 'Global',
      'Tanggal Expired (YYYY-MM-DD)': u.expiredAt ? new Date(u.expiredAt).toISOString().split('T')[0] : '',
      'Hari Tagihan (1-31)': u.billingDay?.toString() || '',
      'Latitude': u.latitude?.toString() || '',
      'Longitude': u.longitude?.toString() || '',
      'Auto Isolasi (true/false)': (u as any).autoIsolationEnabled !== false ? 'true' : 'false',
      'Tagihan Pertama (none/prorate/full)': '',
      'Tanggal Register (YYYY-MM-DD)': new Date(u.createdAt).toISOString().split('T')[0],
      'Status (abaikan saat import)': u.status,
      'MAC Address': u.macAddress || '',
      'Komentar': u.comment || '',
      'No. KTP': u.idCardNumber || ''
    }));

    const excelBuffer = await generateExcelBuffer(data, columns, 'PPPoE Users');

    const filename = `PPPoE-Users-${new Date().toISOString().split('T')[0]}.xlsx`;
    
    return new NextResponse(Buffer.from(excelBuffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });

  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
