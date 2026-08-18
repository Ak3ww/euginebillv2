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

    const { serialNumber, action, ...payload } = await request.json();

    if (!serialNumber || !action) {
      return NextResponse.json({ error: 'Serial Number dan Action wajib diisi' }, { status: 400 });
    }

    const device = await prisma.acsDevice.findUnique({ where: { serialNumber } });
    if (!device) {
      return NextResponse.json({ error: 'Device tidak ditemukan' }, { status: 404 });
    }

    const { CwmpService } = await import('@/server/services/acs/cwmp.service');

    // ── RefreshData: queue GetParameterValues full ───────────────────────
    if (action === 'RefreshData') {
      await CwmpService.queueRefreshTask(device.id);
      return NextResponse.json({ success: true, message: 'Perintah ambil data terbaru diantrekan' });
    }

    // ── RefreshConnectedDevices: queue GetParameterValues khusus Hosts ───
    if (action === 'RefreshConnectedDevices') {
      await CwmpService.queueConnectedDevicesRefresh(device.id);
      return NextResponse.json({ success: true, message: 'Perintah ambil daftar perangkat WiFi diantrekan' });
    }

    // ── ConnectionRequest: push Inform sekarang ──────────────────────────
    if (action === 'ConnectionRequest') {
      const result = await CwmpService.sendConnectionRequest(device.id);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? 'Connection Request berhasil dikirim. Perangkat akan segera Inform.'
          : result.error,
        error: result.success ? undefined : result.error,
      });
    }

    // ── SetParameterValues: ubah parameter di device ────────────────────
    if (action === 'SetParameterValues' && payload.parameterValues) {
      // Optimistic update: langsung update dedicated columns + JSON blob
      const existingParams = (device.parameters as Record<string, any>) || {};
      const newParams = { ...existingParams };

      const updateData: Record<string, any> = { parameters: {} };

      for (const pv of (payload.parameterValues as { name: string; value: string }[])) {
        newParams[pv.name] = pv.value;

        // Map ke kolom dedicated
        const { ZteParamMap } = await import('@/server/services/acs/cwmp.service');
        if (pv.name === ZteParamMap.ssid || pv.name.endsWith('WLANConfiguration.1.SSID')) updateData.ssid = pv.value;
        if (pv.name === ZteParamMap.ssid5g || pv.name.endsWith('WLANConfiguration.2.SSID') || pv.name.endsWith('WLANConfiguration.5.SSID')) updateData.ssid5g = pv.value;
        if (
          pv.name === ZteParamMap.wifiPassword ||
          pv.name.includes('WLANConfiguration.1.KeyPassphrase') ||
          pv.name.includes('WLANConfiguration.1.PreSharedKey') ||
          pv.name.includes('WLANConfiguration.1.X_HW_PreSharedKey') ||
          pv.name.includes('WLANConfiguration.1.X_ZTE-COM_PreSharedKey')
        ) {
          updateData.wifiPassword = pv.value;
        }
        if (
          pv.name === ZteParamMap.wifiPassword5g ||
          pv.name.includes('WLANConfiguration.5.KeyPassphrase') ||
          pv.name.includes('WLANConfiguration.5.PreSharedKey') ||
          pv.name.includes('WLANConfiguration.2.KeyPassphrase') ||
          pv.name.includes('WLANConfiguration.2.PreSharedKey')
        ) {
          updateData.wifiPassword5g = pv.value;
        }
        if (pv.name === ZteParamMap.pppoeUsername) {
          // Juga coba re-link PPPoE user
          const clean = pv.value.split('@')[0].trim();
          const pppUser = await prisma.pppoeUser.findFirst({
            where: { OR: [{ username: pv.value }, { username: clean }] }
          });
          if (pppUser) updateData.pppoeUserId = pppUser.id;
        }
      }

      updateData.parameters = newParams;

      await prisma.acsDevice.update({
        where: { id: device.id },
        data: updateData,
      });
    }

    // Queue task ke device
    await prisma.acsTask.create({
      data: {
        deviceId: device.id,
        command: action,
        name: action,
        payload: Object.keys(payload).length > 0 ? JSON.stringify(payload) : null,
        status: 'pending',
      }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('[ACS Action] Error:', error);
    return NextResponse.json({ error: 'Gagal mengirim perintah: ' + error.message }, { status: 500 });
  }
}
