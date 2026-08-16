import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { readFileSync, existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// Cache the generated icon in memory (invalidated on process restart / deploy)
const iconCache: Map<string, { buffer: Buffer; etag: string; ts: number }> = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function fallbackIcon(size: number): Buffer {
  const candidates = [
    path.join(process.cwd(), 'public/landing/assets/logo.png'),
    path.join(process.cwd(), `public/pwa/icon-${size}.png`),
    path.join(process.cwd(), `../public/pwa/icon-${size}.png`),
    path.join('/var/www/EugineBill-radius', 'public/landing/assets/logo.png'),
    path.join('/var/www/EugineBill-radius', `public/pwa/icon-${size}.png`),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return readFileSync(p);
  }
  // Last resort: 1×1 transparent PNG
  return Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
}

async function resizeToSquare(inputBuffer: Buffer, size: number): Promise<Buffer> {
  try {
    const sharp = (await import('sharp')).default;
    return sharp(inputBuffer)
      .resize(size, size, {
        fit: 'contain',
        background: { r: 3, g: 19, b: 29, alpha: 1 }, // #03131d — matches app bg
      })
      .png()
      .toBuffer();
  } catch {
    return inputBuffer;
  }
}

async function fetchExternalImage(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch {
    return null;
  }
}

function getLogoPath(logoValue: string): string | null {
  if (!logoValue) return null;
  const filename = logoValue.split('/').pop() || '';
  const uploadDir = process.env.UPLOAD_DIR || '/var/data/EugineBill/uploads';
  const cleanRel = logoValue.replace(/^\/api\//, '').replace(/^\//, '');

  const candidates = [
    path.join(uploadDir, 'logos', filename),
    path.join(uploadDir, filename),
    path.join(uploadDir, cleanRel.replace(/^uploads\//, '')),

    path.join(process.cwd(), 'public', cleanRel),
    path.join(process.cwd(), 'public/uploads/logos', filename),
    path.join(process.cwd(), 'public/uploads', filename),

    path.join('/var/www/EugineBill-radius/public', cleanRel),
    path.join('/var/www/EugineBill-radius/public/uploads/logos', filename),
    path.join('/var/www/EugineBill-radius/public/uploads', filename),
  ];

  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawSize = parseInt(searchParams.get('size') || '192', 10);
  const size = rawSize === 512 ? 512 : 192;

  const cacheKey = `icon-${size}`;
  const cached = iconCache.get(cacheKey);

  // ETag check
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    const ifNoneMatch = req.headers.get('if-none-match');
    if (ifNoneMatch === cached.etag) {
      return new NextResponse(null, { status: 304 });
    }
    return new NextResponse(new Uint8Array(cached.buffer), {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=300, must-revalidate',
        'ETag': cached.etag,
      },
    });
  }

  let iconBuffer: Buffer | null = null;

  try {
    // Fetch company logo from DB
    const company = await prisma.company.findFirst({ select: { logo: true } });
    const logoValue = company?.logo || null;

    if (logoValue) {
      // Case 1: local file path
      const diskPath = getLogoPath(logoValue);
      if (diskPath) {
        iconBuffer = readFileSync(diskPath);
      }
      // Case 2: external URL (http/https)
      else if (logoValue.startsWith('http://') || logoValue.startsWith('https://')) {
        iconBuffer = await fetchExternalImage(logoValue);
      }
      // Case 3: relative web path (fetch locally)
      else if (logoValue.startsWith('/')) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://127.0.0.1:3000';
        iconBuffer = await fetchExternalImage(`${appUrl}${logoValue}`);
      }
    }
  } catch {
    // DB unavailable — fall through to static fallback
  }

  // Resize to exact square, or fall back to static PNG
  let finalBuffer: Buffer;
  try {
    if (iconBuffer) {
      finalBuffer = await resizeToSquare(iconBuffer, size);
    } else {
      finalBuffer = fallbackIcon(size);
    }
  } catch {
    finalBuffer = fallbackIcon(size);
  }

  const etag = `"${size}-${Date.now()}"`;
  iconCache.set(cacheKey, { buffer: finalBuffer, etag, ts: Date.now() });

  return new NextResponse(new Uint8Array(finalBuffer), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=300, must-revalidate',
      'ETag': etag,
    },
  });
}
