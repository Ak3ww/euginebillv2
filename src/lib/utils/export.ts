import ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatWIB } from '@/lib/timezone';
import { formatInTimeZone } from 'date-fns-tz';
import fs from 'fs';
import path from 'path';
import { prisma } from '@/server/db/client';

export interface CompanyExportInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  logo?: string;
}

export interface ExportOptions {
  title: string;
  subtitle?: string;
  filename: string;
  dateRange?: { start: string; end: string };
  orientation?: 'portrait' | 'landscape';
  companyInfo?: CompanyExportInfo;
}

/**
 * Fetch company information and resolve logo to base64 Data URI for server-side PDF generation.
 */
export async function getCompanyExportInfo(): Promise<CompanyExportInfo> {
  try {
    const company = await prisma.company.findFirst({
      select: { name: true, address: true, phone: true, email: true, logo: true }
    });
    if (company) {
      let logoBase64: string | undefined = undefined;
      if (company.logo) {
        if (company.logo.startsWith('data:image/')) {
          logoBase64 = company.logo;
        } else {
          try {
            let cleanPath = company.logo.startsWith('/') ? company.logo.slice(1) : company.logo;
            const fullPath = path.join(process.cwd(), 'public', cleanPath);
            if (fs.existsSync(fullPath)) {
              const buffer = fs.readFileSync(fullPath);
              const ext = path.extname(fullPath).toLowerCase().replace('.', '');
              const mime = ext === 'jpg' || ext === 'jpeg' ? 'jpeg' : ext === 'svg' ? 'svg+xml' : 'png';
              logoBase64 = `data:image/${mime};base64,${buffer.toString('base64')}`;
            }
          } catch (e) {
            console.error('[Export] Error reading logo file:', e);
          }
        }
      }
      return {
        name: company.name || 'EugineBill RADIUS',
        address: company.address || undefined,
        phone: company.phone || undefined,
        email: company.email || undefined,
        logo: logoBase64,
      };
    }
  } catch (e) {
    console.error('[Export] Error fetching company info:', e);
  }
  return { name: 'EugineBill RADIUS' };
}

export function formatCurrencyExport(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) || 0 : amount;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(num);
}

export function formatDateExport(date: Date | string | null | undefined, format: 'short' | 'long' = 'short'): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  if (format === 'short') {
    return formatWIB(d, 'dd/MM/yyyy');
  }
  return formatWIB(d, 'dd MMMM yyyy');
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function generateCSV(
  data: Record<string, unknown>[],
  columns: { key: string; header: string }[]
): string {
  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(item => 
    columns.map(col => {
      const val = item[col.key];
      if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
        return `"${val.replace(/"/g, '""')}"`;
      }
      return val ?? '';
    }).join(',')
  );
  return [headers, ...rows].join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE EXCEL GENERATOR (ExcelJS)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExcelColumnDef {
  key: string;
  header: string;
  width?: number;
  isCurrency?: boolean;
  isNumber?: boolean;
  isDate?: boolean;
}

export interface ExcelExportOptions {
  title?: string;
  subtitle?: string;
  dateRange?: string;
  summary?: { label: string; value: string | number }[];
  totalRow?: Record<string, unknown>;
  sheetName?: string;
  companyInfo?: CompanyExportInfo;
}

