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
    const { excludeMuaraBeres = true, hoursAgo = 48 } = body;

    // Fetch sent WA history messages from the last N hours that contain payment links (/pay/)
    const sinceDate = new Date(Date.now() - hoursAgo * 3600 * 1000);

    const waLogs = await prisma.whatsapp_history.findMany({
      where: {
        message: { contains: '/pay/' },
        sentAt: { gte: sinceDate },
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

    const company = await prisma.company.findFirst({ select: { baseUrl: true } });
    const baseUrl = company?.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    let restored = 0;
    let skipped = 0;
    const restoredInvoices: string[] = [];
    const processedPhones = new Set<string>();

    for (const log of waLogs) {
      const msg = log.message;

      // Ensure we only restore the LATEST message sent to each phone number
      const cleanPhoneKey = log.phone.replace(/[^0-9]/g, '').slice(-10);
      if (processedPhones.has(cleanPhoneKey)) {
        skipped++;
        continue;
      }
      processedPhones.add(cleanPhoneKey);

      // Extract invoiceNumber, paymentToken, amount, and dueDate using flexible Regex
      const invMatch = msg.match(/(?:No\.\s*Invoice|Nomor\s*Invoice|Nomor\s*Tagihan|No\s*Tagihan):\s*\*?([^\*\n\r]+)\*?/i) || msg.match(/(INV-[a-zA-Z0-9_-]+)/i);
      const linkMatch = msg.match(/\/pay\/([a-zA-Z0-9_-]+)/i);
      const amountMatch = msg.match(/(?:Jumlah|Total)\s*Tagihan:\s*Rp\s*([\d\.]+)/i);
      const dueMatch = msg.match(/(?:Jatuh Tempo|sebelum):\s*\*?([^\*\n\r]+)\*?/i);

      if (!invMatch || !linkMatch) {
        skipped++;
        continue;
      }

      const invoiceNumber = invMatch[1].replace(/\*/g, '').trim();
      const paymentToken = linkMatch[1].trim();
      const rawAmount = amountMatch ? amountMatch[1].replace(/\./g, '') : '0';
      const parsedAmount = parseInt(rawAmount) || 0;

      // Parse due date if available
      let dueDate = new Date();
      if (dueMatch) {
        const dStr = dueMatch[1].replace(/\*/g, '').trim();
        const parts = dStr.split('/');
        if (parts.length === 3) {
          dueDate = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
        } else {
          const parsed = new Date(dStr);
          if (!isNaN(parsed.getTime())) dueDate = parsed;
        }
      }

      // Extract username/customerId from message string if present (e.g. "Yth. Agus (EMG001)")
      const userMatch = msg.match(/\(([a-zA-Z0-9_-]+)\)/);
      const userCode = userMatch ? userMatch[1] : null;

      // Find customer by phone number or extracted username/customerId
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

      if (!user) {
        skipped++;
        continue;
      }

      const amount = parsedAmount || user.profile?.price || 100000;

      // Check Muara Beres exclusion
      if (excludeMuaraBeres) {
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
          userId: user.id,
          amount,
          baseAmount: user.profile?.price || amount,
          dueDate,
          status: 'PENDING',
          invoiceType: 'MONTHLY',
          customerName: user.name,
          customerPhone: user.phone,
          customerUsername: user.username,
          customerEmail: user.email || null,
          paymentToken,
          paymentLink,
          createdAt: log.sentAt || new Date(),
        },
      });

      restored++;
      restoredInvoices.push(`${invoiceNumber} (${user.name})`);
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
