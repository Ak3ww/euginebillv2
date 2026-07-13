import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pppoeUserId } = await request.json();
    const { id } = await params;

    const device = await prisma.acsDevice.findUnique({ where: { id } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    await prisma.acsDevice.update({
      where: { id: params.id },
      data: { pppoeUserId: pppoeUserId || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ACS Device Map Error:', error);
    return NextResponse.json({ error: 'Failed to map device' }, { status: 500 });
  }
}
