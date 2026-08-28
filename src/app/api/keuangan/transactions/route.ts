import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from "@/lib/timezone";
import { logActivity } from "@/server/services/activity-log.service";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/config";
import { prisma } from '@/server/db/client';

// GET - List transactions with filters & stats
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // INCOME, EXPENSE, or all
    const categoryId = searchParams.get("categoryId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const search = searchParams.get("search");
    const routerId = searchParams.get("routerId"); // Filter by Mikrotik/Router
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    // Prepare date filters
    let startFilter: Date | undefined;
    let endFilter: Date | undefined;
    if (startDate && endDate) {
      startFilter = startOfDayWIBtoUTC(startDate);
      endFilter = endOfDayWIBtoUTC(endDate);
    }

    // Auto-heal / Sync any paid invoices that were not recorded in transactions table
    try {
      let pppoeCategory = await prisma.transactionCategory.findFirst({
        where: { name: "Pembayaran PPPoE", type: "INCOME" },
      });
      if (!pppoeCategory) {
        pppoeCategory = await prisma.transactionCategory.findFirst({
          where: { type: "INCOME" },
        });
      }

      if (pppoeCategory) {
        const paidInvoices = await prisma.invoice.findMany({
          where: {
            status: "PAID",
            ...(startFilter && endFilter
              ? {
                  OR: [
                    { paidAt: { gte: startFilter, lte: endFilter } },
                    { dueDate: { gte: startFilter, lte: endFilter } },
                  ],
                }
              : {}),
          },
          include: {
            user: { select: { name: true, username: true, customerId: true, profile: { select: { name: true } } } },
          },
          take: 500,
        });

        if (paidInvoices.length > 0) {
          const invNumbers = paidInvoices.map(i => i.invoiceNumber).filter(Boolean);
          const allPossibleRefs = invNumbers.map(n => `INV-${n}`).concat(invNumbers);
          const existingTxs = await prisma.transaction.findMany({
            where: { reference: { in: allPossibleRefs } },
            select: { reference: true },
          });
          const existingRefSet = new Set(existingTxs.map(t => t.reference).filter(Boolean));

          for (const inv of paidInvoices) {
            const ref1 = `INV-${inv.invoiceNumber}`;
            const ref2 = inv.invoiceNumber;
            if (!existingRefSet.has(ref1) && !existingRefSet.has(ref2)) {
              const profileName = inv.user?.profile?.name || 'PPPoE';
              const custIdentifier = inv.user?.name || inv.user?.username || 'Pelanggan';
              const txDate = inv.paidAt || inv.dueDate || inv.createdAt || new Date();
              await prisma.transaction.create({
                data: {
                  id: nanoid(),
                  categoryId: pppoeCategory.id,
                  type: "INCOME",
                  amount: inv.amount,
                  description: `Pembayaran ${profileName} - ${custIdentifier}`,
                  date: txDate,
                  reference: ref1,
                  notes: 'Auto-sync dari tagihan lunas',
                },
              });
              existingRefSet.add(ref1);
            }
          }
        }
      }
    } catch (syncErr) {
      console.warn('[Keuangan] Auto-sync paid invoices warning:', syncErr);
    }

    // Build where clause
    const where: any = {};
    if (type && type !== "all") {
      where.type = type;
    }
    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId;
    }
    if (startFilter && endFilter) {
      where.date = {
        gte: startFilter,
        lte: endFilter,
      };
    }

    // Filter by Mikrotik/Router
    let routerConditions: any[] = [];
    if (routerId && routerId !== 'all') {
      const usersInRouter = await prisma.pppoeUser.findMany({
        where: { routerId },
        select: { id: true, username: true, customerId: true, name: true },
      });
      const userIds = usersInRouter.map(u => u.id);

      const invoicesInRouter = await prisma.invoice.findMany({
        where: {
          OR: [
            { user: { routerId } },
            ...(userIds.length > 0 ? [{ userId: { in: userIds } }] : []),
          ],
        },
        select: { invoiceNumber: true },
      });

      const invoiceNumbers = invoicesInRouter.map(i => i.invoiceNumber).filter(Boolean);
      const invoiceRefs = invoiceNumbers.map(n => `INV-${n}`).concat(invoiceNumbers);
      const usernames = usersInRouter.map(u => u.username).filter(Boolean);
      const customerIds = usersInRouter.map(u => u.customerId).filter(Boolean) as string[];
      const names = usersInRouter.map(u => u.name).filter(Boolean);

      if (invoiceRefs.length > 0) {
        routerConditions.push({ reference: { in: invoiceRefs } });
      }
      if (usernames.length > 0) {
        routerConditions.push({ reference: { in: usernames } });
      }
      for (const u of usernames) {
        routerConditions.push({ description: { contains: u } });
      }
      for (const cid of customerIds) {
        routerConditions.push({ description: { contains: cid } });
      }
      for (const nm of names) {
        if (nm && nm.length >= 3) {
          routerConditions.push({ description: { contains: nm } });
        }
      }

      if (routerConditions.length > 0) {
        where.OR = routerConditions;
      } else {
        where.id = 'no-match-empty-router';
      }
    }

    if (search) {
      const searchConditions = [
        { description: { contains: search } },
        { reference: { contains: search } },
        { notes: { contains: search } },
      ];
      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          { OR: searchConditions },
        ];
        delete where.OR;
      } else {
        where.OR = searchConditions;
      }
    }

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
      skip,
      take: limit,
    });

    const total = await prisma.transaction.count({ where });

    // Scoped where filters for stats (respects date, category, routerId, and search)
    const incomeStatsWhere: any = { ...where, type: "INCOME" };
    const expenseStatsWhere: any = { ...where, type: "EXPENSE" };

    const [incomeTotal, expenseTotal] = await Promise.all([
      prisma.transaction.aggregate({
        where: incomeStatsWhere,
        _sum: { amount: true },
        _count: true,
      }),
      prisma.transaction.aggregate({
        where: expenseStatsWhere,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    const totalIncome = incomeTotal._sum.amount || 0;
    const totalExpense = expenseTotal._sum.amount || 0;
    const balance = Number(totalIncome) - Number(totalExpense);
    const incomeCount = incomeTotal._count || 0;
    const expenseCount = expenseTotal._count || 0;

    // Get income breakdown by category (scoped to current filters)
    const [pppoeCategory, hotspotCategory, installCategory] = await Promise.all([
      prisma.transactionCategory.findFirst({ where: { name: "Pembayaran PPPoE", type: "INCOME" } }),
      prisma.transactionCategory.findFirst({ where: { name: "Pembayaran Hotspot", type: "INCOME" } }),
      prisma.transactionCategory.findFirst({ where: { name: "Biaya Instalasi", type: "INCOME" } }),
    ]);

    const [pppoeIncome, hotspotIncome, installIncome] = await Promise.all([
      pppoeCategory
        ? prisma.transaction.aggregate({
            where: { ...incomeStatsWhere, categoryId: pppoeCategory.id },
            _sum: { amount: true },
            _count: true,
          })
        : { _sum: { amount: 0 }, _count: 0 },
      hotspotCategory
        ? prisma.transaction.aggregate({
            where: { ...incomeStatsWhere, categoryId: hotspotCategory.id },
            _sum: { amount: true },
            _count: true,
          })
        : { _sum: { amount: 0 }, _count: 0 },
      installCategory
        ? prisma.transaction.aggregate({
            where: { ...incomeStatsWhere, categoryId: installCategory.id },
            _sum: { amount: true },
            _count: true,
          })
        : { _sum: { amount: 0 }, _count: 0 },
    ]);

    return NextResponse.json({
      success: true,
      transactions,
      total,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalIncome: Number(totalIncome),
        totalExpense: Number(totalExpense),
        balance,
        incomeCount,
        expenseCount,
        pppoeIncome: Number(pppoeIncome._sum.amount || 0),
        pppoeCount: pppoeIncome._count,
        hotspotIncome: Number(hotspotIncome._sum.amount || 0),
        hotspotCount: hotspotIncome._count,
        installIncome: Number(installIncome._sum.amount || 0),
        installCount: installIncome._count,
      },
    });
  } catch (error) {
    console.error("Get transactions error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch transactions" },
      { status: 500 },
    );
  }
}

