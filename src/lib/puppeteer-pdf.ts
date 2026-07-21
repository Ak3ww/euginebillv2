import puppeteer from 'puppeteer-core';
import fs from 'fs';

export async function generateInvoicePdfFromUrl(invoiceNumber: string, hostHeader?: string): Promise<Buffer> {
  let executablePath = '';

  // 1. Detect platform & Chrome / Edge executable
  if (process.platform === 'linux') {
    const linuxPaths = [
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
    ];
    for (const p of linuxPaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  } else if (process.platform === 'win32') {
    const winPaths = [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];
    for (const p of winPaths) {
      if (fs.existsSync(p)) {
        executablePath = p;
        break;
      }
    }
  }

  if (!executablePath) {
    try {
      // @ts-ignore
      const chromium = (await import('@sparticuz/chromium')).default;
      executablePath = await chromium.executablePath();
    } catch {
      throw new Error('No Chrome/Chromium binary found on server');
    }
  }

  const browser = await puppeteer.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
    defaultViewport: { width: 1200, height: 1600 },
    executablePath,
    headless: true,
  });

  try {
    const page = await browser.newPage();
    const port = process.env.PORT || '3000';
    const baseUrl = hostHeader ? `http://${hostHeader}` : `http://127.0.0.1:${port}`;
    const targetUrl = `${baseUrl}/invoice/${invoiceNumber}`;

    await page.goto(targetUrl, { waitUntil: 'networkidle0', timeout: 30000 });

    // Emulate print media so web styles & print background render 100% exact
    await page.emulateMediaType('print');

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await browser.close();
  }
}
