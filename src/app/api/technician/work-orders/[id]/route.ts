import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/server/db/client';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';

import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify authentication via NextAuth session or technician token cookie
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      const token = req.cookies.get('technician-token')?.value;
      if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
      const { payload } = await jwtVerify(token, TECH_JWT_SECRET);
      if (!payload.id) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    let wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true,
            macAddress: true,
            odpAssignment: {
              include: {
                odp: {
                  select: {
                    id: true,
                    name: true,
                    latitude: true,
                    longitude: true,
                    portCount: true,
                    status: true,
                  },
                },
              },
            },
            inventoryAssets: {
              where: { status: 'IN_USE', assetType: 'MODEM' },
              select: {
                id: true,
                serialNumber: true,
                macAddress: true,
                vendor: true,
                model: true,
              },
              take: 1,
            },
            deviceHistories: {
              orderBy: { createdAt: 'desc' },
              take: 1,
              select: {
                serialNumber: true,
                macAddress: true,
                vendor: true,
                model: true,
              },
            },
          },
        },
      },
    });

    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    // Robust fallback resolution if wo.customer is null
    if (!wo.customer && (wo.linkedUserId || wo.customerPhone || wo.customerName)) {
      const cleanPhone = (wo.customerPhone || '').replace(/\D/g, '');
      const phoneVariations = cleanPhone ? [
        cleanPhone,
        '0' + cleanPhone.replace(/^62/, ''),
        '62' + cleanPhone.replace(/^0/, ''),
      ] : [];

      const matchedUser = await prisma.pppoeUser.findFirst({
        where: {
          OR: [
            ...(wo.linkedUserId ? [{ id: wo.linkedUserId }] : []),
            ...(phoneVariations.length > 0 ? [{ phone: { in: phoneVariations } }] : []),
            ...(wo.customerName ? [{ name: { equals: wo.customerName.trim() } }] : []),
          ],
        },
        select: {
          id: true,
          name: true,
          phone: true,
          address: true,
          latitude: true,
          longitude: true,
          macAddress: true,
          odpAssignment: {
            include: {
              odp: {
                select: {
                  id: true,
                  name: true,
                  latitude: true,
                  longitude: true,
                  portCount: true,
                  status: true,
                },
              },
            },
          },
          inventoryAssets: {
            where: { status: 'IN_USE', assetType: 'MODEM' },
            select: {
              id: true,
              serialNumber: true,
              macAddress: true,
              vendor: true,
              model: true,
            },
            take: 1,
          },
          deviceHistories: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              serialNumber: true,
              macAddress: true,
              vendor: true,
              model: true,
            },
          },
        },
      });

      if (matchedUser) {
        (wo as any).customer = matchedUser;
      }
    }

    return NextResponse.json({ success: true, workOrder: wo });
  } catch (error) {
    console.error('Fetch work order error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
