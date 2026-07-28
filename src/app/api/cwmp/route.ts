import { NextRequest, NextResponse } from 'next/server';
import { CwmpService } from '@/server/services/acs/cwmp.service';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // Session ID dari cookie, atau buat baru
    const sessionId = req.cookies.get('acs_session')?.value || crypto.randomUUID();

    // Ambil/buat session dari DB (persistent, tidak hilang saat restart)
    const session = await CwmpService.getOrCreateSession(sessionId);

    let responseXml = '';
    const cwmpId = CwmpService.extractCwmpId(rawBody) || '1';
    const ipAddress = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      || req.headers.get('x-real-ip')
      || '127.0.0.1';

    if (rawBody.trim().length === 0) {
      // ── Empty POST: device meminta task berikutnya ──────────────────
      if (session.deviceDbId) {
        const nextTask = await CwmpService.getNextTask(session.deviceDbId);

        if (nextTask) {
          await CwmpService.updateSession(sessionId, { currentTaskId: nextTask.id });

          if (nextTask.name === 'Reboot') {
            responseXml = CwmpService.buildReboot(cwmpId);

          } else if (nextTask.name === 'FactoryReset') {
            responseXml = CwmpService.buildFactoryReset(cwmpId);

          } else if (
            nextTask.name === 'SetParameterValues' ||
            nextTask.name === 'SetPeriodicInform'
          ) {
            try {
              const payload = JSON.parse((nextTask.payload as string) || '{}');
              responseXml = CwmpService.buildSetParameterValues(cwmpId, payload.parameterValues || []);
            } catch (e) {
              console.error('[CWMP] Failed to parse SetParameterValues payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
              await CwmpService.clearSessionTask(sessionId);
            }

          } else if (nextTask.name === 'AddObject') {
            try {
              const payload = JSON.parse((nextTask.payload as string) || '{}');
              responseXml = CwmpService.buildAddObject(cwmpId, payload.objectName || '');
            } catch (e) {
              console.error('[CWMP] Failed to parse AddObject payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
              await CwmpService.clearSessionTask(sessionId);
            }

          } else if (
            nextTask.name === 'GetParameterValues' ||
            nextTask.name === 'GetConnectedDevices'
          ) {
            try {
              const payload = JSON.parse((nextTask.payload as string) || '{}');
              responseXml = CwmpService.buildGetParameterValues(cwmpId, payload.parameterNames || []);
            } catch (e) {
              console.error('[CWMP] Failed to parse GetParameterValues payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
              await CwmpService.clearSessionTask(sessionId);
            }
          }
        }
      }

    } else if (CwmpService.hasCwmpMethod(rawBody, 'Inform')) {
      // ── Inform: device registrasi / heartbeat ───────────────────────
      const deviceInfo = CwmpService.parseDeviceId(rawBody);
      const connectionRequestUrl = CwmpService.parseConnectionRequestUrl(rawBody);

      if (deviceInfo?.SerialNumber) {
        const device = await CwmpService.upsertDevice(
          deviceInfo.SerialNumber,
          deviceInfo,
          ipAddress,
          connectionRequestUrl || undefined
        );

        // Simpan ke session
        await CwmpService.updateSession(sessionId, {
          serialNumber: device.serialNumber,
          deviceDbId: device.id,
        });

        responseXml = CwmpService.buildInformResponse(cwmpId);
        console.log(`[CWMP] ✅ Inform from ${device.serialNumber} (IP: ${ipAddress})`);
      } else {
        return new NextResponse('Bad Request: missing SerialNumber', { status: 400 });
      }

    } else if (
      CwmpService.hasCwmpMethod(rawBody, 'TransferComplete') ||
      CwmpService.hasCwmpMethod(rawBody, 'RebootResponse') ||
      CwmpService.hasCwmpMethod(rawBody, 'FactoryResetResponse') ||
      CwmpService.hasCwmpMethod(rawBody, 'SetParameterValuesResponse') ||
      CwmpService.hasCwmpMethod(rawBody, 'AddObjectResponse')
    ) {
      // ── Task berhasil dieksekusi device ─────────────────────────────
      if (session.currentTaskId) {
        await CwmpService.markTaskDone(session.currentTaskId, 'success');
        await CwmpService.clearSessionTask(sessionId);
        console.log(`[CWMP] ✅ Task ${session.currentTaskId} completed`);
      }

    } else if (CwmpService.hasCwmpMethod(rawBody, 'GetParameterValuesResponse')) {
      // ── GetParameterValues response: proses dan simpan ke DB ────────
      if (session.currentTaskId) {
        const values = CwmpService.parseParameterValues(rawBody);
        await CwmpService.markTaskDoneWithResult(session.currentTaskId, 'success', values);
        await CwmpService.clearSessionTask(sessionId);
        console.log(`[CWMP] ✅ GetParameterValues response processed (${Object.keys(values).length} params)`);
      }

    } else if (CwmpService.hasCwmpMethod(rawBody, 'Fault')) {
      // ── Device melaporkan error (Fault) ─────────────────────────────
      if (session.currentTaskId) {
        const fault = CwmpService.parseFault(rawBody);
        await CwmpService.markTaskDoneWithResult(session.currentTaskId, 'failed', fault);
        await CwmpService.clearSessionTask(sessionId);
        console.warn(`[CWMP] ⚠️ Task ${session.currentTaskId} faulted:`, fault);
      }
    }
    // else: unhandled method — respond with 204

    // ── Kirim response ──────────────────────────────────────────────────
    if (responseXml) {
      const res = new NextResponse(responseXml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'Server': 'EugineBill ACS/2.0',
        }
      });
      res.cookies.set('acs_session', sessionId, {
        httpOnly: true,
        path: '/api/cwmp',
        maxAge: 1800, // 30 menit
        sameSite: 'lax',
      });
      return res;
    } else {
      const res = new NextResponse(null, { status: 204 });
      res.cookies.set('acs_session', sessionId, {
        httpOnly: true,
        path: '/api/cwmp',
        maxAge: 1800,
        sameSite: 'lax',
      });
      return res;
    }

  } catch (error: any) {
    console.error('[CWMP] Error:', error.message);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
