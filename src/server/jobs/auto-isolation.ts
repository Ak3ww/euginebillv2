import 'server-only'
import { prisma } from '@/server/db/client';
import { WhatsAppService } from '@/server/services/notifications/whatsapp.service';
import { EmailService } from '@/server/services/notifications/email.service';
import { sendPushToUser } from '@/server/services/notifications/push-templates.service';
import { ensureHttpsUrl } from '@/lib/utils';

/**
 * Enhanced Auto-Isolation for expired PPPoE users
 * 
 * IMPORTANT: This uses TRUE ISOLATION (allow login, restrict via firewall)
 * NOT suspension (block login completely)
 * 
 * Workflow:
 * 1. Find expired users (expiredAt < NOW and status != isolated)
 * 2. Update status to 'isolated'
 * 3. KEEP password in radcheck (allow authentication)
 * 4. Set radusergroup to 'isolir' (RADIUS assigns isolated profile)
 * 5. Remove static IP (user gets IP from pool-isolir: 192.168.200.x)
 * 6. Disconnect user session (force re-auth with new group)
 * 7. On re-login: RADIUS assigns:
 *    - IP from pool-isolir (192.168.200.x)
 *    - Rate limit (e.g., 64k/64k)
 *    - MikroTik firewall restricts access (only DNS + billing + payment)
 */
