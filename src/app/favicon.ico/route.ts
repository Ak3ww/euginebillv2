import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const iconUrl = new URL('/api/pwa/icon?size=192', req.url);
  return NextResponse.redirect(iconUrl, 307);
}