export async function generateExcelBuffer(
  data: Record<string, unknown>[],
  columns: ExcelColumnDef[],
  sheetName: string = 'Sheet1',
  options?: ExcelExportOptions
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = options?.companyInfo?.name || 'EugineBill RADIUS';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  const companyName = options?.companyInfo?.name || 'EugineBill RADIUS';
  const title = options?.title || sheetName;
  const totalCols = columns.length;

  let currentRowIndex = 1;

  // 1. Title Banner
  worksheet.mergeCells(1, 1, 1, Math.max(totalCols, 4));
  const titleCell = worksheet.getCell(1, 1);
  titleCell.value = `${companyName.toUpperCase()} — ${title}`;
  titleCell.font = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002C60' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(1).height = 36;
  currentRowIndex++;

  // 2. Subtitle / Metadata Row
  let metaText = `Dicetak: ${formatInTimeZone(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm')} WIB | Total: ${data.length} Data`;
  if (options?.dateRange) {
    metaText = `Periode: ${options.dateRange} | ${metaText}`;
  }
  if (options?.subtitle) {
    metaText = `${options.subtitle} | ${metaText}`;
  }

  worksheet.mergeCells(2, 1, 2, Math.max(totalCols, 4));
  const metaCell = worksheet.getCell(2, 1);
  metaCell.value = metaText;
  metaCell.font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF475569' } };
  metaCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  worksheet.getRow(2).height = 20;
  currentRowIndex++;

  // 3. Summary Cards (if available)
  if (options?.summary && options.summary.length > 0) {
    currentRowIndex++; // Blank line
    const summaryStartRow = currentRowIndex;
    worksheet.getRow(summaryStartRow).height = 28;

    options.summary.forEach((item, idx) => {
      const colIdx = (idx * 2) + 1;
      if (colIdx <= totalCols) {
        const labelCell = worksheet.getCell(summaryStartRow, colIdx);
        labelCell.value = item.label;
        labelCell.font = { name: 'Segoe UI', size: 9, bold: true, color: { argb: 'FF1E293B' } };
        labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
        labelCell.alignment = { vertical: 'middle', horizontal: 'center' };

        const valCell = worksheet.getCell(summaryStartRow, colIdx + 1);
        valCell.value = typeof item.value === 'number' ? item.value : String(item.value);
        valCell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002C60' } };
        if (typeof item.value === 'number') {
          valCell.numFmt = '"Rp "#,##0';
        }
        valCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
        valCell.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    });
    currentRowIndex++;
  }

  currentRowIndex++; // Blank row before table

  // 4. Table Header Row
  const headerRowIndex = currentRowIndex;
  const headerRow = worksheet.getRow(headerRowIndex);
  headerRow.height = 26;

  columns.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1B437C' } };
    cell.alignment = {
      vertical: 'middle',
      horizontal: col.isCurrency || col.isNumber ? 'right' : col.isDate ? 'center' : 'left',
      wrapText: true
    };
    cell.border = {
      top: { style: 'medium', color: { argb: 'FF002C60' } },
      bottom: { style: 'medium', color: { argb: 'FF002C60' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } },
    };
  });
  currentRowIndex++;

  // 5. Data Rows
  data.forEach((item, rIdx) => {
    const row = worksheet.getRow(currentRowIndex);
    row.height = 20;
    const isAlt = rIdx % 2 === 1;

    columns.forEach((col, cIdx) => {
      const cell = row.getCell(cIdx + 1);
      const rawVal = item[col.key];

      if (col.isCurrency || (typeof rawVal === 'number' && (col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('harga') || col.key.toLowerCase().includes('jumlah') || col.key.toLowerCase().includes('saldo')))) {
        cell.value = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal)) || 0;
        cell.numFmt = '"Rp "#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else if (col.isNumber || typeof rawVal === 'number') {
        cell.value = Number(rawVal);
        cell.numFmt = '#,##0';
        cell.alignment = { vertical: 'middle', horizontal: 'right' };
      } else {
        cell.value = rawVal !== undefined && rawVal !== null ? String(rawVal) : '-';
        cell.alignment = {
          vertical: 'middle',
          horizontal: col.isDate || col.key.toLowerCase().includes('status') || col.key.toLowerCase().includes('tanggal') || col.key.toLowerCase().includes('date') ? 'center' : 'left'
        };
      }

      cell.font = { name: 'Segoe UI', size: 9.5, color: { argb: 'FF1E293B' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isAlt ? 'FFF8FAFC' : 'FFFFFFFF' }
      };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });

    currentRowIndex++;
  });

  // 6. Total / Summary Row at Bottom
  if (options?.totalRow) {
    const totalRowObj = options.totalRow;
    const tRow = worksheet.getRow(currentRowIndex);
    tRow.height = 24;

    columns.forEach((col, cIdx) => {
      const cell = tRow.getCell(cIdx + 1);
      const rawVal = totalRowObj[col.key];

      if (rawVal !== undefined && rawVal !== null) {
        if (typeof rawVal === 'number') {
          cell.value = rawVal;
          if (col.isCurrency || col.key.toLowerCase().includes('amount') || col.key.toLowerCase().includes('harga') || col.key.toLowerCase().includes('jumlah') || col.key.toLowerCase().includes('saldo')) {
            cell.numFmt = '"Rp "#,##0';
          } else {
            cell.numFmt = '#,##0';
          }
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
        } else {
          cell.value = String(rawVal);
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      } else {
        cell.value = cIdx === 0 ? 'TOTAL' : '';
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF002C60' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0F2FE' } };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF0284C7' } },
        bottom: { style: 'double', color: { argb: 'FF0284C7' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
    });
  }

  // Auto-calculate column widths
  columns.forEach((col, idx) => {
    let maxLen = col.header.length;
    data.forEach(item => {
      const val = item[col.key];
      if (val !== undefined && val !== null) {
        const len = String(val).length;
        if (len > maxLen) maxLen = len;
      }
    });
    const worksheetCol = worksheet.getColumn(idx + 1);
    worksheetCol.width = col.width || Math.min(Math.max(maxLen + 4, 12), 45);
  });

  // Freeze Header
  worksheet.views = [
    { state: 'frozen', xSplit: 0, ySplit: headerRowIndex, activeCell: 'A' + (headerRowIndex + 1) }
  ];

  // Enable AutoFilter
  worksheet.autoFilter = {
    from: { row: headerRowIndex, column: 1 },
    to: { row: headerRowIndex, column: totalCols }
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTERPRISE PDF GENERATOR (jsPDF + autoTable)
// ─────────────────────────────────────────────────────────────────────────────

export interface PDFTableData {
  title: string;
  subtitle?: string;
  dateRange?: string;
  generatedAt: string;
  headers: string[];
  rows: (string | number)[][];
  summary?: { label: string; value: string }[];
  totalRow?: (string | number)[];
}

export function generatePDFBuffer(
  options: ExportOptions,
  headers: string[],
  rows: (string | number)[][],
  summary?: { label: string; value: string }[],
  totalRow?: (string | number)[]
): Uint8Array {
  const orientation = options.orientation || (headers.length > 7 ? 'landscape' : 'portrait');
  const doc = new jsPDF({
    orientation,
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  let yPos = margin;
  const company = options.companyInfo || { name: 'EugineBill RADIUS' };

  // 1. Company Logo & Header Block
  if (company.logo) {
    try {
      doc.addImage(company.logo, 'PNG', margin, yPos, 22, 22);
    } catch (e) {
      try {
        doc.addImage(company.logo, 'JPEG', margin, yPos, 22, 22);
      } catch (err) {
        console.error('[PDF] Failed to add logo image to PDF:', err);
      }
    }
  }

  const logoOffset = company.logo ? 26 : 0;
  const companyX = margin + logoOffset;

  // Company Name
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96); // Oceanic Blue (#002C60)
  doc.text(company.name, companyX, yPos + 5);

  // Address & Contact Info
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);

  let contactLine = '';
  if (company.address) contactLine += company.address;
  if (company.phone) contactLine += (contactLine ? ' | Tel: ' : 'Tel: ') + company.phone;
  if (company.email) contactLine += (contactLine ? ' | Email: ' : 'Email: ') + company.email;

  if (contactLine) {
    const lines = doc.splitTextToSize(contactLine, pageWidth - margin - companyX - 60);
    doc.text(lines, companyX, yPos + 10);
  }

  // Report Title & Date Range (Top Right)
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96);
  doc.text(options.title.toUpperCase(), pageWidth - margin, yPos + 5, { align: 'right' });

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);

  let subRightText = '';
  if (options.dateRange) {
    subRightText = `Periode: ${formatDateExport(options.dateRange.start)} s/d ${formatDateExport(options.dateRange.end)}`;
  } else if (options.subtitle) {
    subRightText = options.subtitle;
  }
  if (subRightText) {
    doc.text(subRightText, pageWidth - margin, yPos + 10, { align: 'right' });
  }

  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const printedAt = `Dicetak: ${formatInTimeZone(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm')} WIB`;
  doc.text(printedAt, pageWidth - margin, yPos + 15, { align: 'right' });

  yPos += Math.max(24, company.logo ? 24 : 18);

  // Divider Bar
  doc.setDrawColor(0, 44, 96);
  doc.setLineWidth(0.75);
  doc.line(margin, yPos, pageWidth - margin, yPos);

  doc.setDrawColor(27, 67, 124);
  doc.setLineWidth(0.25);
  doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);

  yPos += 5;

  // 2. Summary Box Cards (if provided)
  if (summary && summary.length > 0) {
    const boxHeight = 14;
    const boxWidth = (pageWidth - (margin * 2) - ((summary.length - 1) * 3)) / summary.length;

    summary.forEach((item, idx) => {
      const boxX = margin + (idx * (boxWidth + 3));

      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(boxX, yPos, boxWidth, boxHeight, 1.5, 1.5, 'FD');

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(100, 116, 139);
      doc.text(item.label.toUpperCase(), boxX + 4, yPos + 4.5);

      doc.setFontSize(9.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 44, 96);
      doc.text(String(item.value), boxX + 4, yPos + 10.5);
    });

    yPos += boxHeight + 5;
  }

  // Prepare table body
  const tableBody = rows.map(row => row.map(cell => cell !== null && cell !== undefined ? String(cell) : '-'));
  if (totalRow && totalRow.length > 0) {
    tableBody.push(totalRow.map(cell => cell !== null && cell !== undefined ? String(cell) : ''));
  }

  // Detect currency/numeric columns for right alignment
  const columnStyles: Record<number, any> = {};
  headers.forEach((h, idx) => {
    const lower = h.toLowerCase();
    if (lower.includes('jumlah') || lower.includes('harga') || lower.includes('amount') || lower.includes('saldo') || lower.includes('total') || lower.includes('(rp)')) {
      columnStyles[idx] = { halign: 'right' };
    } else if (lower === 'no' || lower === 'no.' || lower.includes('status') || lower.includes('tanggal') || lower.includes('date') || lower.includes('tipe')) {
      columnStyles[idx] = { halign: 'center' };
    }
  });

  // 3. Render Table
  autoTable(doc, {
    startY: yPos,
    head: [headers],
    body: tableBody,
    margin: { left: margin, right: margin, bottom: 14 },
    styles: {
      fontSize: 7.5,
      cellPadding: 2.2,
      overflow: 'linebreak',
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [0, 44, 96],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    columnStyles,
    didParseCell: (dataCell) => {
      // Highlight total row if present
      if (totalRow && dataCell.section === 'body' && dataCell.row.index === tableBody.length - 1) {
        dataCell.cell.styles.fontStyle = 'bold';
        dataCell.cell.styles.fillColor = [224, 242, 254];
        dataCell.cell.styles.textColor = [0, 44, 96];
      }
    },
    didDrawPage: (data) => {
      // Running Footer on every page
      const currentPg = doc.getCurrentPageInfo().pageNumber;
      const totalPg = doc.getNumberOfPages();

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      doc.text(`${company.name} — System Billing RADIUS`, margin, pageHeight - 6);
      doc.text(`Halaman ${currentPg} dari ${totalPg}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
    }
  });

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}

export function preparePDFData(
  options: ExportOptions,
  headers: string[],
  rows: (string | number)[][],
  summary?: { label: string; value: string }[]
): PDFTableData {
  return {
    title: options.title,
    subtitle: options.subtitle,
    dateRange: options.dateRange 
      ? `${formatDateExport(options.dateRange.start)} - ${formatDateExport(options.dateRange.end)}`
      : undefined,
    generatedAt: formatInTimeZone(new Date(), 'Asia/Jakarta', 'dd MMM yyyy HH:mm'),
    headers,
    rows,
    summary
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE INVOICE PDF GENERATOR
// ─────────────────────────────────────────────────────────────────────────────

export function generateInvoicePDF(invoiceData: {
  invoiceNumber: string;
  customerName: string;
  customerAddress?: string;
  customerPhone?: string;
  items: { description: string; amount: number }[];
  subtotal: number;
  discount?: number;
  tax?: number;
  total: number;
  dueDate: Date | string;
  status: string;
  companyInfo?: CompanyExportInfo;
}): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 16;
  let yPos = margin;
  const company = invoiceData.companyInfo || { name: 'EugineBill RADIUS' };

  // Company Header
  if (company.logo) {
    try {
      doc.addImage(company.logo, 'PNG', margin, yPos, 22, 22);
    } catch {
      try { doc.addImage(company.logo, 'JPEG', margin, yPos, 22, 22); } catch {}
    }
  }

  const logoOffset = company.logo ? 26 : 0;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96);
  doc.text(company.name, margin + logoOffset, yPos + 6);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  if (company.address) doc.text(company.address, margin + logoOffset, yPos + 11);
  if (company.phone) doc.text(`Tel: ${company.phone}`, margin + logoOffset, yPos + 16);

  // Invoice Title Right
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96);
  doc.text('INVOICE', pageWidth - margin, yPos + 7, { align: 'right' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 41, 59);
  doc.text(`# ${invoiceData.invoiceNumber}`, pageWidth - margin, yPos + 14, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Jatuh Tempo: ${formatDateExport(invoiceData.dueDate)}`, pageWidth - margin, yPos + 19, { align: 'right' });

  yPos += Math.max(26, company.logo ? 26 : 22);

  // Status Badge
  const statusColors: Record<string, [number, number, number]> = {
    'PAID': [16, 185, 129],
    'PENDING': [245, 158, 11],
    'OVERDUE': [239, 68, 68],
    'CANCELLED': [100, 116, 139]
  };
  const statusColor = statusColors[invoiceData.status] || [100, 116, 139];
  doc.setFillColor(...statusColor);
  doc.roundedRect(pageWidth - margin - 35, yPos, 35, 7, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.text(invoiceData.status, pageWidth - margin - 17.5, yPos + 4.8, { align: 'center' });

  yPos += 12;

  // Customer Box
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, yPos, (pageWidth - (margin * 2)) / 2, 32, 2, 2, 'FD');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TAGIHAN KEPADA:', margin + 4, yPos + 6);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96);
  doc.text(invoiceData.customerName, margin + 4, yPos + 13);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  if (invoiceData.customerPhone) doc.text(`Telepon: ${invoiceData.customerPhone}`, margin + 4, yPos + 19);
  if (invoiceData.customerAddress) doc.text(`Alamat: ${invoiceData.customerAddress}`, margin + 4, yPos + 25);

  yPos += 38;

  // Table
  autoTable(doc, {
    startY: yPos,
    head: [['Deskripsi Layanan', 'Jumlah (Rp)']],
    body: invoiceData.items.map(item => [item.description, formatCurrencyExport(item.amount)]),
    margin: { left: margin, right: margin },
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [0, 44, 96], textColor: [255, 255, 255], fontStyle: 'bold' },
    columnStyles: {
      0: { halign: 'left' },
      1: { halign: 'right', cellWidth: 50 }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY + 8;
  const totalsX = pageWidth - margin - 75;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text('Subtotal:', totalsX, finalY);
  doc.text(formatCurrencyExport(invoiceData.subtotal), pageWidth - margin, finalY, { align: 'right' });

  const totalY = finalY + 8;
  doc.setDrawColor(0, 44, 96);
  doc.setLineWidth(0.5);
  doc.line(totalsX, totalY - 2, pageWidth - margin, totalY - 2);

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 44, 96);
  doc.text('TOTAL:', totalsX, totalY + 4);
  doc.text(formatCurrencyExport(invoiceData.total), pageWidth - margin, totalY + 4, { align: 'right' });

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(148, 163, 184);
  doc.text('Terima kasih atas kepercayaan Anda menggunakan layanan kami.', margin, pageHeight - 12);
  doc.text(`Dokumen ini digenerate secara otomatis oleh ${company.name}`, margin, pageHeight - 7);

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}

// Generate voucher cards PDF for printing
export function generateVoucherCardsPDF(vouchers: {
  code: string;
  password?: string;
  profileName: string;
  price: number;
  validity: string;
  batchCode?: string;
}[], companyName: string = 'EugineBill RADIUS'): Uint8Array {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;

  // Card dimensions (3 columns x 5 rows per page)
  const cardWidth = (pageWidth - (margin * 2) - 10) / 3;
  const cardHeight = (pageHeight - (margin * 2) - 20) / 5;
  const cardsPerPage = 15;

  vouchers.forEach((voucher, index) => {
    if (index > 0 && index % cardsPerPage === 0) {
      doc.addPage();
    }

    const pageIndex = index % cardsPerPage;
    const col = pageIndex % 3;
    const row = Math.floor(pageIndex / 3);

    const x = margin + (col * (cardWidth + 5));
    const y = margin + (row * (cardHeight + 4));

    // Card background
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(200, 200, 200);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'FD');

    // Header bar
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(x, y, cardWidth, 8, 3, 3, 'F');
    doc.rect(x, y + 5, cardWidth, 3, 'F');

    // Company name
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(companyName, x + 3, y + 5);

    // Profile name
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(voucher.profileName, x + 3, y + 14);

    // Price
    doc.setFontSize(10);
    doc.setTextColor(59, 130, 246);
    doc.text(formatCurrencyExport(voucher.price), x + 3, y + 21);

    // Validity
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 100, 100);
    doc.text(`Masa Aktif: ${voucher.validity}`, x + 3, y + 26);

    // Code label
    doc.setFontSize(6);
    doc.setTextColor(120, 120, 120);
    doc.text('Username:', x + 3, y + 32);

    // Code
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(voucher.code, x + 3, y + 37);

    // Password label
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120, 120, 120);
    doc.text('Password:', x + 3, y + 42);

    // Password
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(voucher.password || voucher.code, x + 3, y + 47);
  });

  const output = doc.output('arraybuffer');
  return new Uint8Array(output);
}
