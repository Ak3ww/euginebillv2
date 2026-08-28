import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/config";
import { prisma } from "@/server/db/client";
import { nanoid } from "nanoid";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const logs: string[] = [];

    // ── 1. Re-link Invoices with missing userId ──────────────────────────────
    const unlinkedInvoices = await prisma.invoice.findMany({
      where: {
        OR: [
          { userId: null },
          { userId: "" },
        ],
      },
      select: { id: true, invoiceNumber: true, customerUsername: true, customerName: true },
    });

    let reLinkedInvoicesCount = 0;
    if (unlinkedInvoices.length > 0) {
      const allUsers = await prisma.pppoeUser.findMany({
        select: { id: true, username: true, name: true, phone: true, routerId: true },
      });
      const userByUsername = new Map(allUsers.map((u) => [u.username.toLowerCase(), u]));

      for (const inv of unlinkedInvoices) {
        if (inv.customerUsername) {
          const matchedUser = userByUsername.get(inv.customerUsername.toLowerCase());
          if (matchedUser) {
            await prisma.invoice.update({
              where: { id: inv.id },
              data: {
                userId: matchedUser.id,
                customerName: inv.customerName || matchedUser.name,
                customerPhone: matchedUser.phone,
              },
            });
            reLinkedInvoicesCount++;
          }
        }
      }
    }
    logs.push(`Re-linked ${reLinkedInvoicesCount} unlinked invoices to PPPoE users`);

    // ── 2. Re-link PPPoE Users with missing routerId ─────────────────────────
    const defaultRouter = await prisma.router.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    let usersUpdatedRouterCount = 0;
    if (defaultRouter) {
      const usersWithoutRouter = await prisma.pppoeUser.findMany({
        where: {
          OR: [
            { routerId: null },
            { routerId: "" },
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
        usersUpdatedRouterCount++;
      }
    }
    logs.push(`Assigned routerId to ${usersUpdatedRouterCount} PPPoE users`);

    // ── 3. Fix Paid Invoices with missing paidAt ─────────────────────────────
    const paidInvoicesWithoutPaidAt = await prisma.invoice.findMany({
      where: {
        status: "PAID",
        paidAt: null,
      },
      select: { id: true, updatedAt: true, dueDate: true, createdAt: true },
    });

    for (const inv of paidInvoicesWithoutPaidAt) {
      const fallbackDate = inv.updatedAt || inv.dueDate || inv.createdAt || new Date();
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { paidAt: fallbackDate },
      });
    }
    logs.push(`Fixed ${paidInvoicesWithoutPaidAt.length} paid invoices missing paidAt timestamp`);

    // ── 4. Ensure Category 'Pembayaran PPPoE' Exists ─────────────────────────
    let pppoeCategory = await prisma.transactionCategory.findFirst({
      where: { name: "Pembayaran PPPoE", type: "INCOME" },
    });
    if (!pppoeCategory) {
      pppoeCategory = await prisma.transactionCategory.findFirst({
        where: { type: "INCOME" },
      });
    }
    if (!pppoeCategory) {
      pppoeCategory = await prisma.transactionCategory.create({
        data: {
          id: nanoid(),
          name: "Pembayaran PPPoE",
          type: "INCOME",
          description: "Pendapatan dari langganan PPPoE bulanan",
        },
      });
    }

    // ── 5. Reconcile Transactions with Paid Invoices ─────────────────────────
    const allPaidInvoices = await prisma.invoice.findMany({
      where: { status: "PAID" },
      include: {
        user: { select: { name: true, username: true, profile: { select: { name: true } } } },
      },
    });

    const allIncomeTransactions = await prisma.transaction.findMany({
      where: { type: "INCOME" },
      select: { id: true, reference: true, date: true, amount: true },
    });

    const txMapByRef = new Map<string, typeof allIncomeTransactions[0]>();
    const duplicateTxIds: string[] = [];

    for (const tx of allIncomeTransactions) {
      if (tx.reference) {
        if (txMapByRef.has(tx.reference)) {
          duplicateTxIds.push(tx.id);
        } else {
          txMapByRef.set(tx.reference, tx);
        }
      }
    }

    // Remove duplicates
    if (duplicateTxIds.length > 0) {
      await prisma.transaction.deleteMany({
        where: { id: { in: duplicateTxIds } },
      });
      logs.push(`Deleted ${duplicateTxIds.length} duplicate transactions`);
    }

    let syncedTxCount = 0;
    let updatedTxDateCount = 0;

    for (const inv of allPaidInvoices) {
      const ref1 = `INV-${inv.invoiceNumber}`;
      const ref2 = inv.invoiceNumber;
      const existingTx = txMapByRef.get(ref1) || txMapByRef.get(ref2);
      const paymentDate = inv.paidAt || inv.updatedAt || inv.dueDate || inv.createdAt;

      if (!existingTx) {
        // Insert missing transaction
        const profileName = inv.user?.profile?.name || "PPPoE";
        const customerName = inv.user?.name || inv.customerName || inv.customerUsername || "Pelanggan";
        await prisma.transaction.create({
          data: {
            id: nanoid(),
            categoryId: pppoeCategory.id,
            type: "INCOME",
            amount: inv.amount,
            description: `Pembayaran ${profileName} - ${customerName}`,
            reference: ref1,
            notes: "Rekonsiliasi database tagihan lunas",
            date: paymentDate,
          },
        });
        syncedTxCount++;
      } else {
        // Ensure transaction date matches invoice payment date
        if (existingTx.date.toISOString().substring(0, 7) !== paymentDate.toISOString().substring(0, 7)) {
          await prisma.transaction.update({
            where: { id: existingTx.id },
            data: { date: paymentDate },
          });
          updatedTxDateCount++;
        }
      }
    }

    logs.push(`Synced ${syncedTxCount} new transactions from paid invoices`);
    logs.push(`Updated ${updatedTxDateCount} transaction dates to match payment timestamps`);

    return NextResponse.json({
      success: true,
      message: "Rekonsiliasi database keuangan selesai",
      logs,
      summary: {
        reLinkedInvoices: reLinkedInvoicesCount,
        usersAssignedRouter: usersUpdatedRouterCount,
        paidInvoicesFixed: paidInvoicesWithoutPaidAt.length,
        duplicatesRemoved: duplicateTxIds.length,
        transactionsCreated: syncedTxCount,
        transactionsUpdated: updatedTxDateCount,
      },
    });
  } catch (error: any) {
    console.error("[Repair Finance Database Error]:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to repair finance database" },
      { status: 500 }
    );
  }
}
