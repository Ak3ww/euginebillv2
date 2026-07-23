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

    const wo = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        customer: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({ success: true, workOrder: wo });
  } catch (error) {
    console.error('Fetch work order error:', error);
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}
