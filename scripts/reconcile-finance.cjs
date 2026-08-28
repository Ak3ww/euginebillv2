'use strict';
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const crypto = require('crypto');

function generateId() {
  return crypto.randomBytes(12).toString('hex');
}

async function main() {
  console.log('=== STARTING COMPLETE FINANCIAL DATABASE RECONCILIATION ===');

  // 1. Re-link Invoices with missing userId
  const unlinkedInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { userId: null },
        { userId: '' },
      ],
    },
    select: { id: true, invoiceNumber: true, customerUsername: true, customerName: true },
  });

  console.log(`Found ${unlinkedInvoices.length} unlinked invoices`);
  let reLinkedCount = 0;
  if (unlinkedInvoices.length > 0) {
    const allUsers = await prisma.pppoeUser.findMany({
      select: { id: true, username: true, name: true, phone: true, routerId: true },
    });
    const userMap = new Map(allUsers.map(u => [u.username.toLowerCase(), u]));

    for (const inv of unlinkedInvoices) {
      if (inv.customerUsername) {
        const u = userMap.get(inv.customerUsername.toLowerCase());
        if (u) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              userId: u.id,
              customerName: inv.customerName || u.name,
              customerPhone: u.phone,
            },
          });
          reLinkedCount++;
        }
      }
    }
  }
  console.log(`[1] Re-linked ${reLinkedCount} invoices to PPPoE users`);

  // 2. Re-link PPPoE Users missing routerId
  const defaultRouter = await prisma.router.findFirst({
    where: { isActive: true },
    orderBy: { createdAt: 'asc' },
  });

  let usersUpdatedRouter = 0;
  if (defaultRouter) {
    const usersWithoutRouter = await prisma.pppoeUser.findMany({
      where: {
        OR: [
          { routerId: null },
          { routerId: '' },
        ],
      },
      include: { area: { select: { routerId: true } } },
    });

    for (const u of usersWithoutRouter) {
      const targetRouterId = u.area?.routerId || defaultRouter.id;
      await prisma.pppoeUser.update({
        where: { id: u.id },
        data: { routerId: targetRouterId },
      });
      usersUpdatedRouter++;
    }
  }
  console.log(`[2] Assigned routerId to ${usersUpdatedRouter} PPPoE users`);

  // 3. Fix Paid Invoices with missing paidAt
  const paidWithoutPaidAt = await prisma.invoice.findMany({
    where: {
      status: 'PAID',
      paidAt: null,
    },
    select: { id: true, updatedAt: true, dueDate: true, createdAt: true },
  });

  for (const inv of paidWithoutPaidAt) {
    const fallbackDate = inv.updatedAt || inv.dueDate || inv.createdAt || new Date();
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { paidAt: fallbackDate },
    });
  }
  console.log(`[3] Fixed ${paidWithoutPaidAt.length} paid invoices missing paidAt`);

  // 4. Ensure Category 'Pembayaran PPPoE'
  let pppoeCategory = await prisma.transactionCategory.findFirst({
    where: { name: 'Pembayaran PPPoE', type: 'INCOME' },
  });
  if (!pppoeCategory) {
    pppoeCategory = await prisma.transactionCategory.findFirst({
      where: { type: 'INCOME' },
    });
  }
  if (!pppoeCategory) {
    pppoeCategory = await prisma.transactionCategory.create({
      data: {
        id: generateId(),
        name: 'Pembayaran PPPoE',
        type: 'INCOME',
        description: 'Pendapatan langganan PPPoE',
      },
    });
  }

  // 5. Reconcile Transactions with Invoices
  const allPaidInvoices = await prisma.invoice.findMany({
    where: { status: 'PAID' },
    include: {
      user: { select: { name: true, username: true, profile: { select: { name: true } } } },
    },
  });

  const allIncomeTxs = await prisma.transaction.findMany({
    where: { type: 'INCOME' },
    select: { id: true, reference: true, date: true, amount: true },
  });

  const txMap = new Map();
  const dupIds = [];
  for (const tx of allIncomeTxs) {
    if (tx.reference) {
      if (txMap.has(tx.reference)) {
        dupIds.push(tx.id);
      } else {
        txMap.set(tx.reference, tx);
      }
    }
  }

  if (dupIds.length > 0) {
    await prisma.transaction.deleteMany({
      where: { id: { in: dupIds } },
    });
    console.log(`[4] Deleted ${dupIds.length} duplicate transactions`);
  }

  let createdTxs = 0;
  let updatedDateTxs = 0;

  for (const inv of allPaidInvoices) {
    const ref1 = `INV-${inv.invoiceNumber}`;
    const ref2 = inv.invoiceNumber;
    const existing = txMap.get(ref1) || txMap.get(ref2);
    const pDate = inv.paidAt || inv.updatedAt || inv.dueDate || inv.createdAt;

    if (!existing) {
      const pName = inv.user?.profile?.name || 'PPPoE';
      const cName = inv.user?.name || inv.customerName || inv.customerUsername || 'Pelanggan';
      await prisma.transaction.create({
        data: {
          id: generateId(),
          categoryId: pppoeCategory.id,
          type: 'INCOME',
          amount: inv.amount,
          description: `Pembayaran ${pName} - ${cName}`,
          reference: ref1,
          notes: 'Auto-reconciled from paid invoice',
          date: pDate,
        },
      });
      createdTxs++;
    } else {
      if (existing.date.toISOString().substring(0, 7) !== pDate.toISOString().substring(0, 7)) {
        await prisma.transaction.update({
          where: { id: existing.id },
          data: { date: pDate },
        });
        updatedDateTxs++;
      }
    }
  }

  console.log(`[5] Created ${createdTxs} missing transactions`);
  console.log(`[6] Updated ${updatedDateTxs} transaction dates`);
  console.log('=== DATABASE RECONCILIATION COMPLETED SUCCESSFULLY ===');
}

main().catch(console.error).finally(() => prisma.$disconnect());
