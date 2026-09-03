import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

/**
 * Server-side amount extraction from raw notification text.
 * Matches Indonesian m-banking push notifications (BCA, Mandiri, BRI, BNI, GoPay, DANA, ShopeePay, OVO).
 */
const PAYMENT_PATTERNS: RegExp[] = [
  /(?:menerima|diterima|masuk|received|transfer\s+masuk|pembayaran\s+masuk)[^Rp0-9]*[Rp\s]*(\d{1,3}(?:[.,]\d{3})*)/iu,
  /Rp\s*(\d{1,3}(?:[.,]\d{3})*)(?:\s*telah\s*diterima|\s*berhasil\s*diterima)/iu,
  /Rp\s*(\d{1,3}(?:[.,]\d{3})*)\s+dari\s+\S+\s+berhasil\s+diterima/iu,
  /berhasil\s+diterima\s+Rp\s*(\d{1,3}(?:[.,]\d{3})*)/iu,
  /(?:kamu|anda)?\s*menerima\s+[Rp\s]*(\d{1,3}(?:[.,]\d{3})*)/iu,
  /Rp\s*(\d{1,3}(?:[.,]\d{3})*)\s+diterima\b/iu,
];

function extractAmountFromText(text: string): number | null {
  for (const pattern of PAYMENT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/[.,]/g, '');
      const val = parseInt(cleaned, 10);
      if (val > 0) return val;
    }
  }
  return null;
}

// In-memory dedup: prevent processing same notification within 5 minutes
const DEDUP_TTL_MS = 5 * 60 * 1000;
const dedupCache = new Map<string, number>();

function checkDedup(key: string): boolean {
  const now = Date.now();
  for (const [k, t] of dedupCache.entries()) {
    if (now - t > DEDUP_TTL_MS) dedupCache.delete(k);
  }
  if (dedupCache.has(key)) return true;
  dedupCache.set(key, now);
  return false;
}

