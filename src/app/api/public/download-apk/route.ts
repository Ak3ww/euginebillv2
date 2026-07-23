import { NextRequest, NextResponse } from 'next/server';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const role = req.nextUrl.searchParams.get('role') || 'customer';
  
  // Possible paths for built APKs
  const candidatePaths = [
    join(process.cwd(), 'public', 'downloads', 'EugineBill-radius.apk'),
    join(process.cwd(), 'public', 'downloads', 'EugineBill-customer.apk'),
    join('/var/data/EugineBill/apk', role, 'app.apk'),
    join('/var/data/EugineBill/apk', 'customer', 'app.apk'),
  ];

  let foundPath: string | null = null;
  for (const p of candidatePaths) {
    if (existsSync(p)) {
      foundPath = p;
      break;
    }
  }

  if (!foundPath) {
    // If no compiled APK file exists on the server disk, redirect to PWA download guide
    const host = req.headers.get('host') || '';
    const protocol = req.headers.get('x-forwarded-proto') || 'http';
    return NextResponse.redirect(`${protocol}://${host}/download-app`);
  }

  const buf = readFileSync(foundPath);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.android.package-archive',
      'Content-Disposition': `attachment; filename="EugineBill-Customer.apk"`,
      'Content-Length': String(buf.length),
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
