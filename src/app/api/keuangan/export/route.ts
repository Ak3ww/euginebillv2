import { NextRequest, NextResponse } from "next/server";
import {
  generateExcelBuffer,
  generatePDFBuffer,
  getCompanyExportInfo,
  formatCurrencyExport,
  formatDateExport,
  ExcelColumnDef,
} from "@/lib/utils/export";
import { getServerSession } from "next-auth";
import { authOptions } from "@/server/auth/config";
import { startOfDayWIBtoUTC, endOfDayWIBtoUTC } from "@/lib/timezone";
import { prisma } from "@/server/db/client";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") || "excel"; // excel or pdf
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type"); // INCOME, EXPENSE, or all
    const categoryId = searchParams.get("categoryId");
    const routerId = searchParams.get("routerId");
    const search = searchParams.get("search");

    const where: any = {};

    if (startDate && endDate) {
      const startFilter = startOfDayWIBtoUTC(startDate);
      const endFilter = endOfDayWIBtoUTC(endDate);
      where.date = { gte: startFilter, lte: endFilter };
    }

    if (type && type !== "all") {
      where.type = type;
    }

    if (categoryId && categoryId !== "all") {
      where.categoryId = categoryId;
    }

    if (routerId && routerId !== "all") {
      where.routerId = routerId;
    }

    if (search) {
      where.OR = [
        { description: { contains: search } },
        { notes: { contains: search } },
        { reference: { contains: search } },
      ];
    }

    // Get transactions with category info
    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: true,
      },
      orderBy: {
        date: "desc",
      },
    });

    // Calculate totals
    const totalIncome = transactions
      .filter((t) => t.type === "INCOME")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpense = transactions
      .filter((t) => t.type === "EXPENSE")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const balance = totalIncome - totalExpense;

    // Fetch company info for branding & logo
    const companyInfo = await getCompanyExportInfo();

    const dateRangeStr =
      startDate && endDate ? `${startDate} s/d ${endDate}` : "Semua Periode";

    const filenameDate =
      startDate && endDate
        ? `${startDate}_to_${endDate}`
        : new Date().toISOString().split("T")[0];

    // ─────────────────────────────────────────────────────────────────────────
    // EXCEL EXPORT
    // ─────────────────────────────────────────────────────────────────────────
    if (format === "excel") {
      const columns: ExcelColumnDef[] = [
        { key: "no", header: "No.", width: 6, isNumber: true },
        { key: "tanggal", header: "Tanggal", width: 14, isDate: true },
        { key: "deskripsi", header: "Deskripsi Transaksi", width: 35 },
        { key: "kategori", header: "Kategori", width: 22 },
        { key: "tipe", header: "Jenis", width: 14 },
        { key: "jumlah", header: "Jumlah (Rp)", width: 20, isCurrency: true },
        { key: "referensi", header: "No. Referensi", width: 18 },
        { key: "catatan", header: "Catatan", width: 25 },
      ];

      const excelData = transactions.map((t, idx) => ({
        no: idx + 1,
        tanggal: formatDateExport(t.date),
        deskripsi: t.description || "-",
        kategori: t.category?.name || "Umum",
        tipe: t.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
        jumlah: Number(t.amount),
        referensi: t.reference || "-",
        catatan: t.notes || "-",
      }));

      const summaryMetrics = [
        { label: "Total Pemasukan", value: totalIncome },
        { label: "Total Pengeluaran", value: totalExpense },
        { label: "Saldo Bersih", value: balance },
        { label: "Total Transaksi", value: `${transactions.length} Transaksi` },
      ];

      const totalRow = {
        no: "",
        tanggal: "",
        deskripsi: "TOTAL KESELURUHAN",
        kategori: "",
        tipe: "",
        jumlah: balance,
        referensi: "",
        catatan: "",
      };

      const buffer = await generateExcelBuffer(
        excelData,
        columns,
        "Laporan Keuangan",
        {
          title: "LAPORAN KEUANGAN & TRANSAKSI",
          dateRange: dateRangeStr,
          summary: summaryMetrics,
          totalRow,
          companyInfo,
        }
      );

      return new NextResponse(Buffer.from(buffer), {
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="Laporan-Keuangan-${filenameDate}.xlsx"`,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PDF EXPORT
    // ─────────────────────────────────────────────────────────────────────────
    const pdfHeaders = [
      "No.",
      "Tanggal",
      "Deskripsi",
      "Kategori",
      "Jenis",
      "Jumlah (Rp)",
      "Referensi",
    ];

    const pdfRows = transactions.map((t, idx) => [
      idx + 1,
      formatDateExport(t.date),
      t.description || "-",
      t.category?.name || "Umum",
      t.type === "INCOME" ? "Pemasukan" : "Pengeluaran",
      formatCurrencyExport(Number(t.amount)),
      t.reference || "-",
    ]);

    const pdfSummary = [
      { label: "Pemasukan", value: formatCurrencyExport(totalIncome) },
      { label: "Pengeluaran", value: formatCurrencyExport(totalExpense) },
      { label: "Saldo Bersih", value: formatCurrencyExport(balance) },
      { label: "Total Data", value: `${transactions.length} Item` },
    ];

    const pdfTotalRow = [
      "",
      "",
      "TOTAL SALDO BERSIH",
      "",
      "",
      formatCurrencyExport(balance),
      "",
    ];

    const pdfBuffer = generatePDFBuffer(
      {
        title: "Laporan Keuangan & Transaksi",
        subtitle: dateRangeStr,
        filename: `Laporan-Keuangan-${filenameDate}.pdf`,
        orientation: "landscape",
        companyInfo,
      },
      pdfHeaders,
      pdfRows,
      pdfSummary,
      pdfTotalRow
    );

    return new NextResponse(Buffer.from(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Laporan-Keuangan-${filenameDate}.pdf"`,
      },
    });
  } catch (error) {
    console.error("[Keuangan Export] Error:", error);
    return NextResponse.json(
      { error: "Failed to export financial data" },
      { status: 500 }
    );
  }
}
