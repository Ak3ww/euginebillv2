import { NextRequest, NextResponse } from 'next/server';
import { CwmpService } from '@/server/services/acs/cwmp.service';

// In-memory session store (simple implementation for this example)
// In production, this should ideally be in Redis or DB if running multiple instances
const sessions = new Map<string, { deviceId: string, currentTaskId?: string }>();

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const sessionId = req.cookies.get('acs_session')?.value || crypto.randomUUID();
    
    // Create new session if doesn't exist
    if (!sessions.has(sessionId)) {
      sessions.set(sessionId, { deviceId: '' });
    }
    const session = sessions.get(sessionId)!;
    
    let responseXml = '';
    const cwmpId = CwmpService.extractCwmpId(rawBody) || '1';
    const ipAddress = req.headers.get('x-forwarded-for') || req.ip || '127.0.0.1';

    if (rawBody.trim().length === 0) {
      // Empty POST - device is asking for tasks
      if (session.deviceId) {
        const nextTask = await CwmpService.getNextTask(session.deviceId);
        if (nextTask) {
          session.currentTaskId = nextTask.id;
          if (nextTask.name === 'Reboot') {
            responseXml = CwmpService.buildReboot(cwmpId);
          } else if (nextTask.name === 'FactoryReset') {
            responseXml = CwmpService.buildFactoryReset(cwmpId);
          } else if (nextTask.name === 'SetParameterValues') {
            try {
              const payload = JSON.parse(nextTask.payload || '{}');
              responseXml = CwmpService.buildSetParameterValues(cwmpId, payload.parameterValues || []);
            } catch (e) {
              console.error('Failed to parse SetParameterValues payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
            }
          } else if (nextTask.name === 'AddObject') {
            try {
              const payload = JSON.parse(nextTask.payload || '{}');
              responseXml = CwmpService.buildAddObject(cwmpId, payload.objectName || '');
            } catch (e) {
              console.error('Failed to parse AddObject payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
            }
          } else if (nextTask.name === 'GetParameterValues') {
            try {
              const payload = JSON.parse(nextTask.payload || '{}');
              responseXml = CwmpService.buildGetParameterValues(cwmpId, payload.parameterNames || []);
            } catch (e) {
              console.error('Failed to parse GetParameterValues payload', e);
              await CwmpService.markTaskDone(nextTask.id, 'failed');
            }
          }
        }
      }
    } else if (CwmpService.hasCwmpMethod(rawBody, 'Inform')) {
      const deviceInfo = CwmpService.parseDeviceId(rawBody);
      if (deviceInfo && deviceInfo.SerialNumber) {
        session.deviceId = deviceInfo.SerialNumber;
        await CwmpService.upsertDevice(deviceInfo.SerialNumber, deviceInfo, ipAddress);
        responseXml = CwmpService.buildInformResponse(cwmpId);
      } else {
        return new NextResponse('Bad Request', { status: 400 });
      }
    } else if (CwmpService.hasCwmpMethod(rawBody, 'TransferComplete') || 
               CwmpService.hasCwmpMethod(rawBody, 'RebootResponse') ||
               CwmpService.hasCwmpMethod(rawBody, 'FactoryResetResponse') ||
               CwmpService.hasCwmpMethod(rawBody, 'SetParameterValuesResponse') ||
               CwmpService.hasCwmpMethod(rawBody, 'AddObjectResponse')) {
      
      // Mark current task as done if exists
      if (session.currentTaskId) {
        await CwmpService.markTaskDone(session.currentTaskId, 'success');
        session.currentTaskId = undefined;
      }
      
      // We can respond with empty 204 or check for another task immediately.
    } else if (CwmpService.hasCwmpMethod(rawBody, 'GetParameterValuesResponse')) {
      if (session.currentTaskId) {
        const values = CwmpService.parseParameterValues(rawBody);
        await CwmpService.markTaskDoneWithResult(session.currentTaskId, 'success', values);
        session.currentTaskId = undefined;
      }
    } else if (CwmpService.hasCwmpMethod(rawBody, 'Fault')) {
      if (session.currentTaskId) {
        const fault = CwmpService.parseFault(rawBody);
        await CwmpService.markTaskDoneWithResult(session.currentTaskId, 'failed', fault);
        session.currentTaskId = undefined;
      }
    } else {
      // Unhandled method, usually just ignore or 204
    }

    if (responseXml) {
      const res = new NextResponse(responseXml, {
        status: 200,
        headers: {
          'Content-Type': 'text/xml',
          'Server': 'EugineBill ACS'
        }
      });
      res.cookies.set('acs_session', sessionId, { httpOnly: true, path: '/api/cwmp' });
      return res;
    } else {
      const res = new NextResponse(null, { status: 204 });
      res.cookies.set('acs_session', sessionId, { httpOnly: true, path: '/api/cwmp' });
      return res;
    }

  } catch (error) {
    console.error('CWMP Error:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
