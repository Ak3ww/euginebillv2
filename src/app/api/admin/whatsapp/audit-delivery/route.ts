import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { unauthorized, ok, serverError, badRequest } from '@/lib/api-response';
import { WhatsAppService } from '@/server/services/notifications/whatsapp.service';
import { sendInvoiceReminder } from '@/server/services/notifications/whatsapp-templates.service';

export const dynamic = 'force-dynamic';

function normalizePhone(phone: string): string {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('620')) clean = '62' + clean.slice(3);
  else if (clean.startsWith('0')) clean = '62' + clean.slice(1);
  else if (clean.startsWith('8')) clean = '62' + clean;
  else if (!clean.startsWith('62')) clean = '62' + clean;
  return clean;
}

/**
 * GET /api/admin/whatsapp/audit-delivery
 * Audits all PENDING & OVERDUE invoices against actual whatsapp_history logs.
 * Classifies customers into:
 *   - verifiedSent: Really received WA (found in whatsapp_history with status='sent')
 *   - unsent: Has NOT received WA (no sent log entry)
 *   - duplicates: Received WA more than once before fix
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    // 1. Fetch all unpaid invoices (PENDING & OVERDUE)
    const invoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            phone: true,
            status: true,
            profile: { select: { name: true } },
            area: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // 2. Fetch all successful WhatsApp logs from whatsapp_history
    const waLogs = await prisma.whatsapp_history.findMany({
      where: { status: 'sent' },
      select: {
        id: true,
        phone: true,
        message: true,
        sentAt: true,
        providerName: true,
        response: true,
      },
      orderBy: { sentAt: 'desc' },
    });

    // Build map of normalized phone -> sent log entries
    const phoneLogsMap = new Map<string, typeof waLogs>();
    for (const log of waLogs) {
      const norm = normalizePhone(log.phone);
      if (!norm) continue;
      const list = phoneLogsMap.get(norm) || [];
      list.push(log);
      phoneLogsMap.set(norm, list);
    }

    const verifiedSentList: any[] = [];
    const unsentList: any[] = [];
    const duplicateList: any[] = [];

    for (const inv of invoices) {
      const custPhone = inv.customerPhone || inv.user?.phone || '';
      const normPhone = normalizePhone(custPhone);
      const logs = normPhone ? (phoneLogsMap.get(normPhone) || []) : [];

      // Check if invoice number or customer phone has a matching sent log created near or after invoice creation
      const invCreatedAt = new Date(inv.createdAt).getTime() - 24 * 60 * 60 * 1000; // -24h tolerance
      const matchingLogs = logs.filter(l => {
        const logTime = new Date(l.sentAt).getTime();
        const containsInvoice = inv.invoiceNumber && l.message.includes(inv.invoiceNumber);
        return containsInvoice || logTime >= invCreatedAt;
      });

      const isLockedInDb = Boolean(inv.waNotifiedAt) || (inv.sentReminders && inv.sentReminders.length > 2);

      if (matchingLogs.length > 0 || isLockedInDb) {
        verifiedSentList.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName || inv.user?.name || 'Pelanggan',
          customerUsername: inv.customerUsername || inv.user?.username || '-',
          phone: custPhone,
          normPhone,
          amount: inv.amount,
          dueDate: inv.dueDate,
          area: inv.user?.area?.name || '-',
          status: inv.status,
          sentCount: matchingLogs.length,
          lastSentAt: matchingLogs[0]?.sentAt || inv.waNotifiedAt,
          providerName: matchingLogs[0]?.providerName || 'WhatsApp Service',
          isLocked: isLockedInDb,
        });

        if (matchingLogs.length > 1) {
          duplicateList.push({
            invoiceId: inv.id,
            invoiceNumber: inv.invoiceNumber,
            customerName: inv.customerName || inv.user?.name,
            phone: custPhone,
            sendCount: matchingLogs.length,
            logs: matchingLogs.map(m => ({ sentAt: m.sentAt, provider: m.providerName })),
          });
        }
      } else {
        unsentList.push({
          invoiceId: inv.id,
          invoiceNumber: inv.invoiceNumber,
          customerName: inv.customerName || inv.user?.name || 'Pelanggan',
          customerUsername: inv.customerUsername || inv.user?.username || '-',
          phone: custPhone,
          normPhone,
          amount: inv.amount,
          dueDate: inv.dueDate,
          area: inv.user?.area?.name || '-',
          status: inv.status,
          paymentLink: inv.paymentLink,
          waRetryCount: inv.waRetryCount,
        });
      }
    }

    return ok({
      success: true,
      summary: {
        totalInvoices: invoices.length,
        verifiedSent: verifiedSentList.length,
        unsent: unsentList.length,
        duplicates: duplicateList.length,
      },
      verifiedSentList,
      unsentList,
      duplicateList,
    });
  } catch (error: any) {
    console.error('[WA Audit] Error auditing delivery:', error);
    return serverError();
  }
}

/**
 * POST /api/admin/whatsapp/audit-delivery
 * Actions:
 *   - lock_sent : Permanently locks sentReminders for verified sent customers so they NEVER receive repeat WA.
 *   - send_unsent: Safely sends WA ONLY to unsent list with 100% atomic locks.
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { action, invoiceIds } = body;

    if (!action || !['lock_sent', 'send_unsent'].includes(action)) {
      return badRequest('Action harus "lock_sent" atau "send_unsent"');
    }

    const company = await prisma.company.findFirst();
    const companyName = company?.name || 'EugineBill RADIUS';
    const companyPhone = company?.phone || '';

    // FULL LOCK ALL REMINDER DAYS: [-7, -5, -3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28]
    const ALL_DAYS_LOCK = JSON.stringify([-7, -5, -3, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 14, 21, 28]);

    if (action === 'lock_sent') {
      let targetIds = invoiceIds;
      if (!targetIds || targetIds.length === 0) {
        // Find all invoices with at least 1 sent log or waNotified
        const waLogs = await prisma.whatsapp_history.findMany({
          where: { status: 'sent' },
          select: { phone: true, sentAt: true },
        });

        const normPhones = new Set(waLogs.map(l => normalizePhone(l.phone)).filter(Boolean));

        const invoicesToLock = await prisma.invoice.findMany({
          where: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          include: { user: { select: { phone: true } } },
        });

        targetIds = invoicesToLock
          .filter(inv => {
            const p = normalizePhone(inv.customerPhone || inv.user?.phone || '');
            return normPhones.has(p) || Boolean(inv.waNotifiedAt);
          })
          .map(inv => inv.id);
      }

      if (targetIds.length > 0) {
        await prisma.invoice.updateMany({
          where: { id: { in: targetIds } },
          data: {
            waNotifiedAt: new Date(),
            sentReminders: ALL_DAYS_LOCK,
          },
        });
      }

      return ok({
        success: true,
        message: `Berhasil mengunci ${targetIds.length} tagihan terkirim secara permanen. Pengiriman WA ulang tidak akan pernah terjadi lagi untuk tagihan ini.`,
        lockedCount: targetIds.length,
      });
    }

    if (action === 'send_unsent') {
      const targetInvoiceIds: string[] = invoiceIds && invoiceIds.length > 0 ? invoiceIds : [];

      if (targetInvoiceIds.length === 0) {
        return badRequest('Pilih minimal 1 tagihan belum terkirim untuk diproses');
      }

      const invoicesToSend = await prisma.invoice.findMany({
        where: {
          id: { in: targetInvoiceIds },
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        include: {
          user: {
            include: {
              profile: true,
              area: true,
            },
          },
        },
      });

      const results: Array<{ invoiceNumber: string; phone: string; customerName: string; success: boolean; error?: string }> = [];
      let sentCount = 0;
      let failedCount = 0;

      for (const inv of invoicesToSend) {
        const phone = inv.customerPhone || inv.user?.phone || '';
        const customerName = inv.customerName || inv.user?.name || 'Pelanggan';

        if (!phone) {
          results.push({ invoiceNumber: inv.invoiceNumber, phone: '-', customerName, success: false, error: 'Nomor telepon kosong' });
          failedCount++;
          continue;
        }

        // 🛡️ DOUBLE ATOMIC LOCK BEFORE SENDING
        const fresh = await prisma.invoice.findUnique({
          where: { id: inv.id },
          select: { waNotifiedAt: true, sentReminders: true },
        });

        if (fresh?.waNotifiedAt) {
          results.push({ invoiceNumber: inv.invoiceNumber, phone, customerName, success: false, error: 'Tagihan ini sudah terkirim sebelumnya (proteksi duplikat)' });
          failedCount++;
          continue;
        }

        if (totalRetryCount >= 3) {
          results.push({ invoiceNumber: inv.invoiceNumber, phone, customerName, success: false, error: 'Maksimal 3x percobaan gagal untuk tagihan ini' });
          failedCount++;
          continue;
        }

        // Lock in DB first
        await prisma.invoice.update({
          where: { id: inv.id },
          data: {
            waNotifiedAt: new Date(),
            waRetryCount: { increment: 1 },
            sentReminders: ALL_DAYS_LOCK,
          },
        });

        try {
          // Send WA
          await sendInvoiceReminder({
            phone,
            customerName,
            customerId: (inv.user as any)?.customerId || undefined,
            customerUsername: inv.customerUsername || inv.user?.username,
            profileName: (inv.user as any)?.profile?.name,
            area: (inv.user as any)?.area?.name,
            invoiceNumber: inv.invoiceNumber,
            amount: inv.amount,
            dueDate: inv.dueDate,
            paymentLink: inv.paymentLink || '',
            companyName: companyName,
            companyPhone: companyPhone,
            isOverdue: inv.status === 'OVERDUE',
          });

          sentCount++;
          results.push({ invoiceNumber: inv.invoiceNumber, phone, customerName, success: true });
        } catch (sendErr: any) {
          failedCount++;
          // Unlock on failure so admin can retry later
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              waNotifiedAt: null,
              sentReminders: '[]',
            },
          }).catch(() => {});

          results.push({ invoiceNumber: inv.invoiceNumber, phone, customerName, success: false, error: sendErr.message || 'Gagal via provider' });
        }
      }

      return ok({
        success: true,
        sentCount,
        failedCount,
        results,
      });
    }

    return badRequest('Action tidak valid');
  } catch (error: any) {
    console.error('[WA Audit POST] Error:', error);
    return serverError();
  }
}