/**
 * POST /api/payment/qris-notify
 * Webhook receiver for Android m-banking notification listener app.
 * Matches incoming payment to pending QRIS transactions by uniqueAmount.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-qris-secret') || request.headers.get('authorization') || '';
    const configuredSecret = process.env.QRIS_NOTIFY_SECRET || '';

    // If configured, require secret matching
    if (configuredSecret && authHeader.replace(/^Bearer\s+/i, '') !== configuredSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const { source_app, raw_text, note } = body;
    let amount = typeof body.amount === 'number' ? body.amount : 0;

    // Fallback: parse amount from raw notification text if not provided as number
    if ((!amount || amount <= 0) && raw_text) {
      amount = extractAmountFromText(raw_text) ?? 0;
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Nominal pembayaran tidak valid atau tidak dapat di-parse dari notifikasi' },
        { status: 400 }
      );
    }

    const dedupKey = `${amount}:${source_app || 'app'}:${raw_text?.substring(0, 30) || ''}`;
    if (checkDedup(dedupKey)) {
      console.log(`[QRIS Notify] Duplicate ignored: amount=${amount}`);
      return NextResponse.json({ success: true, message: 'Already processed (dedup)' });
    }

    const now = new Date();

    // Find pending QRIS transaction
    const pending = await prisma.qrisPending.findFirst({
      where: {
        uniqueAmount: amount,
        matchedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        invoice: {
          include: {
            user: {
              include: { profile: true },
            },
          },
        },
      },
    });

    if (!pending || !pending.invoice) {
      return NextResponse.json({
        success: false,
        error: `Tidak ada tagihan pending yang cocok dengan nominal Rp ${amount.toLocaleString('id-ID')} (mungkin sudah expired atau salah nominal)`,
      }, { status: 404 });
    }

    const invoice = pending.invoice;

    // ─── ATOMIC SETTLEMENT ────────────────────────────────────────────────────
    const updateResult = await prisma.$transaction(async (tx) => {
      // 1. Guard against race condition: ensure matchedAt is still null
      const checkPending = await tx.qrisPending.updateMany({
        where: { id: pending.id, matchedAt: null },
        data: { matchedAt: now },
      });

      if (checkPending.count === 0) {
        return { alreadySettled: true };
      }

      // 2. Mark invoice as PAID
      await tx.invoice.updateMany({
        where: { id: invoice.id, status: { not: 'PAID' } },
        data: { status: 'PAID', paidAt: now },
      });

      // 3. Create payment record
      await tx.payment.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: invoice.id,
          amount: amount,
          method: 'qris_dinamis',
          status: 'completed',
          paidAt: now,
        },
      });

      // 4. Reactivate user if applicable
      const user = invoice.user;
      if (user && user.profile) {
        const profile = user.profile;
        let baseDate = (user.expiredAt && user.status === 'active') ? new Date(user.expiredAt) : now;
        if (baseDate < now) baseDate = now;

        const newExpiredAt = new Date(baseDate);
        switch (profile.validityUnit) {
          case 'DAYS':
            newExpiredAt.setDate(newExpiredAt.getDate() + profile.validityValue);
            break;
          case 'MONTHS':
            newExpiredAt.setMonth(newExpiredAt.getMonth() + profile.validityValue);
            break;
          case 'HOURS':
            newExpiredAt.setHours(newExpiredAt.getHours() + profile.validityValue);
            break;
          case 'MINUTES':
            newExpiredAt.setMinutes(newExpiredAt.getMinutes() + profile.validityValue);
            break;
        }

        await tx.pppoeUser.update({
          where: { id: user.id },
          data: {
            expiredAt: newExpiredAt,
            status: 'active',
          },
        });
      }

      return { alreadySettled: false, invoiceId: invoice.id };
    });

    if (updateResult.alreadySettled) {
      return NextResponse.json({ success: true, message: 'Invoice already settled' });
    }

    console.log(`[QRIS Notify] ✅ Invoice ${invoice.invoiceNumber} paid via QRIS (Rp ${amount.toLocaleString('id-ID')})`);

    // ─── POST-PAYMENT NETWORK UN-ISOLIR ────────────────────────────────────────
    const user = invoice.user;
    if (user) {
      try {
        const { removeUserFromMikrotikAddressList } = await import('@/server/services/radius/coa-handler.service');
        removeUserFromMikrotikAddressList(user.username, user.routerId, 'isolir')
          .catch(err => console.error('[QRIS Notify] Address-list un-isolir error:', err?.message));

        const company = await prisma.company.findFirst({ select: { radiusEnabled: true } });
        if (!company?.radiusEnabled && user.routerId && user.profile) {
          const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
          const normalProfile = user.profile.mikrotikProfileName || user.profile.name;
          await PPPSecretService.setProfileAndDisconnect(user.routerId, user.username, normalProfile);
        } else if (company?.radiusEnabled) {
          const { disconnectPPPoEUser } = await import('@/server/services/radius/coa-handler.service');
          await disconnectPPPoEUser(user.username);
        }
      } catch (netErr: any) {
        console.error('[QRIS Notify] Network sync error (non-fatal):', netErr?.message);
      }

      // WhatsApp Notification
      try {
        const { sendPaymentSuccess } = await import('@/server/services/notifications/whatsapp-templates.service');
        await sendPaymentSuccess({
          customerName: user.name,
          customerPhone: user.phone,
          customerId: (user as any).customerId || undefined,
          username: user.username,
          password: user.password,
          profileName: user.profile?.name || 'Paket Internet',
          invoiceNumber: invoice.invoiceNumber,
          amount: amount,
          paymentMethod: `QRIS Dinamis (${source_app || 'Bank'})`,
          newExpiredAt: user.expiredAt || now,
        });
      } catch (waErr: any) {
        console.error('[QRIS Notify] WhatsApp notification error:', waErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Pembayaran QRIS berhasil dikonfirmasi',
      invoiceNumber: invoice.invoiceNumber,
      amount,
    });
  } catch (error: any) {
    console.error('[QRIS Notify] Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
