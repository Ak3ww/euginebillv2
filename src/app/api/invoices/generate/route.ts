import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { nanoid } from 'nanoid';
import { randomBytes } from 'crypto';
import { badRequest, unauthorized } from '@/lib/api-response';
import { generateInvoiceNumber } from '@/server/services/billing/invoice.service';

/**
 * POST /api/invoices/generate
 *
 * Body:
 *   targetMonth : 'YYYY-MM'   — billing month (used for POSTPAID due date calculation)
 *   scope       : 'all' | 'single'
 *   userId?     : string       — required when scope='single'
 *   skipExisting: boolean      — skip users that already have invoice for that month (default: true)
 *   sendWa      : boolean      — send WA notification after generating (default: false)
 *
 * Due date logic:
 *   POSTPAID  → billingDay of targetMonth (or last day of month if billingDay > days in month)
 *   PREPAID   → user.expiredAt (the actual expiry already set on the user)
 *
 * Returns { generated, skipped, errors[] }
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const { targetMonth, scope, userId, areaId, skipExisting = true, sendWa = false, additionalFees } = body;

    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      return badRequest('targetMonth harus format YYYY-MM');
    }
    if (!scope || !['all', 'single'].includes(scope)) {
      return badRequest('scope harus "all" atau "single"');
    }
    if (scope === 'single' && !userId) {
      return badRequest('userId diperlukan untuk scope=single');
    }

    const [year, month] = targetMonth.split('-').map(Number);

    // Helper: due date for POSTPAID = billingDay of targetMonth (clamped to days in month)
    const getDueDatePostpaid = (billingDay: number | null): Date => {
      const bd = billingDay ?? 1;
      const daysInMonth = new Date(year, month, 0).getDate(); // last day of targetMonth
      const day = Math.min(bd, daysInMonth);
      return new Date(year, month - 1, day, 23, 59, 59, 999);
    };

    // Build user query
    // If scope='single', fetch the specific user directly regardless of active/isolated status
    const userWhere: any = scope === 'single'
      ? { id: userId }
      : {
          status: { in: ['active', 'ACTIVE', 'isolated', 'ISOLATED', 'pending_installation', 'PENDING_INSTALLATION'] },
          NOT: [
            { status: { in: ['stop', 'STOP', 'stopped', 'STOPPED', 'inactive', 'INACTIVE', 'dismantle', 'DISMANTLE', 'terminated', 'TERMINATED'] } },
            { username: { contains: '-OFF-' } },
          ],
        };
    if (scope === 'all' && areaId && areaId !== 'all') userWhere.areaId = areaId;

    const users = await prisma.pppoeUser.findMany({
      where: userWhere,
      include: {
        area: { select: { id: true, name: true } },
        profile: { select: { id: true, name: true, price: true, ppnActive: true, ppnRate: true } },
      },
    });

    if (users.length === 0) {
      return NextResponse.json({ success: true, generated: 0, skipped: 0, errors: [], message: 'Tidak ada pelanggan yang memenuhi syarat ditemukan' });
    }

    // Fetch company baseUrl for payment links
    const company = await prisma.company.findFirst({ select: { baseUrl: true, name: true, phone: true } });
    const baseUrl = company?.baseUrl || 'http://localhost:3000';

    // Month range for duplicate check: from 1st to last day of targetMonth
    const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    // Batch fetch existing active/paid invoices whose dueDate falls strictly within targetMonth
    // Checking dueDate accurately matches the billing period shown on the admin dashboard
    const userIds = users.map(u => u.id);
    const usernames = users.map(u => u.username).filter(Boolean);

    const existingInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userId: { in: userIds } },
          { customerUsername: { in: usernames } },
        ],
        status: { in: ['PENDING', 'OVERDUE', 'PAID'] },
        dueDate: { gte: monthStart, lte: monthEnd },
      },
      select: { userId: true, customerUsername: true, invoiceNumber: true, status: true },
    });

    const userInvoiceMap = new Map<string, string>();
    for (const inv of existingInvoices) {
      if (inv.userId) userInvoiceMap.set(inv.userId, inv.invoiceNumber);
      if (inv.customerUsername) userInvoiceMap.set(inv.customerUsername, inv.invoiceNumber);
    }

    let generated = 0;
    let skipped = 0;
    const errors: { username: string; error: string }[] = [];

    for (const user of users) {
      try {
        // Skip if user status is stopped or username contains -OFF- (only in bulk 'all' scope)
        const uStatus = (user.status || '').toLowerCase();
        if (scope === 'all' && (['stop', 'stopped', 'inactive', 'dismantle', 'terminated'].includes(uStatus) || user.username.includes('-OFF-'))) {
          skipped++;
          continue;
        }

        // Check if user already has an active/paid invoice for this target month
        const existingInvNum = userInvoiceMap.get(user.id) || (user.username ? userInvoiceMap.get(user.username) : undefined);
        if (skipExisting && existingInvNum) {
          skipped++;
          errors.push({
            username: user.username || user.name || user.id,
            error: `Dilewati: Sudah memiliki tagihan aktif bulan ${targetMonth} (${existingInvNum})`,
          });
          continue;
        }

        if (!user.profile) {
          skipped++;
          errors.push({ username: user.username || user.name || user.id, error: 'Paket langganan belum diatur' });
          continue;
        }

        // Determine if user is truly a new PSB installation customer registered in targetMonth
        const isPendingInstallation = (user.status || '').toUpperCase() === 'PENDING_INSTALLATION';
        const userCreated = user.createdAt ? new Date(user.createdAt) : new Date();
        const userRegMonth = `${userCreated.getFullYear()}-${String(userCreated.getMonth() + 1).padStart(2, '0')}`;
        const isNewPsbInTargetMonth = isPendingInstallation && userRegMonth === targetMonth;

        // Determine due date & invoice type
        const subscriptionType = (user as any).subscriptionType || 'POSTPAID';
        let dueDate: Date;
        let invoiceType: string;

        if (isNewPsbInTargetMonth) {
          dueDate = getDueDatePostpaid((user as any).billingDay ?? null);
          invoiceType = 'INSTALLATION';
        } else if (subscriptionType === 'PREPAID') {
          // If expiredAt is set, use it; otherwise fallback to billingDay in targetMonth or monthEnd
          if (user.expiredAt) {
            dueDate = user.expiredAt;
          } else {
            dueDate = getDueDatePostpaid((user as any).billingDay ?? null);
          }
          invoiceType = 'RENEWAL';
        } else {
          dueDate = getDueDatePostpaid((user as any).billingDay ?? null);
          invoiceType = 'MONTHLY';
        }

        // Calculate amount (ONLY auto-prorate for new PSB registered in targetMonth)
        let baseAmount = user.profile.price;
        if (isNewPsbInTargetMonth) {
          const regDay = userCreated.getDate();
          const targetBillingDay = (user as any).billingDay || 1;
          const daysInMonth = new Date(year, month, 0).getDate();
          const daysRemaining = daysInMonth - regDay + 1;

          if (regDay !== targetBillingDay && daysRemaining > 0 && daysRemaining < daysInMonth) {
            baseAmount = Math.round((user.profile.price / daysInMonth) * daysRemaining);
          }
        }
        let amount = baseAmount;
        let taxRate: number | null = null;
        if (user.profile.ppnActive && user.profile.ppnRate > 0) {
          taxRate = user.profile.ppnRate;
          amount = Math.round(baseAmount + (baseAmount * taxRate / 100));
        }
        
        let feesTotal = 0;
        if (additionalFees && Array.isArray(additionalFees)) {
          feesTotal = additionalFees.reduce((sum: number, fee: any) => sum + (Number(fee.amount) || 0), 0);
          amount = Math.max(0, amount + feesTotal);
        }

        const invoiceId = nanoid();
        const invoiceNumber = generateInvoiceNumber();
        const paymentToken = randomBytes(32).toString('hex');
        const paymentLink = `${baseUrl}/pay/${paymentToken}`;

        await prisma.invoice.create({
          data: {
            id: invoiceId,
            invoiceNumber,
            userId: user.id,
            amount,
            baseAmount,
            ...(taxRate !== null && { taxRate }),
            ...(additionalFees && { additionalFees }),
            dueDate,
            status: 'PENDING',
            invoiceType: invoiceType as any,
            customerName: user.name,
            customerPhone: user.phone,
            customerEmail: user.email || null,
            customerUsername: user.username,
            paymentToken,
            paymentLink,
            createdAt: new Date(),
          },
        });

        // Optionally send WA notification
        if (sendWa && user.phone) {
          try {
            const { sendInvoiceReminder } = await import('@/server/services/notifications/whatsapp-templates.service');
            await sendInvoiceReminder({
              phone: user.phone,
              customerName: user.name,
              customerUsername: user.username,
              invoiceNumber,
              amount,
              dueDate,
              paymentLink,
              companyName: company?.name || '',
              companyPhone: company?.phone || '',
            });
          } catch {
            // WA failure is non-fatal
          }
        }

        generated++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push({ username: user.username, error: errMsg });
      }
    }

    return NextResponse.json({
      success: true,
      generated,
      skipped,
      errors,
      message: `${generated} tagihan berhasil dibuat, ${skipped} dilewati${errors.length > 0 ? `, ${errors.length} gagal` : ''}`,
    });
  } catch (err) {
    console.error('[Generate Invoice] Error:', err);
    return NextResponse.json({ success: false, error: 'Gagal generate tagihan' }, { status: 500 });
  }
}
