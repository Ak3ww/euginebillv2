const { PrismaClient } = require('@prisma/client');
const { RouterOSAPI } = require('node-routeros');
const prisma = new PrismaClient();

const isDryRun = process.argv.includes('--dry-run');

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function cleanPhone(phone) {
  if (!phone) return '';
  let clean = phone.replace(/[^0-9]/g, '');
  if (clean.startsWith('6262')) clean = clean.slice(2);
  if (clean.startsWith('08')) clean = '628' + clean.slice(2);
  return clean;
}

function isDummyPhone(phone) {
  const c = cleanPhone(phone);
  return !c || c === '62812345678' || c.length < 9;
}

async function sendBaileysMessage(phone, message) {
  const cPhone = cleanPhone(phone);
  if (isDummyPhone(cPhone)) {
    return { success: false, skipped: true, error: 'Nomor telepon dummy atau tidak valid' };
  }

  try {
    const res = await fetch('http://127.0.0.1:4000/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: cPhone, message }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return { success: false, error: `HTTP ${res.status}: ${errText}` };
    }

    const data = await res.json();
    return { success: data.status !== false, data };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function isolateOnMikrotik(router, username, isolateProfileName = 'isolir') {
  if (!router) {
    return { success: false, reason: 'No router assigned' };
  }

  const api = new RouterOSAPI({
    host: router.ipAddress,
    port: router.port || 8728,
    user: router.username,
    password: router.password,
    timeout: 8,
  });

  // Suppress unhandled error events to avoid process crash on socket timeout
  api.on('error', (err) => {
    // console.warn(`[MikroTik Socket Error] ${err.message}`);
  });

  try {
    await api.connect();

    // 1. Update secret profile to isolate profile
    const secrets = await api.write('/ppp/secret/print', [`?name=${username}`]);
    let secretUpdated = false;
    if (secrets.length > 0) {
      await api.write('/ppp/secret/set', [
        `=.id=${secrets[0]['.id']}`,
        `=profile=${isolateProfileName}`,
      ]);
      secretUpdated = true;
    }

    // 2. Remove active session to force reconnect into isolated pool
    const active = await api.write('/ppp/active/print', [`?name=${username}`]);
    let kickedCount = 0;
    for (const s of active) {
      await api.write('/ppp/active/remove', [`=.id=${s['.id']}`]);
      kickedCount++;
    }

    return { success: true, secretFound: secrets.length > 0, secretUpdated, kickedCount };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    try {
      await api.close();
    } catch {}
  }
}

async function main() {
  console.log('====================================================');
  console.log(`BATCH ISOLATION & CONDITIONAL WA SENDER (Dry Run: ${isDryRun})`);
  console.log('====================================================');

  const now = new Date();
  const startOfToday = new Date('2026-09-07T00:00:00.000Z'); // 07:00 WIB today
  console.log('Execution Time (UTC):', now.toISOString());
  console.log('Start of Day (UTC):', startOfToday.toISOString());

  // Target users: expiredAt <= NOW, status is active, and have unpaid invoices (respect autoIsolationEnabled and exclude Kampung Tegal)
  const unpaidUsers = await prisma.pppoeUser.findMany({
    where: {
      expiredAt: { lte: now },
      status: { notIn: ['isolated', 'suspended', 'blocked', 'stop'] },
      autoIsolationEnabled: true,
      OR: [
        { areaId: null },
        {
          area: {
            name: {
              not: {
                contains: 'tegal'
              }
            }
          }
        }
      ]
    },
    include: {
      area: true,
      router: true,
      invoices: {
        where: { status: { in: ['PENDING', 'OVERDUE'] } },
        orderBy: { dueDate: 'asc' },
      },
    },
    orderBy: { username: 'asc' },
  });

  console.log(`\nFound ${unpaidUsers.length} user(s) matching criteria (expired + active + unpaid).\n`);

  if (unpaidUsers.length === 0) {
    console.log('No users to process.');
    await prisma.$disconnect();
    return;
  }

  const company = await prisma.company.findFirst();
  const isolateProfileName = company?.isolateProfileName || 'isolir';
  console.log('Company:', company?.name);
  console.log('Isolate Profile Name:', isolateProfileName);

  // Load active WA template
  const waTemplate = await prisma.isolationTemplate.findFirst({
    where: { type: 'whatsapp', isActive: true }
  }).catch(() => null);
  console.log('WA Template loaded:', waTemplate ? waTemplate.name : 'Default message');

  let dbSuccessCount = 0;
  let mtSuccessCount = 0;
  let waSentCount = 0;
  let waSkippedAlreadySentCount = 0;
  let waSkippedDummyCount = 0;
  let failCount = 0;

  for (let i = 0; i < unpaidUsers.length; i++) {
    const user = unpaidUsers[i];
    const cPhone = cleanPhone(user.phone);
    const dummy = isDummyPhone(user.phone);

    console.log(`\n----------------------------------------------------`);
    console.log(`[${i + 1}/${unpaidUsers.length}] Processing: ${user.username} (${user.name})`);
    console.log(`Phone: ${user.phone || '-'} (Clean: ${cPhone || '-'}) | Area: ${user.area?.name || '-'}`);
    console.log(`ExpiredAt: ${user.expiredAt ? user.expiredAt.toISOString() : '-'} | autoIso: ${user.autoIsolationEnabled}`);
    console.log(`Router: ${user.router ? user.router.name + ' (' + user.router.ipAddress + ')' : 'None'}`);
    console.log(`Unpaid Invoices (${user.invoices.length}): ${user.invoices.map(inv => `${inv.invoiceNumber} [${inv.status}] Rp ${inv.amount}`).join(', ')}`);

    // Check if WA already sent today to this phone
    let waSentToday = false;
    let lastWaTime = null;
    if (!dummy) {
      const waLog = await prisma.whatsapp_history.findFirst({
        where: {
          phone: cPhone,
          status: 'sent',
          sentAt: { gte: startOfToday },
        },
        orderBy: { sentAt: 'desc' }
      });
      if (waLog) {
        waSentToday = true;
        lastWaTime = waLog.sentAt;
      }
    }

    if (isDryRun) {
      console.log(`[DRY-RUN] Would isolate DB & MikroTik.`);
      if (dummy) {
        console.log(`[DRY-RUN] WA: Skipped (Dummy/No Phone)`);
      } else if (waSentToday) {
        console.log(`[DRY-RUN] WA: Skipped (Already sent today at ${lastWaTime?.toISOString()})`);
      } else {
        console.log(`[DRY-RUN] WA: Would send notification`);
      }
      continue;
    }

    try {
      // 1. Update DB: Set status to isolated
      await prisma.pppoeUser.update({
        where: { id: user.id },
        data: {
          status: 'isolated',
        },
      });
      dbSuccessCount++;
      console.log(`✓ DB: Status updated to 'isolated'`);

      // 2. Direct MikroTik isolation
      if (user.router) {
        const mtRes = await isolateOnMikrotik(user.router, user.username, isolateProfileName);
        if (mtRes.success) {
          mtSuccessCount++;
          if (mtRes.secretUpdated) {
            console.log(`✓ MikroTik: Secret profile changed to '${isolateProfileName}'`);
          } else {
            console.warn(`⚠️ MikroTik: Secret ${user.username} not found on router`);
          }
          if (mtRes.kickedCount > 0) {
            console.log(`✓ MikroTik: Kicked ${mtRes.kickedCount} active session(s)`);
          } else {
            console.log(`ℹ️ MikroTik: No active session was running`);
          }
        } else {
          console.warn(`⚠️ MikroTik: Isolation failed: ${mtRes.error || mtRes.reason}`);
        }
      } else {
        console.warn(`⚠️ MikroTik: Skipped (No router configured)`);
      }

      // 3. Conditional WhatsApp Notification
      if (dummy) {
        waSkippedDummyCount++;
        console.log(`ℹ️ WA: Skipped (Dummy/Invalid phone: ${user.phone})`);
      } else if (waSentToday) {
        waSkippedAlreadySentCount++;
        console.log(`ℹ️ WA: Skipped (Already sent today at ${lastWaTime?.toISOString()})`);
      } else {
        // Send WhatsApp notification
        const earliestUnpaid = user.invoices[0];
        const rawBaseUrl = company?.baseUrl || 'https://euginemediagroup.com';
        const baseUrl = rawBaseUrl.startsWith('http') ? rawBaseUrl : `https://${rawBaseUrl}`;
        const paymentLink = earliestUnpaid?.paymentToken
          ? `${baseUrl}/pay/${earliestUnpaid.paymentToken}`
          : `${baseUrl}/isolated?username=${encodeURIComponent(user.username)}`;
        const isolatedUrl = `${baseUrl}/isolated?username=${encodeURIComponent(user.username)}`;
        const appDownloadUrl = `${baseUrl}/download-app`;
        const expiredDate = user.expiredAt
          ? new Date(user.expiredAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' })
          : '-';
        const totalUnpaidFormatted = earliestUnpaid?.amount
          ? `Rp ${earliestUnpaid.amount.toLocaleString('id-ID')}`
          : '-';

        const realCustomerId = user.customerId || user.pppoeCustomerId || user.username;

        const templateVars = {
          customerName: user.name || user.username,
          username: user.username,
          customerId: realCustomerId,
          phoneNumber: user.phone || '-',
          expiredDate,
          gracePeriodEnd: expiredDate,
          rateLimit: '64k/64k',
          totalUnpaid: totalUnpaidFormatted,
          paymentLink,
          isolatedUrl,
          qrCode: paymentLink,
          qrCodeImage: paymentLink,
          companyName: company?.name || 'EUGINE MEDIA GROUP',
          companyPhone: company?.phone || '',
          companyWhatsapp: company?.phone || '',
          companyEmail: company?.email || '',
          companyWebsite: baseUrl,
          link_download_aplikasi: appDownloadUrl,
          link_download_apk: appDownloadUrl,
          appDownloadLink: appDownloadUrl,
        };

        let message = waTemplate?.message;
        if (message) {
          for (const [k, v] of Object.entries(templateVars)) {
            message = message.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'gi'), v);
            message = message.replace(new RegExp(`\\{${k}\\}`, 'gi'), v);
          }
        } else {
          message = `⚠️ *Layanan Internet Diisolir*\n\nHalo ${templateVars.customerName},\n\nAkun internet Anda (*${realCustomerId}*) telah diisolir karena masa berlangganan habis.\n\n📅 Expired: ${expiredDate}\nTotal Tagihan: ${totalUnpaidFormatted}\n\nUntuk mengaktifkan kembali, buka halaman berikut dan lakukan pembayaran:\n🔗 ${paymentLink}\n\nButuh bantuan?\n📞 ${company?.phone || '-'}\n\nTerima kasih,\n*${company?.name || 'EUGINE MEDIA GROUP'}*`;
        }

        const waRes = await sendBaileysMessage(user.phone, message);
        if (waRes.success) {
          waSentCount++;
          console.log(`✓ WA: Sent successfully to ${user.phone}`);
          await prisma.whatsapp_history.create({
            data: {
              id: require('crypto').randomUUID(),
              phone: cPhone,
              message,
              status: 'sent',
              response: JSON.stringify(waRes.data),
              providerName: 'HAPE ADMIN',
              providerType: 'baileys',
            },
          }).catch(() => {});
        } else {
          console.warn(`⚠️ WA: Failed for ${user.phone}: ${waRes.error}`);
          await prisma.whatsapp_history.create({
            data: {
              id: require('crypto').randomUUID(),
              phone: cPhone,
              message,
              status: 'failed',
              response: JSON.stringify({ error: waRes.error }),
              providerName: 'HAPE ADMIN',
              providerType: 'baileys',
            },
          }).catch(() => {});
        }

        // Anti-spam delay only after actual WA HTTP send
        await sleep(1500);
      }

      // 4. Log activity
      await prisma.activityLog.create({
        data: {
          userId: user.id,
          username: user.username,
          userRole: 'system',
          action: 'ISOLATED',
          description: `User ${user.username} isolated via batch execution (expired ${user.expiredAt?.toISOString() || '-'})`,
          module: 'isolation',
          status: 'success',
          ipAddress: 'system',
        },
      }).catch(() => {});

      // Short delay between users
      await sleep(300);

    } catch (err) {
      console.error(`❌ Failed to process ${user.username}:`, err.message);
      failCount++;
    }
  }

  console.log('\n====================================================');
  console.log(`EXECUTION SUMMARY: Total Target: ${unpaidUsers.length}`);
  console.log(`- DB Updated to Isolated: ${dbSuccessCount}`);
  console.log(`- MikroTik Profile Swapped & Kicked: ${mtSuccessCount}`);
  console.log(`- WA Sent: ${waSentCount}`);
  console.log(`- WA Skipped (Already Sent Today): ${waSkippedAlreadySentCount}`);
  console.log(`- WA Skipped (Dummy/Invalid Phone): ${waSkippedDummyCount}`);
  console.log(`- Failed: ${failCount}`);
  console.log('====================================================');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
