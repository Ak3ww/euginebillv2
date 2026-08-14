import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

/**
 * GET /api/admin/wa-groups
 * Lists all WhatsApp groups the connected Baileys number is a member of.
 * Used by admin to find the Group ID for PSB report notifications.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const port = process.env.WA_SERVICE_PORT || 4000;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/groups`, {
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { success: false, error: `WA service error: ${res.status} — ${text}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json({ success: true, groups: data.groups || [] });
  } catch (error: any) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return NextResponse.json({ success: false, error: 'WA service tidak merespons (timeout)' }, { status: 503 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
