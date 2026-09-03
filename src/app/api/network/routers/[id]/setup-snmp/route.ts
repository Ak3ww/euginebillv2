import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { requirePermission } from '@/server/middleware/api-auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { community = 'public' } = await request.json().catch(() => ({}));

    const router = await prisma.router.findUnique({
      where: { id },
    });

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const { MikroTikConnection } = await import('@/server/services/mikrotik/client');

    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: router.port || 8728,
      tls: false,
    });

    try {
      await conn.connect();

      // Enable SNMP on MikroTik
      await conn.execute('/snmp/set', [
        '=enabled=yes',
        `=contact=EugineBill Admin`,
        `=location=${router.name}`,
      ]);

      // Check or add SNMP community
      const communities = await conn.execute('/snmp/community/print');
      const existing = communities.find((c: any) => c.name === community);

      if (!existing) {
        await conn.execute('/snmp/community/add', [
          `=name=${community}`,
          '=addresses=0.0.0.0/0',
          '=read-access=yes',
        ]);
      }

      await conn.disconnect();

      return NextResponse.json({
        success: true,
        message: `SNMP berhasil diaktifkan di MikroTik ${router.name} (Community: ${community})`,
      });
    } catch (apiErr: any) {
      console.warn(`[SNMP Setup] Direct API setup failed for ${router.name}:`, apiErr.message);

      // Return script for manual paste if API is unreachable
      const script = `
# ============================================
# EugineBill MikroTik SNMP Setup Script
# Router   : ${router.name}
# Community: ${community}
# ============================================

/snmp set enabled=yes contact="EugineBill Admin" location="${router.name}"
:if ([:len [/snmp community find name="${community}"]] = 0) do={
    /snmp community add name="${community}" addresses=0.0.0.0/0 read-access=yes
}
`;

      return NextResponse.json({
        success: false,
        error: `Gagal konek via API (${apiErr.message}). Gunakan script berikut di terminal MikroTik:`,
        script,
      });
    }
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