// POST - Create new transaction
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { categoryId, type, amount, description, date, reference, notes } =
      body;

    if (!categoryId || !type || !amount || !description) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 },
      );
    }

    // Verify category exists
    const category = await prisma.transactionCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { success: false, error: "Category not found" },
        { status: 404 },
      );
    }

    // Create transaction
    const transaction = await prisma.transaction.create({
      data: {
        id: nanoid(),
        categoryId,
        type,
        amount: parseInt(amount),
        description,
        date: date ? new Date(date) : new Date(),
        reference: reference || null,
        notes: notes || null,
      },
      include: {
        category: true,
      },
    });

    // Log activity
    try {
      const session = await getServerSession(authOptions);
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: type === 'INCOME' ? 'ADD_INCOME' : 'ADD_EXPENSE',
        description: `${type}: ${description} - Rp ${parseInt(amount).toLocaleString('id-ID')}`,
        module: 'transaction',
        status: 'success',
        request,
        metadata: {
          transactionId: transaction.id,
          type,
          amount: parseInt(amount),
          categoryId,
          categoryName: category.name,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({
      success: true,
      message: "Transaction created successfully",
      transaction,
    });
  } catch (error) {
    console.error("Create transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create transaction" },
      { status: 500 },
    );
  }
}

// PUT - Update transaction
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      id,
      categoryId,
      type,
      amount,
      description,
      date,
      reference,
      notes,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID required" },
        { status: 400 },
      );
    }

    const transaction = await prisma.transaction.update({
      where: { id },
      data: {
        ...(categoryId && { categoryId }),
        ...(type && { type }),
        ...(amount && { amount: parseInt(amount) }),
        ...(description && { description }),
        ...(date && { date: new Date(date) }),
        ...(reference !== undefined && { reference }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        category: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Transaction updated successfully",
      transaction,
    });
  } catch (error) {
    console.error("Update transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

// DELETE - Delete transaction(s)
// Supports:
//   ?id=xxx            — single delete (existing)
//   ?ids=x,y,z         — bulk delete by IDs
//   ?filterDelete=true — delete all matching current filter (?type=&categoryId=&startDate=&endDate=)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const idsParam = searchParams.get("ids");
    const filterDelete = searchParams.get("filterDelete") === "true";

    // ── Bulk delete by IDs ────────────────────────────────────────────────
    if (idsParam) {
      const ids = idsParam.split(",").filter(Boolean);
      if (ids.length === 0) {
        return NextResponse.json({ success: false, error: "No IDs provided" }, { status: 400 });
      }
      const result = await prisma.transaction.deleteMany({ where: { id: { in: ids } } });
      return NextResponse.json({ success: true, message: `${result.count} transaksi dihapus`, count: result.count });
    }

    // ── Delete by filter ─────────────────────────────────────────────────
    if (filterDelete) {
      const type = searchParams.get("type");
      const categoryId = searchParams.get("categoryId");
      const startDate = searchParams.get("startDate");
      const endDate = searchParams.get("endDate");
      const search = searchParams.get("search");

      const where: any = {};
      if (type && type !== "all") where.type = type;
      if (categoryId && categoryId !== "all") where.categoryId = categoryId;
      if (startDate && endDate) {
        where.date = {
          gte: startOfDayWIBtoUTC(startDate),
          lte: endOfDayWIBtoUTC(endDate),
        };
      }
      if (search) {
        where.OR = [
          { description: { contains: search } },
          { reference: { contains: search } },
          { notes: { contains: search } },
        ];
      }

      const result = await prisma.transaction.deleteMany({ where });
      return NextResponse.json({ success: true, message: `${result.count} transaksi dihapus`, count: result.count });
    }

    // ── Single delete ─────────────────────────────────────────────────────
    if (!id) {
      return NextResponse.json(
        { success: false, error: "Transaction ID required" },
        { status: 400 },
      );
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaction not found" },
        { status: 404 },
      );
    }

    await prisma.transaction.delete({
      where: { id },
    });

    // Log activity
    try {
      await logActivity({
        userId: (session?.user as any)?.id,
        username: (session?.user as any)?.username || 'Admin',
        userRole: (session?.user as any)?.role,
        action: 'DELETE_TRANSACTION',
        description: `Deleted ${transaction.type}: ${transaction.description}`,
        module: 'transaction',
        status: 'success',
        request,
        metadata: {
          transactionId: id,
          type: transaction.type,
          amount: transaction.amount,
        },
      });
    } catch (logError) {
      console.error('Activity log error:', logError);
    }

    return NextResponse.json({
      success: true,
      message: "Transaction deleted successfully",
    });
  } catch (error) {
    console.error("Delete transaction error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
