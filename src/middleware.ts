import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, favicon.png, sitemap.xml, robots.txt
     * - uploads (uploaded files)
     * - sw.js, manifest.json, manifest-*
     */
    '/((?!api|_next/static|_next/image|favicon|sitemap.xml|robots.txt|uploads|sw.js|manifest|assets|images).*)',
  ],
};

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  
  // Get hostname of request (e.g. admin.euginemediagroup.com, localhost:3000)
  const hostname = req.headers.get('host') || '';
  
  // Current path
  const path = url.pathname;
  
  // Subdomain routing logic
  if (hostname.startsWith('admin.')) {
    if (!path.startsWith('/admin')) {
      return NextResponse.rewrite(new URL(`/admin${path === '/' ? '' : path}`, req.url));
    }
  } 
  else if (hostname.startsWith('customer.') || hostname.startsWith('pelanggan.')) {
    if (!path.startsWith('/customer')) {
      return NextResponse.rewrite(new URL(`/customer${path === '/' ? '' : path}`, req.url));
    }
  } 
  else if (hostname.startsWith('agent.') || hostname.startsWith('agen.')) {
    if (!path.startsWith('/agent')) {
      return NextResponse.rewrite(new URL(`/agent${path === '/' ? '' : path}`, req.url));
    }
  } 
  else if (hostname.startsWith('technician.') || hostname.startsWith('teknisi.')) {
    if (!path.startsWith('/technician')) {
      return NextResponse.rewrite(new URL(`/technician${path === '/' ? '' : path}`, req.url));
    }
  }

  // If no subdomain matched, or it already matched the path, let it pass through
  return NextResponse.next();
}
