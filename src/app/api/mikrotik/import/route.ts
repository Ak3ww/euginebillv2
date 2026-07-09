import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import { MikroTikConnection } from '@/server/services/mikrotik/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { routerId, defaultProfileId } = await request.json();

    if (!routerId || !defaultProfileId) {
      return NextResponse.json({ error: 'Router ID and Default Profile ID are required' }, { status: 400 });
    }

    const router = await prisma.router.findUnique({ where: { id: routerId } });
    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const defaultProfile = await prisma.pppoeProfile.findUnique({ where: { id: defaultProfileId } });
    if (!defaultProfile) {
      return NextResponse.json({ error: 'Default Profile not found' }, { status: 404 });
    }

    const conn = new MikroTikConnection({
      host: router.ipAddress,
      username: router.username,
      password: router.password,
      port: router.apiPort,
    });

    await conn.connect();
    const secrets = await conn.execute('/ppp/secret/print');
    await conn.disconnect();

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    for (const secret of secrets) {
      const username = secret.name;
      const password = secret.password || '';
      const service = secret.service || 'any';
      const disabled = secret.disabled === 'true';
      const profileName = secret.profile || 'default';
      let comment = secret.comment || '';

      // Skip non-pppoe secrets (if service is explicitly specified and not pppoe/any)
      if (service !== 'pppoe' && service !== 'any') {
        skipped++;
        continue;
      }

      // Check if user exists
      const existing = await prisma.pppoeUser.findUnique({ where: { username } });
      if (existing) {
        skipped++;
        continue;
      }

      // Try to find matching profile
      let profileIdToUse = defaultProfileId;
      const matchingProfile = await prisma.pppoeProfile.findFirst({
        where: { mikrotikProfileName: profileName }
      });
      if (matchingProfile) {
        profileIdToUse = matchingProfile.id;
      }

      // Parse name from comment, or use username
      let name = username;
      let customerId = '';
      if (comment) {
        // Assume comment format "Name - ID" or just "Name"
        const parts = comment.split('-');
        if (parts.length > 1) {
          name = parts[0].trim();
          customerId = parts[1].trim();
        } else {
          name = comment.trim();
        }
      }

      if (!customerId) {
        const company = await prisma.company.findFirst();
        const prefix = company?.customerIdPrefix?.trim() || '';
        customerId = prefix + Math.floor(10000000 + Math.random() * 90000000).toString();
      }

      try {
        await prisma.pppoeUser.create({
          data: {
            id: crypto.randomUUID(),
            username,
            password,
            customerId,
            profileId: profileIdToUse,
            routerId,
            name,
            phone: '-',
            status: disabled ? 'stop' : 'active',
            subscriptionType: 'POSTPAID',
            billingDay: 1,
            comment,
          } as any
        });
        imported++;
      } catch (err) {
        console.error(`Error importing ${username}:`, err);
        errors++;
      }
    }

    return NextResponse.json({
      success: true,
      imported,
      skipped,
      errors,
      total: secrets.length,
    });
  } catch (error) {
    console.error('MikroTik Import error:', error);
    return NextResponse.json({ error: 'Import failed: ' + (error instanceof Error ? error.message : String(error)) }, { status: 500 });
  }
}
