import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

// Helper to verify customer token using CustomerSession
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
      include: { profile: true }
    });

    return user;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

// GET - Get customer WiFi/ONT device information using built-in ACS
export async function GET(request: NextRequest) {
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
      return NextResponse.json({
        success: false,
        reason: 'device_not_found',
        error: 'Modem/ONT tidak terdaftar untuk akun Anda'
      });
    }

    const params = (device.parameters as Record<string, any>) || {};

    // Extract rxPower (redaman PON)
    let rxPower = '-';
    const rawRxPower = params['InternetGatewayDevice.WANDevice.1.X_ZTE-COM_PONInterfaceConfig.RxPower'] || 
                       params['InternetGatewayDevice.WANDevice.1.WANDSLDiagnostics.ReceiveAttenuation'] || 
                       params['InternetGatewayDevice.WANDevice.1.WANDSLInterfaceConfig.OpticalSignalLevel'];
    if (rawRxPower) {
      const parsed = parseFloat(rawRxPower);
      if (!isNaN(parsed)) {
        rxPower = parsed > 0 || parsed < -100 ? (parsed / 100).toFixed(2) : parsed.toFixed(2);
      }
    }

    const ssid = params['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'] || '';
    const password = params['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey'] || '';

    const processedDevice = {
      _id: device.id,
      pppUsername: user.username,
      serialNumber: device.serialNumber,
      model: device.productClass || 'ZTE ONT',
      manufacturer: device.manufacturer || 'ZTE',
      softwareVersion: device.softwareVersion || '-',
      ipAddress: device.ipAddress || '-',
      uptime: '-',
      status: device.status || 'online',
      wlanConfigs: [
        {
          index: 1,
          ssid: ssid,
          enabled: true,
          channel: '-',
          standard: '-',
          security: 'WPA2-PSK',
          password: password,
          band: '2.4GHz',
          totalAssociations: 0,
          bssid: '-'
        }
      ],
      connectedHosts: [],
      signalStrength: {
        rxPower: rxPower,
        txPower: '-',
        temperature: '-'
      }
    };

    return NextResponse.json({
      success: true,
      device: processedDevice
    });

  } catch (error: any) {
    console.error('Get WiFi info error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST - Update WiFi SSID and/or password via built-in ACS
export async function POST(request: NextRequest) {
  try {
    const user = await verifyCustomerToken(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { deviceId, wlanIndex, ssid, password } = body;

    if (!deviceId || !ssid) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    if (ssid.length < 1 || ssid.length > 32) {
      return NextResponse.json(
        { success: false, error: 'SSID harus 1-32 karakter' },
        { status: 400 }
      );
    }

    if (password && (password.length < 8 || password.length > 63)) {
      return NextResponse.json(
        { success: false, error: 'Password harus 8-63 karakter' },
        { status: 400 }
      );
    }

    // Verify ownership of the device
    const device = await prisma.acsDevice.findFirst({
      where: { id: deviceId, pppoeUserId: user.id }
    });

    if (!device) {
      return NextResponse.json(
        { success: false, error: 'Device not found or not owned by customer' },
        { status: 404 }
      );
    }

    // 1. Update database immediately to reflect change on UI
    const existingParams = (device.parameters as Record<string, any>) || {};
    const newParams = { ...existingParams };
    newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'] = ssid;
    if (password) {
      newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey'] = password;
    }

    await prisma.acsDevice.update({
      where: { id: device.id },
      data: { parameters: newParams }
    });

    // 2. Queue ACS setParameterValues task
    const parameterValues = [
      { name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID', value: ssid },
      ...(password ? [{ name: 'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey', value: password }] : [])
    ];

    await prisma.acsTask.create({
      data: {
        id: crypto.randomUUID(),
        deviceId: device.id,
        command: 'SetParameterValues',
        name: 'SetParameterValues',
        payload: JSON.stringify({ parameterValues }),
        status: 'pending'
      }
    });

    // Log activity
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        username: user.username,
        module: 'customer_wifi',
        action: 'update_wifi',
        description: `Customer updated WiFi configuration: SSID = ${ssid}`,
        metadata: JSON.stringify({ deviceId, wlanIndex, ssid }),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'WiFi configuration queued for update'
    });

  } catch (error: any) {
    console.error('Update WiFi error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
