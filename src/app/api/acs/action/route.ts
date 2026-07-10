import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { serialNumber, action, payload } = await request.json();

    if (!serialNumber || !action) {
      return NextResponse.json({ error: 'Serial Number and Action are required' }, { status: 400 });
    }

    const device = await prisma.acsDevice.findUnique({ where: { serialNumber } });
    if (!device) {
      return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    }

    // Queue the task
    await prisma.acsTask.create({
      data: {
        deviceId: device.id,
        command: action,
        name: action,
        payload: payload ? JSON.stringify(payload) : null,
        status: 'pending'
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('ACS Action Error:', error);
    return NextResponse.json({ error: 'Failed to queue action' }, { status: 500 });
  }
}
