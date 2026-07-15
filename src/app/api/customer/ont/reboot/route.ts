import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import crypto from 'crypto';

// Helper to verify customer token
async function verifyCustomerToken(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return null;

    const session = await prisma.customerSession.findFirst({
      where: {
        token,
        verified: true,
        expiresAt: { gte: new Date() },
      },
    });
    if (!session) return null;

    const user = await prisma.pppoeUser.findUnique({
      where: { id: session.userId },
      select: { id: true, username: true },
    });
    return user;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Find the device linked to this PPPoE user
    let device = await prisma.acsDevice.findFirst({
      where: { pppoeUserId: user.id }
    });

    // Fallback: search for any device where parameters contain the user's PPPoE username
    if (!device) {
      const allDevices = await prisma.acsDevice.findMany();
      device = allDevices.find(d => {
        const params = (d.parameters as Record<string, any>) || {};
        const pppUser = params['InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username'] || '';
        return pppUser.toLowerCase() === user.username.toLowerCase();
      }) || null;
    }

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Modem/ONT tidak terdaftar untuk akun Anda' },
        { status: 404 }
      );
    }

    // Queue reboot task in our built-in ACS
    await prisma.acsTask.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: device.id,
        command: 'Reboot',
        name: 'Reboot',
        payload: null,
        status: 'pending'
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        username: user.username,
        module: 'customer_wifi',
        action: 'reboot_ont',
        description: 'Customer requested ONT reboot',
        metadata: JSON.stringify({ deviceId: device.id }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Perintah reboot telah dikirim ke perangkat.'
    });

  } catch (error: any) {
    console.error('Customer ONT reboot error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengirim perintah reboot' },
      { status: 500 }
    );
  }
}
