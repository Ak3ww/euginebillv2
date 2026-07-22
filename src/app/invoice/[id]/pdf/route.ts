import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
}

/**
 * Find available Chrome / Edge executable on system for Puppeteer HTML-to-PDF rendering
 */
function getChromeExecutablePath(): string | null {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }
  const candidates = [
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/snap/bin/chromium',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

/**
 * Convert local image paths (/uploads/logos/...) or URLs into base64 Data URIs
 */
function resolveLogoDataUrl(logoPath: string | null | undefined): string | null {
  if (!logoPath) return null;
  if (logoPath.startsWith('data:image')) return logoPath;
  try {
    const cleanPath = logoPath.replace(/^\//, '');
    const localFilePath = path.join(process.cwd(), 'public', cleanPath);
    if (fs.existsSync(localFilePath)) {
      const fileBuffer = fs.readFileSync(localFilePath);
      const ext = path.extname(localFilePath).replace('.', '') || 'png';
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`;
      return `data:${mime};base64,${fileBuffer.toString('base64')}`;
    }
  } catch {}
  if (logoPath.startsWith('http://') || logoPath.startsWith('https://')) {
    return logoPath;
  }
  return null;
}

/**
 * Attempt to render PDF using Chromium / Puppeteer for 100% pixel-perfect HTML rendering (htmldocs approach)
 */
async function renderPuppeteerPdf(htmlContent: string): Promise<Buffer | null> {
  let browser: any = null;
  try {
    const executablePath = getChromeExecutablePath();
    const puppeteer = require('puppeteer-core');

    if (executablePath) {
      browser = await puppeteer.launch({
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--gpu-disabled'],
        headless: true,
      });
    } else {
      try {
        const chromium = require('@sparticuz/chromium-min');
        const chromiumPath = await chromium.executablePath();
        if (chromiumPath) {
          browser = await puppeteer.launch({
            executablePath: chromiumPath,
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            headless: chromium.headless,
          });
        }
      } catch {
        return null;
      }
    }

    if (!browser) return null;

    const page = await browser.newPage();
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    await page.setContent(htmlContent, { waitUntil: 'networkidle0', timeout: 8000 });

    const pdfUint8 = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });

    await browser.close();
    return Buffer.from(pdfUint8);
  } catch (err) {
    console.error('[Puppeteer HTML PDF] Failed:', err);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return null;
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const invoice = await prisma.invoice.findUnique({
      where: { invoiceNumber: id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            username: true,
            address: true,
            customerId: true,
            area: { select: { name: true } },
            profile: { select: { name: true, price: true } }
          }
        },
        payments: { take: 1 },
        manualPayments: { take: 1 },
      }
    });

    if (!invoice) {
      return new NextResponse('Invoice not found', { status: 404 });
    }

    const company = await prisma.company.findFirst();

    const isPaid = invoice.status === 'PAID';
    const isOverdue = invoice.status === 'OVERDUE';
    
    const dueDateStr = new Date(invoice.dueDate).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
    const createdDateStr = new Date(invoice.createdAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    });
    const paidAtStr = invoice.paidAt ? new Date(invoice.paidAt).toLocaleDateString('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Jakarta'
    }) : null;

    // Payment method text
    const approvedManual = invoice.manualPayments?.find((mp: any) => mp.status === 'APPROVED');
    const anyManual = invoice.manualPayments?.[0];
    const destinationBank = approvedManual?.destinationBank || anyManual?.destinationBank || null;

    const paidViaText = (() => {
      if (!invoice.paidAt) return null;
      if (approvedManual || invoice.payments?.some((p: any) => p.method === 'manual_transfer' || p.method === 'manual')) {
        return `Transfer Manual ${destinationBank ? `(ke ${destinationBank})` : ''}`;
      }
      if (invoice.payments?.length > 0) return 'Payment Gateway';
      return 'Dikonfirmasi Admin';
    })();

    // Additional fees parsing
    const parsedFees = (() => {
      try {
        if (!invoice.additionalFees) return [];
        const parsed = typeof invoice.additionalFees === 'string'
          ? JSON.parse(invoice.additionalFees)
          : invoice.additionalFees;
        return Array.isArray(parsed) ? parsed : (parsed.items || []);
      } catch { return []; }
    })();

    // Items
    const baseAmt = invoice.baseAmount ?? invoice.amount;
    const taxRateNum = invoice.taxRate ? Number(invoice.taxRate) : 0;
    const hasTax = taxRateNum > 0;
    const taxAmt = hasTax ? invoice.amount - baseAmt : 0;

    let items: any[] = [];
    if (invoice.type === 'INSTALLATION') {
      items.push({ description: 'Biaya Pemasangan', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else if (invoice.type === 'TOPUP') {
      items.push({ description: 'Top Up Saldo', quantity: 1, price: invoice.amount, total: invoice.amount });
    } else if (invoice.invoiceType === 'ADDON' && parsedFees.length > 0) {
      // Addon fees only
    } else {
      const profileName = invoice.user?.profile?.name || 'Paket Internet';
      items.push({
        description: `Langganan Internet (${new Date(invoice.dueDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}) - ${profileName}`,
        quantity: 1,
        price: baseAmt,
        total: baseAmt
      });
    }

    // QR Code generation
    const paymentLink = invoice.paymentLink || (invoice.paymentToken ? `/pay/${invoice.paymentToken}` : null);
    let qrDataUrl = '';
    if (paymentLink) {
      try {
        qrDataUrl = await QRCode.toDataURL(paymentLink, { width: 140, margin: 1 });
      } catch {}
    }

    // Resolve company logo to base64 Data URI
    const logoDataUrl = resolveLogoDataUrl(company?.logo);
    let logoHtml = '';
    if (logoDataUrl) {
      logoHtml = `<div style="width: 56px; height: 56px; border-radius: 12px; background: #f9fafb; border: 1px solid #e5e7eb; display: flex; align-items: center; justify-content: center; padding: 4px; flex-shrink: 0;"><img src="${logoDataUrl}" style="max-height: 44px; max-width: 44px; object-fit: contain;" /></div>`;
    }

    // Status Badge HTML
    const statusBadgeHtml = isPaid
      ? `<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: #d1fae5; color: #065f46; border: 1px solid #6ee7b7;">✓ SUDAH BAYAR</span>`
      : isOverdue
      ? `<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5;">⚠️ TERLAMBAT</span>`
      : `<span style="display: inline-block; padding: 4px 12px; border-radius: 9999px; font-size: 10px; font-weight: 700; background: #fef3c7; color: #92400e; border: 1px solid #fcd34d;">BELUM BAYAR</span>`;

    // Table rows HTML
    const allTableItems = [
      ...items.map((it) => `<tr><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #1f2937;">${it.description}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: center; color: #1f2937;">${it.quantity}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; color: #1f2937;">${formatCurrency(it.price)}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; color: #1f2937;">${formatCurrency(it.total)}</td></tr>`),
      ...parsedFees.map((fee: any) => `<tr><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; color: #1f2937;">${fee.name || fee.description || 'Biaya Tambahan'}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: center; color: #1f2937;">1</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; color: #1f2937;">${formatCurrency(fee.amount || fee.price || 0)}</td><td style="padding: 10px 14px; border-bottom: 1px solid #e5e7eb; font-size: 11px; text-align: right; color: #1f2937;">${formatCurrency(fee.amount || fee.price || 0)}</td></tr>`),
    ];

    if (hasTax) {
      allTableItems.push(`<tr><td colspan="3" style="padding: 8px 14px; text-align: right; font-size: 11px; color: #6b7280; background: #f9fafb;">Subtotal</td><td style="padding: 8px 14px; text-align: right; font-size: 11px; color: #6b7280; background: #f9fafb;">${formatCurrency(baseAmt)}</td></tr>`);
      allTableItems.push(`<tr><td colspan="3" style="padding: 8px 14px; text-align: right; font-size: 11px; color: #6b7280; background: #f9fafb;">PPN ${taxRateNum}%</td><td style="padding: 8px 14px; text-align: right; font-size: 11px; color: #6b7280; background: #f9fafb;">${formatCurrency(taxAmt)}</td></tr>`);
    }

    const tableRowsHtml = allTableItems.join('');

    // Bottom LUNAS stamp & QR code HTML
    let bottomSectionHtml = '';
    if (isPaid) {
      bottomSectionHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 28px;">
          <div style="display: inline-block; padding: 10px 24px; border: 4px solid #10b981; border-radius: 12px; text-align: center;">
            <div style="font-size: 22px; font-weight: 900; color: #10b981; letter-spacing: 4px;">L U N A S</div>
            <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">Dibayar pada ${paidAtStr || '-'}</div>
          </div>
          ${qrDataUrl ? `
            <div style="display: flex; flex-direction: column; items-center: center; text-align: center;">
              <img src="${qrDataUrl}" style="width: 72px; height: 72px; border-radius: 8px; border: 1px solid #e5e7eb; padding: 2px;" />
              <div style="font-size: 8px; color: #9ca3af; margin-top: 4px;">Scan untuk e-receipt</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    // Build complete HTML document matching htmldocs standard
    const htmlDocument = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page { size: A4; margin: 0; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      background-color: #ffffff;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color: #111827;
    }
  </style>
</head>
<body>
  <div style="width: 210mm; min-height: 297mm; background: #ffffff; margin: 0 auto; box-sizing: border-box; position: relative; overflow: hidden;">
    <!-- Full-Color Translucent Background Watermark Logo -->
    ${logoDataUrl ? `
      <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center; opacity: 0.06; pointer-events: none; z-index: 0; overflow: hidden;">
        <img src="${logoDataUrl}" style="width: 75%; max-width: 600px; object-fit: contain; transform: rotate(-12deg) scale(1.2);" />
      </div>
    ` : ''}

    <!-- Top Oceanic Blue Brand Banner -->
    <div style="height: 14px; background: linear-gradient(to right, #002c60, #1b437c); width: 100%; position: relative; z-index: 10;"></div>

    <div style="padding: 32px; position: relative; z-index: 10;">
      <!-- Header Section -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
        <div style="display: flex; align-items: center; gap: 14px;">
          ${logoHtml}
          <div>
            <div style="font-size: 20px; font-weight: 700; color: #111827; line-height: 1.2;">${company?.name || 'EugineBill'}</div>
            <div style="font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.5;">
              ${company?.address ? `<div>${company.address.replace(/<[^>]*>?/gm, '')}</div>` : ''}
              ${company?.phone ? `<div>Telp: ${company.phone}</div>` : ''}
              ${company?.email ? `<div>${company.email}</div>` : ''}
            </div>
          </div>
        </div>

        <div style="text-align: right;">
          <div style="font-size: 26px; font-weight: 900; color: #111827; letter-spacing: 2px; line-height: 1;">INVOICE</div>
          <div style="font-size: 13px; font-weight: 700; color: #dc2626; margin: 4px 0;">${invoice.invoiceNumber}</div>
          <div style="margin-top: 6px;">${statusBadgeHtml}</div>
        </div>
      </div>

      <hr style="border: none; border-top: 3px solid #000000; margin: 16px 0;" />

      <!-- Grid 1: DARI vs KEPADA -->
      <div style="display: flex; gap: 16px; margin-bottom: 16px;">
        <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Dari</div>
          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px;">${company?.name || 'EugineBill'}</div>
          ${company?.address ? `<div style="font-size: 11px; color: #4b5563;">${company.address.replace(/<[^>]*>?/gm, '')}</div>` : ''}
          ${company?.phone ? `<div style="font-size: 11px; color: #4b5563;">Telp: ${company.phone}</div>` : ''}
        </div>
        <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Kepada</div>
          <div style="font-size: 13px; font-weight: 700; color: #111827; margin-bottom: 2px;">${invoice.customerName || invoice.user?.name || 'Pelanggan'}</div>
          <div style="font-size: 11px; color: #4b5563;"><span style="color: #9ca3af;">ID Pelanggan: </span>${invoice.customerUsername || invoice.user?.customerId || invoice.user?.username || '-'}</div>
          <div style="font-size: 11px; color: #4b5563;"><span style="color: #9ca3af;">Telp: </span>${invoice.customerPhone || invoice.user?.phone || '-'}</div>
        </div>
      </div>

      <!-- Grid 2: DETAIL INVOICE vs STATUS PEMBAYARAN -->
      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Detail Invoice</div>
          <div style="font-size: 11px; color: #374151; margin-bottom: 2px;"><span style="color: #9ca3af;">No Invoice: </span><strong>${invoice.invoiceNumber}</strong></div>
          <div style="font-size: 11px; color: #374151; margin-bottom: 2px;"><span style="color: #9ca3af;">Tanggal: </span>${createdDateStr}</div>
          <div style="font-size: 11px; color: #374151;"><span style="color: #9ca3af;">Jatuh Tempo: </span>${dueDateStr}</div>
        </div>
        <div style="flex: 1; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 14px;">
          <div style="font-size: 9.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px;">Status Pembayaran</div>
          <div style="font-size: 11px; color: #374151; margin-bottom: 2px;"><span style="color: #9ca3af;">Status: </span><strong>${isPaid ? '✓ LUNAS' : isOverdue ? '⚠️ TERLAMBAT' : 'BELUM BAYAR'}</strong></div>
          ${paidAtStr ? `
            <div style="font-size: 11px; color: #374151; margin-bottom: 2px;"><span style="color: #9ca3af;">Dibayar pada: </span>${paidAtStr}</div>
            <div style="font-size: 11px; color: #374151;"><span style="color: #9ca3af;">Via: </span>${paidViaText || 'Payment Gateway'}</div>
          ` : `
            <div style="font-size: 11px; color: #374151;"><span style="color: #9ca3af;">Metode: </span>Transfer Bank / Online Payment</div>
          `}
        </div>
      </div>

      <!-- RINCIAN LAYANAN Table -->
      <div style="font-size: 9.5px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px;">Rincian Layanan</div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <thead>
          <tr>
            <th style="background: #000000; color: #ffffff; padding: 10px 14px; text-align: left; font-size: 10.5px; font-weight: 700; text-transform: uppercase; border-top-left-radius: 8px;">Deskripsi</th>
            <th style="background: #000000; color: #ffffff; padding: 10px 14px; text-align: center; font-size: 10.5px; font-weight: 700; text-transform: uppercase; width: 60px;">Qty</th>
            <th style="background: #000000; color: #ffffff; padding: 10px 14px; text-align: right; font-size: 10.5px; font-weight: 700; text-transform: uppercase; width: 120px;">Harga</th>
            <th style="background: #000000; color: #ffffff; padding: 10px 14px; text-align: right; font-size: 10.5px; font-weight: 700; text-transform: uppercase; width: 130px; border-top-right-radius: 8px;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
          <!-- Highlighted Red Total Box -->
          <tr>
            <td colspan="3" style="text-align: right; font-weight: 700; font-size: 12.5px; background: #fef2f2; border-top: 2px solid #dc2626; padding: 10px 14px; color: #111827;">TOTAL</td>
            <td style="text-align: right; font-weight: 700; font-size: 12.5px; background: #fef2f2; border-top: 2px solid #dc2626; padding: 10px 14px; color: #dc2626;">${formatCurrency(invoice.amount)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Stamp LUNAS & QR Code -->
      ${bottomSectionHtml}

      <!-- Footer -->
      <div style="margin-top: 36px; text-align: center; color: #9ca3af; font-size: 9.5px; border-top: 1px solid #e5e7eb; padding-top: 14px;">
        Terima kasih atas kepercayaan Anda &mdash; ${company?.name || 'EugineBill'}
      </div>
    </div>
  </div>
</body>
</html>`;

    // 1. Try Puppeteer Chromium HTML-to-PDF rendering first (100% htmldocs pixel-perfect standard)
    const puppeteerPdfBuffer = await renderPuppeteerPdf(htmlDocument);
    if (puppeteerPdfBuffer) {
      return new NextResponse(puppeteerPdfBuffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
        },
      });
    }

    // 2. Fallback to jsPDF vector rendering if Puppeteer Chromium is not available
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    doc.setFillColor(0, 44, 96);
    doc.rect(0, 0, 210, 10, 'F');

    let currentY = 18;
    let companyNameY = currentY + 4;
    let textLeftMargin = 14;

    if (logoDataUrl) {
      try {
        doc.setFillColor(249, 250, 251);
        doc.setDrawColor(229, 231, 235);
        doc.setLineWidth(0.3);
        doc.roundedRect(14, currentY, 18, 18, 2, 2, 'FD');
        doc.addImage(logoDataUrl, 'PNG', 15.5, currentY + 1.5, 15, 15);
        textLeftMargin = 36;
      } catch {}
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text(company?.name || 'EugineBill', textLeftMargin, companyNameY);

    doc.setFontSize(8.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(115, 119, 129);
    let contactY = companyNameY + 4.5;
    if (company?.address) {
      doc.text(company.address.replace(/<[^>]*>?/gm, '').substring(0, 50), textLeftMargin, contactY);
      contactY += 4;
    }
    if (company?.phone) {
      doc.text(`Telp: ${company.phone}`, textLeftMargin, contactY);
      contactY += 4;
    }

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text('INVOICE', 196, currentY + 4, { align: 'right' });

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(invoice.invoiceNumber, 196, currentY + 10, { align: 'right' });

    const badgeText = isPaid ? '✓ SUDAH BAYAR' : isOverdue ? '⚠️ TERLAMBAT' : 'BELUM BAYAR';
    const badgeRgb = isPaid ? [6, 95, 70] : isOverdue ? [153, 27, 27] : [146, 64, 14];
    const badgeBgRgb = isPaid ? [209, 250, 229] : isOverdue ? [254, 226, 226] : [254, 243, 199];

    doc.setFillColor(badgeBgRgb[0], badgeBgRgb[1], badgeBgRgb[2]);
    doc.setDrawColor(badgeRgb[0], badgeRgb[1], badgeRgb[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(156, currentY + 13, 40, 6.5, 3, 3, 'FD');

    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(badgeRgb[0], badgeRgb[1], badgeRgb[2]);
    doc.text(badgeText, 176, currentY + 17.2, { align: 'center' });

    currentY = Math.max(contactY, currentY + 22);

    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.8);
    doc.line(14, currentY, 196, currentY);
    currentY += 6;

    const boxW = 89;
    const boxH = 24;

    doc.setFillColor(249, 250, 251);
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.roundedRect(14, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(156, 163, 175);
    doc.text('DARI', 18, currentY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text(company?.name || 'EugineBill', 18, currentY + 10);

    doc.roundedRect(107, currentY, boxW, boxH, 2.5, 2.5, 'FD');

    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(156, 163, 175);
    doc.text('KEPADA', 111, currentY + 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    const custName = invoice.customerName || invoice.user?.name || 'Pelanggan';
    doc.text(custName.substring(0, 35), 111, currentY + 10);

    currentY += boxH + 4;

    doc.roundedRect(14, currentY, boxW, boxH, 2.5, 2.5, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(156, 163, 175);
    doc.text('DETAIL INVOICE', 18, currentY + 5);

    doc.roundedRect(107, currentY, boxW, boxH, 2.5, 2.5, 'FD');
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(156, 163, 175);
    doc.text('STATUS PEMBAYARAN', 111, currentY + 5);

    currentY += boxH + 6;

    const tableBody = [
      ...items.map((item: any) => [
        item.description,
        item.quantity.toString(),
        formatCurrency(item.price),
        formatCurrency(item.total)
      ]),
      ...parsedFees.map((fee: any) => [
        fee.name || fee.description || 'Biaya Tambahan',
        '1',
        formatCurrency(fee.amount || fee.price || 0),
        formatCurrency(fee.amount || fee.price || 0)
      ])
    ];

    autoTable(doc, {
      head: [['DESKRIPSI', 'QTY', 'HARGA', 'TOTAL']],
      body: tableBody,
      startY: currentY,
      theme: 'plain',
      headStyles: {
        fillColor: [0, 0, 0],
        textColor: [255, 255, 255],
        fontSize: 8.5,
        fontStyle: 'bold',
        halign: 'left',
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 100 },
        1: { halign: 'center', cellWidth: 18 },
        2: { halign: 'right', cellWidth: 32 },
        3: { halign: 'right', cellWidth: 32 }
      },
      styles: {
        fontSize: 8.5,
        cellPadding: 3,
        lineColor: [229, 231, 235],
        lineWidth: 0.3
      }
    });

    currentY = (doc as any).lastAutoTable.finalY + 4;

    doc.setFillColor(254, 242, 242);
    doc.setDrawColor(220, 38, 38);
    doc.setLineWidth(0.8);
    doc.rect(14, currentY, 182, 11, 'FD');

    doc.setFontSize(9.5);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(26, 28, 32);
    doc.text('TOTAL', 18, currentY + 7.5);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(formatCurrency(invoice.amount), 192, currentY + 7.5, { align: 'right' });

    currentY += 18;

    if (isPaid) {
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(1.2);
      doc.roundedRect(14, currentY, 65, 18, 3, 3, 'D');

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text('L U N A S', 46.5, currentY + 8, { align: 'center' });
    }

    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.3);
    doc.line(14, 275, 196, 275);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(156, 163, 175);
    doc.text(`Terima kasih atas kepercayaan Anda — ${company?.name || 'EugineBill'}`, 105, 281, { align: 'center' });

    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Invoice-${invoice.invoiceNumber}.pdf"`,
      },
    });

  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
