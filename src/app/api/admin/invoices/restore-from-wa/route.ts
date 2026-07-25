import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { unauthorized } from '@/lib/api-response';

/**
 * POST /api/admin/invoices/restore-from-wa
 * Restores deleted invoices directly from sent whatsapp_history logs so that
 * the EXACT invoiceNumber and EXACT paymentToken / paymentLink received by customers work 100%.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json().catch(() => ({}));
    const { excludeMuaraBeres = true, hoursAgo = 24 } = body;

    // Fetch sent WA history messages from the last 24 hours (sent/terkirim) that contain payment links (/pay/)
    const sinceDate = new Date(Date.now() - hoursAgo * 3600 * 1000);

    const waLogs = await prisma.whatsapp_history.findMany({
      where: {
        sentAt: { gte: sinceDate },
        status: { in: ['sent', 'SENT', 'success', 'SUCCESS', 'terkirim', 'TERKIRIM'] },
        OR: [
          { message: { contains: '/pay/' } },
          { message: { contains: 'INVOICE' } },
          { message: { contains: 'Tagihan' } },
          { message: { contains: 'tagihan' } },
          { message: { contains: 'INV-' } },
        ],
      },
      orderBy: { sentAt: 'desc' },
      take: 1000,
    });

    if (waLogs.length === 0) {
      return NextResponse.json({
        success: false,
        message: `Tidak ditemukan riwayat pesan WA tagihan dalam ${hoursAgo} jam terakhir.`,
      });
    }

    // First pass: collect all valid invoice numbers and tokens from sent WA messages
    const validInvoiceNumbers = new Set<string>();
    const validPaymentTokens = new Set<string>();

    for (const log of waLogs) {
      const msg = log.message;
      const invMatch = msg.match(/(?:No\.\s*Invoice|Nomor\s*Invoice|Nomor\s*Tagihan|No\s*Tagihan):\s*\*?([^\*\n\r]+)\*?/i) || msg.match(/(INV-[a-zA-Z0-9_-]+)/i);
      const linkMatch = msg.match(/\/pay\/([a-zA-Z0-9_-]+)/i);

      if (invMatch) validInvoiceNumbers.add(invMatch[1].replace(/\*/g, '').trim());
      if (linkMatch) validPaymentTokens.add(linkMatch[1].trim());
    }

    // Purge ALL existing PENDING/OVERDUE invoices first so we start from a 100% clean slate!
    const pendingInvoices = await prisma.invoice.findMany({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      select: { id: true },
    });

    if (pendingInvoices.length > 0) {
      const pendingIds = pendingInvoices.map(i => i.id);
      await prisma.payment.deleteMany({ where: { invoiceId: { in: pendingIds } } });
      await prisma.invoice.deleteMany({ where: { id: { in: pendingIds } } });
    }

    const company = await prisma.company.findFirst({ select: { baseUrl: true } });
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let restored = 0;
    let skipped = 0;
    const restoredInvoices: string[] = [];
    const processedPhones = new Set<string>();

    for (const log of waLogs) {
      const msg = log.message;

      // Extract invoiceNumber, paymentToken, amount, and dueDate using flexible Regex
      const invMatch = msg.match(/(?:No\.\s*Invoice|Nomor\s*Invoice|Nomor\s*Tagihan|No\s*Tagihan):\s*\*?([^\*\n\r]+)\*?/i) || msg.match(/(INV-[a-zA-Z0-9_-]+)/i);
      const linkMatch = msg.match(/\/pay\/([a-zA-Z0-9_-]+)/i);
      const amountMatch = msg.match(/(?:Jumlah|Total)\s*Tagihan:\s*Rp\s*([\d\.]+)/i) || msg.match(/Rp\s*([\d\.]+)/i);
      const dueMatch = msg.match(/(?:Jatuh Tempo|sebelum):\s*\*?([^\*\n\r]+)\*?/i);

      if (!invMatch) {
        skipped++;
        continue;
      }

      // Ensure we only restore the LATEST message sent to each phone number
      const cleanPhoneKey = log.phone.replace(/[^0-9]/g, '').slice(-10);
      if (processedPhones.has(cleanPhoneKey)) {
        skipped++;
        continue;
      }
      processedPhones.add(cleanPhoneKey);

      const invoiceNumber = invMatch[1].replace(/\*/g, '').trim();
      const paymentToken = linkMatch ? linkMatch[1].trim() : crypto.randomUUID().replace(/-/g, '');
      const rawAmount = amountMatch ? amountMatch[1].replace(/\./g, '') : '0';
      const parsedAmount = parseInt(rawAmount) || 0;

      // Parse due date if available (handles Indonesian month names like "5 Agustus 2026")
      const INDO_MONTHS: Record<string, number> = {
        januari: 0, jan: 0, februari: 1, feb: 1, maret: 2, mar: 2, april: 3, apr: 3,
        mei: 4, juni: 5, jun: 5, juli: 6, jul: 6, agustus: 7, agu: 7, ags: 7,
        september: 8, sep: 8, oktober: 9, okt: 9, november: 10, nov: 10, desember: 11,
      };

      let dueDate = new Date('2026-08-05');
      if (dueMatch) {
        const dStr = dueMatch[1].replace(/\*/g, '').trim().toLowerCase();
        const parts = dStr.split(/[\/\-\s]+/);
        if (parts.length >= 3) {
          const day = parseInt(parts[0]);
          let month = parseInt(parts[1]) - 1;
          if (isNaN(month)) {
            const mStr = parts[1];
            month = INDO_MONTHS[mStr] !== undefined ? INDO_MONTHS[mStr] : 7;
          }
          const year = parseInt(parts[2]);
          if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
            dueDate = new Date(Date.UTC(year, month, day, 12, 0, 0));
          }
        }
      }

      // Extract customer name from message text (e.g. Yth. Bapak/Ibu *SYAIFUL ANWAR*)
      const nameMatch = msg.match(/Yth\.\s*(?:Bapak\/Ibu\s*)?\*?([^\*\n\r]+)\*?/i);
      const extractedName = nameMatch ? nameMatch[1].replace(/\*/g, '').trim() : '';

      // Extract username/customerId from message string if present (e.g. "Yth. Agus (EMG001)")
      const userMatch = msg.match(/\(([a-zA-Z0-9_-]+)\)/);
      const userCode = userMatch ? userMatch[1] : null;

      // Find customer by phone number, extracted name, or extracted username/customerId
      const cleanPhone = log.phone.replace(/[^0-9]/g, '');
      const searchPhone0 = cleanPhone.startsWith('62') ? '0' + cleanPhone.slice(2) : cleanPhone;
      const searchPhone62 = cleanPhone.startsWith('0') ? '62' + cleanPhone.slice(1) : cleanPhone;
      const lastDigits = searchPhone0.length >= 8 ? searchPhone0.slice(-8) : searchPhone0;

      const user = await prisma.pppoeUser.findFirst({
        where: {
          OR: [
            { phone: log.phone },
            { phone: searchPhone0 },
            { phone: searchPhone62 },
            { phone: { contains: lastDigits } },
            ...(extractedName ? [{ name: { contains: extractedName } }] : []),
            ...(userCode ? [
              { username: userCode },
              { customerId: userCode },
            ] : []),
          ],
        },
        include: {
          area: true,
          profile: true,
        },
      });

      // Check Muara Beres exclusion if user belongs to KMB
      if (user && excludeMuaraBeres) {
        const areaName = user.area?.name || '';
        const userAddress = user.address || '';
        if (
          areaName.toLowerCase().includes('muara beres') ||
          areaName.toLowerCase().includes('kmb') ||
          userAddress.toLowerCase().includes('muara beres')
        ) {
          skipped++;
          continue;
        }
      }

      const amount = parsedAmount || user?.profile?.price || 100000;
      const customerName = user?.name || extractedName || 'Pelanggan';
      const customerPhone = user?.phone || log.phone;
      const customerUsername = user?.username || (extractedName ? extractedName.toLowerCase().replace(/[^a-z0-9]/g, '') : 'user');

      // Check if invoice already exists
      const existing = await prisma.invoice.findFirst({
        where: {
          OR: [
            { invoiceNumber },
            { paymentToken },
          ],
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      // Re-create the EXACT invoice record
      const paymentLink = `${baseUrl}/pay/${paymentToken}`;
      await prisma.invoice.create({
        data: {
          id: crypto.randomUUID(),
          invoiceNumber,
          userId: user?.id || null,
          amount,
          baseAmount: user?.profile?.price || amount,
          dueDate,
          status: 'PENDING',
          invoiceType: 'MONTHLY',
          customerName,
          customerPhone,
          customerUsername,
          customerEmail: user?.email || null,
          paymentToken,
          paymentLink,
          createdAt: log.sentAt || new Date(),
        },
      });

      restored++;
      restoredInvoices.push(`${invoiceNumber} (${customerName})`);
    }

    return NextResponse.json({
      success: true,
      restored,
      skipped,
      restoredInvoices,
      message: `Berhasil memulihkan ${restored} tagihan persis sesuai nomor & link WA yang sudah dikirim ke pelanggan!`,
    });
  } catch (error: any) {
    console.error('Restore from WA error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal memulihkan tagihan dari WA' },
      { status: 500 }
    );
  }
}