export async function autoIsolateExpiredUsers() {
  try {
    const company = await prisma.company.findFirst();
    const isRadius = company?.radiusEnabled !== false;
    const isolateProfileName = company?.isolateProfileName || 'isolir';
    console.log(`[AUTO-ISOLATE] Starting auto-isolation check (RADIUS: ${isRadius})...`);

    // Find users that should be isolated (respect per-user autoIsolationEnabled setting)
    const expiredUsers = await prisma.pppoeUser.findMany({
      where: {
        expiredAt: {
          lte: new Date(), // expired
        },
        status: {
          notIn: ['isolated', 'suspended', 'blocked', 'stop'], // not already isolated
        },
        OR: [
          { autoIsolationEnabled: true },
          { autoIsolationEnabled: { not: false } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        phone: true,
        email: true,
        expiredAt: true,
        routerId: true,
      },
    });

    if (expiredUsers.length === 0) {
      console.log('[AUTO-ISOLATE] ? No users to isolate');
      return {
        success: true,
        isolatedCount: 0,
        message: 'No users need isolation',
      };
    }

    console.log(`[AUTO-ISOLATE] Found ${expiredUsers.length} expired users to isolate`);

    let isolatedCount = 0;
    const errors: string[] = [];

    const gracePeriodDays = company?.gracePeriodDays ?? 0;
    const nowCheck = new Date();

    for (const user of expiredUsers) {
      try {
        // 🛑 SAFETY GUARD 1: Verify invoice status before isolating!
        const unpaidInvoices = await prisma.invoice.findMany({
          where: {
            userId: user.id,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
        });

        // 🛑 SAFETY GUARD 2: Customer has ZERO unpaid invoices (already paid!)
        if (unpaidInvoices.length === 0) {
          const userRecord = await prisma.pppoeUser.findUnique({
            where: { id: user.id },
            select: { billingDay: true },
          });

          const bd = userRecord?.billingDay || company?.fixedBillingDate || 6;
          const nextMonth = nowCheck.getUTCMonth() + 1;
          const nextYear = nextMonth > 11 ? nowCheck.getUTCFullYear() + 1 : nowCheck.getUTCFullYear();
          const nm = nextMonth % 12;
          const nextMonthLastDay = new Date(Date.UTC(nextYear, nm + 1, 0)).getUTCDate();
          const nextExpiry = new Date(Date.UTC(nextYear, nm, Math.min(bd, nextMonthLastDay), 23, 59, 59, 999));

          await prisma.pppoeUser.update({
            where: { id: user.id },
            data: {
              status: 'active',
              expiredAt: nextExpiry,
            },
          });

          console.log(`[AUTO-ISOLATE] 🛑 PROTECTED: User ${user.username} has 0 unpaid invoices (already paid). Auto-healed expiredAt to ${nextExpiry.toISOString()}`);
          continue; // SKIP ISOLATION!
        }

        // 🛑 SAFETY GUARD 3: Check if invoice dueDate has actually passed
        const earliestUnpaid = unpaidInvoices[0];
        const invDue = new Date(earliestUnpaid.dueDate);
        const effectiveDueEnd = new Date(invDue);
        effectiveDueEnd.setUTCHours(23, 59, 59, 999);
        const graceEndMs = effectiveDueEnd.getTime() + (gracePeriodDays * 24 * 60 * 60 * 1000);

        if (nowCheck.getTime() <= graceEndMs) {
          console.log(`[AUTO-ISOLATE] 🛑 PROTECTED: User ${user.username} invoice ${earliestUnpaid.invoiceNumber} due date (${invDue.toISOString()}) has not yet passed. Skipping isolation.`);
          continue; // SKIP ISOLATION!
        }

        console.log(`[AUTO-ISOLATE] Processing: ${user.username}`);

        // 1. Update user status to isolated
        await prisma.pppoeUser.update({
          where: { id: user.id },
          data: { status: 'isolated' },
        });

        // 1. PRIMARY: DIRECT MIKROTIK ISOLATION (always run)
        if (user.routerId) {
          try {
            const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
            await PPPSecretService.setProfileAndDisconnect(user.routerId, user.username, isolateProfileName);
            console.log(`[AUTO-ISOLATE] ✓ Swapped profile to '${isolateProfileName}' and kicked ${user.username} via MikroTik API`);
          } catch (mtErr: any) {
            console.log(`[AUTO-ISOLATE] ⚠️ Direct MikroTik isolation error for ${user.username}: ${mtErr.message}`);
          }
        } else {
          console.log(`[AUTO-ISOLATE] ⚠️ Cannot isolate via MikroTik API (no routerId) for ${user.username}`);
        }

        // 2. SECONDARY: RADIUS ISOLATION (only if RADIUS mode enabled)
        if (isRadius) {
          await prisma.$executeRaw`
            INSERT INTO radcheck (username, attribute, op, value)
            VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
            ON DUPLICATE KEY UPDATE value = ${user.password}
          `;

          await prisma.$executeRaw`
            DELETE FROM radcheck 
            WHERE username = ${user.username} 
              AND attribute = 'Auth-Type'
          `;

          await prisma.$executeRaw`
            DELETE FROM radreply 
            WHERE username = ${user.username} 
              AND attribute = 'Reply-Message'
          `;

          await prisma.$executeRaw`
            DELETE FROM radusergroup WHERE username = ${user.username}
          `;
          await prisma.$executeRaw`
            INSERT INTO radusergroup (username, groupname, priority)
            VALUES (${user.username}, 'isolir', 1)
          `;

          await prisma.$executeRaw`
            DELETE FROM radreply 
            WHERE username = ${user.username} 
              AND attribute = 'Framed-IP-Address'
          `;

          try {
            const activeSession = await prisma.radacct.findFirst({
              where: { username: user.username, acctstoptime: null },
              select: { framedipaddress: true, nasipaddress: true },
            });

            if (activeSession?.framedipaddress && activeSession.framedipaddress !== '0.0.0.0') {
              try {
                const { addToMikrotikAddressList } = await import('@/server/services/radius/coa-handler.service');
                await addToMikrotikAddressList(
                  activeSession.nasipaddress || '',
                  activeSession.framedipaddress,
                  'isolir'
                );
              } catch (addrErr: any) {
                console.log(`[AUTO-ISOLATE] ⚠️ Address-list add failed (non-fatal): ${addrErr.message}`);
              }
            }

            const { disconnectPPPoEUser } = await import('@/server/services/radius/coa-handler.service');
            await disconnectPPPoEUser(user.username);
          } catch (coaError: any) {
            console.log(`[AUTO-ISOLATE] ⚠️ Disconnect failed: ${coaError.message}`);
          }

          await prisma.$executeRaw`
            UPDATE radacct 
            SET acctstoptime = NOW(), 
                acctterminatecause = 'User-Isolated'
            WHERE username = ${user.username} 
              AND acctstoptime IS NULL
          `;
        }

        // 7. Create activity log
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            username: user.username,
            userRole: 'user',
            action: 'ISOLATED',
            description: `User ${user.username} auto-isolated due to expiration (${user.expiredAt?.toISOString() || 'unknown'})`,
            module: 'isolation',
            status: 'success',
            ipAddress: 'system',
          },
        }).catch(() => {}); // Ignore if activityLog doesn't exist

        isolatedCount++;
        console.log(`[AUTO-ISOLATE] ? Successfully isolated ${user.username}`);

        // 8. Send notification (optional)
        try {
          await sendIsolationNotification(user);
        } catch (notifError) {
          console.log(`[AUTO-ISOLATE] ?? Notification failed for ${user.username}`);
        }

      } catch (userError: any) {
        const errorMsg = `Failed to isolate ${user.username}: ${userError.message}`;
        console.error(`[AUTO-ISOLATE] ? ${errorMsg}`);
        errors.push(errorMsg);
      }
    }

    const result = {
      success: true,
      isolatedCount,
      totalProcessed: expiredUsers.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully isolated ${isolatedCount} out of ${expiredUsers.length} users`,
    };

    console.log(`[AUTO-ISOLATE] ? Complete: ${JSON.stringify(result)}`);
    return result;

  } catch (error: any) {
    console.error('[AUTO-ISOLATE] ? Fatal error:', error);
    return {
      success: false,
      error: error.message,
      message: 'Auto-isolation failed',
    };
  }
}

/**
 * Send isolation notification to customer via WhatsApp, Email, and Web/FCM Push.
 * Respects company settings: isolationNotifyWhatsapp / isolationNotifyEmail.
 * Push is always attempted if the user has registered push subscriptions/FCM tokens.
 */
export async function sendIsolationNotification(user: {
  id: string;
  username: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  expiredAt?: Date | null;
  customerId?: string | null;
}) {
  try {
    const company = await prisma.company.findFirst();
    if (!company) return;

    let realCustomerId = user.customerId;
    const dbUser = await prisma.pppoeUser.findUnique({
      where: { id: user.id },
      select: { customerId: true, pppoeCustomerId: true, waNotificationEnabled: true },
    });
    if (!realCustomerId || realCustomerId === user.username) {
      realCustomerId = dbUser?.customerId || dbUser?.pppoeCustomerId || user.customerId || user.username;
    }

    // Fetch latest pending/overdue invoice for totalUnpaid calculation
    const unpaidInvoice = await prisma.invoice.findFirst({
      where: { userId: user.id, status: { in: ['PENDING', 'OVERDUE'] } },
      orderBy: { createdAt: 'desc' },
      select: { amount: true, paymentToken: true },
    });

    const rawBaseUrl = company.baseUrl || process.env.NEXT_PUBLIC_APP_URL || 'https://euginemediagroup.com';
    const baseUrl = ensureHttpsUrl(rawBaseUrl);

    // If paymentToken is present, construct direct payment link
    const paymentLink = unpaidInvoice?.paymentToken
      ? ensureHttpsUrl(`${baseUrl}/pay/${unpaidInvoice.paymentToken}`)
      : ensureHttpsUrl(`${baseUrl}/isolated?username=${encodeURIComponent(user.username)}`);

    const isolatedUrl = ensureHttpsUrl(`${baseUrl}/isolated?username=${encodeURIComponent(user.username)}`);
    const appDownloadUrl = ensureHttpsUrl((company as any).appDownloadUrl || `${baseUrl}/download-app`);
    const expiredDate = user.expiredAt
      ? new Date(user.expiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
      : '-';

    const totalUnpaidFormatted = unpaidInvoice?.amount
      ? `Rp ${unpaidInvoice.amount.toLocaleString('id-ID')}`
      : '-';

    const rateLimit = (company as any).isolationRateLimit || '64k/64k';

    const templateVars: Record<string, string> = {
      customerName: user.name || user.username,
      username: user.username,
      customerId: realCustomerId || user.username,
      phoneNumber: user.phone || '-',
      expiredDate,
      gracePeriodEnd: expiredDate,
      rateLimit,
      totalUnpaid: totalUnpaidFormatted,
      paymentLink,
      isolatedUrl,
      qrCode: paymentLink,
      qrCodeImage: paymentLink,
      companyName: company.name || '',
      companyPhone: company.phone || '',
      companyWhatsapp: company.phone || '',
      companyEmail: company.email || '',
      companyWebsite: baseUrl,
      link_download_aplikasi: appDownloadUrl,
      link_download_apk: appDownloadUrl,
      appDownloadLink: appDownloadUrl,
    };

    // -- WhatsApp ------------------------------------------------------------
    const isWaEnabled = dbUser ? dbUser.waNotificationEnabled !== false : true;
    if (company.isolationNotifyWhatsapp && user.phone && isWaEnabled) {
      try {
        // Prefer DB isolation template; fall back to plain message
        const waTemplate = await prisma.isolationTemplate.findFirst({
          where: { type: 'whatsapp', isActive: true },
        });

        let message: string;
        if (waTemplate?.message) {
          message = waTemplate.message;
          for (const [key, val] of Object.entries(templateVars)) {
            message = message.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), val);
            message = message.replace(new RegExp(`\\{${key}\\}`, 'gi'), val);
          }
        } else {
          message =
            `⚠️ *Layanan Internet Diisolir*\n\n` +
            `Halo ${templateVars.customerName},\n\n` +
            `Akun internet Anda (*${realCustomerId}*) telah diisolir karena masa berlangganan habis.\n\n` +
            `📅 Expired: ${expiredDate}\n\n` +
            `Untuk mengaktifkan kembali, buka halaman berikut dan lakukan pembayaran:\n🔗 ${paymentLink}\n\n` +
            `Butuh bantuan?\n📞 ${company.phone || '-'}\n\n` +
            `Terima kasih,\n*${company.name}*`;
        }

        await WhatsAppService.sendMessage({ phone: user.phone, message });
        console.log(`[Isolation] ? WhatsApp sent to ${user.username} (${user.phone})`);
      } catch (err: any) {
        console.error(`[Isolation] ?? WhatsApp failed for ${user.username}:`, err.message);
      }
    }

    // -- Email ---------------------------------------------------------------
    if (company.isolationNotifyEmail && user.email) {
      try {
        const emailTemplate = await prisma.isolationTemplate.findFirst({
          where: { type: 'email', isActive: true },
        });

        let htmlBody: string;
        let subject: string;
        if (emailTemplate?.message) {
          htmlBody = emailTemplate.message;
          subject = emailTemplate.subject || `?? Akun Anda Telah Diisolir - ${user.username}`;
          for (const [key, val] of Object.entries(templateVars)) {
            htmlBody = htmlBody.replace(new RegExp(`{{${key}}}`, 'g'), val);
            subject = subject.replace(new RegExp(`{{${key}}}`, 'g'), val);
          }
        } else {
          subject = `?? Layanan Internet Diisolir - ${user.username}`;
          htmlBody = `
            <h2>Layanan Internet Diisolir</h2>
            <p>Halo <strong>${templateVars.customerName}</strong>,</p>
            <p>Akun internet Anda (<strong>${user.username}</strong>) telah diisolir karena masa berlangganan habis.</p>
            <p><strong>Tanggal Expired:</strong> ${expiredDate}</p>
            <p>Untuk mengaktifkan kembali layanan, silakan lakukan pembayaran:</p>
            <p><a href="${isolatedUrl}" style="background:#e11d48;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;">Buka Halaman Isolir & Bayar</a></p>
            <p>Atau hubungi kami di ${company.phone || '-'}</p>
            <p>Terima kasih,<br>${company.name}</p>
          `;
        }

        await EmailService.send({
          to: user.email,
          toName: user.name,
          subject,
          html: htmlBody,
        });
        console.log(`[Isolation] ? Email sent to ${user.username} (${user.email})`);
      } catch (err: any) {
        console.error(`[Isolation] ?? Email failed for ${user.username}:`, err.message);
      }
    }

    // -- Web/FCM Push --------------------------------------------------------
    try {
      // Find the first overdue invoice for this user (for amount/dueDate in push body)
      const overdueInvoice = await prisma.invoice.findFirst({
        where: { userId: user.id, status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
        select: { amount: true, dueDate: true, invoiceNumber: true },
      });

      await sendPushToUser(user.id, 'isolation-notice', {
        customerName: user.name || user.username,
        username: user.username,
        amount: overdueInvoice?.amount,
        dueDate: overdueInvoice?.dueDate || undefined,
        invoiceNumber: overdueInvoice?.invoiceNumber,
        companyName: company.name || '',
        companyPhone: company.phone || '',
      });
      console.log(`[Isolation] ? Push sent to ${user.username}`);
    } catch (err: any) {
      console.error(`[Isolation] ?? Push failed for ${user.username}:`, err.message);
    }
  } catch (error: any) {
    console.error(`[Isolation] ?? Notification error for ${user.username}:`, error.message);
  }
}

/**
 * Manual isolation trigger (for admin)
 */
export async function isolateUser(username: string, reason?: string) {
  try {
    const user = await prisma.pppoeUser.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        name: true,
        password: true,
        status: true,
        routerId: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status === 'isolated') {
      return {
        success: true,
        message: 'User already isolated',
      };
    }

    const company = await prisma.company.findFirst();
    const isRadius = company?.radiusEnabled ?? false;
    const isolateProfileName = company?.isolateProfileName || 'isolir';

    // Same isolation logic as auto-isolate
    await prisma.pppoeUser.update({
      where: { id: user.id },
      data: { status: 'isolated' },
    });

    // 1. PRIMARY: DIRECT MIKROTIK ISOLATION (always run)
    if (user.routerId) {
      const { PPPSecretService } = await import('@/server/services/mikrotik/ppp-secret.service');
      await PPPSecretService.setProfileAndDisconnect(user.routerId, user.username, isolateProfileName);
    }

    // 2. SECONDARY: RADIUS ISOLATION (only if RADIUS mode enabled)
    if (isRadius) {
      // RADIUS ISOLATION
      // Keep password, remove Auth-Type Reject
    await prisma.$executeRaw`
      INSERT INTO radcheck (username, attribute, op, value)
      VALUES (${user.username}, 'Cleartext-Password', ':=', ${user.password})
      ON DUPLICATE KEY UPDATE value = ${user.password}
    `;

    await prisma.$executeRaw`
      DELETE FROM radcheck 
      WHERE username = ${user.username} 
        AND attribute = 'Auth-Type'
    `;

    // Set isolir group
    await prisma.$executeRaw`
      DELETE FROM radusergroup WHERE username = ${user.username}
    `;
    await prisma.$executeRaw`
      INSERT INTO radusergroup (username, groupname, priority)
      VALUES (${user.username}, 'isolir', 1)
    `;

    // Remove static IP
    await prisma.$executeRaw`
      DELETE FROM radreply 
      WHERE username = ${user.username} 
        AND attribute = 'Framed-IP-Address'
    `;

    // Disconnect
    try {
      const { disconnectPPPoEUser } = await import('@/server/services/radius/coa-handler.service');
      await disconnectPPPoEUser(user.username);
    } catch (err) {
      console.log('Disconnect failed, but isolation applied');
    }

      // Close session
      await prisma.$executeRaw`
        UPDATE radacct 
        SET acctstoptime = NOW(), 
            acctterminatecause = 'Admin-Isolate'
        WHERE username = ${user.username} 
          AND acctstoptime IS NULL
      `;
    } // end if isRadius

    return {
      success: true,
      message: `User ${username} isolated successfully`,
    };

  } catch (error: any) {
    console.error('[ISOLATE-USER] Error:', error);
    throw error;
  }
}
