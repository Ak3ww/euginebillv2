import { prisma } from '@/server/db/client';
import { MikroTikConnection } from '../mikrotik/client';

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const CWMP_NS = 'urn:dslforum-org:cwmp-1-0';
const XSD_NS  = 'http://www.w3.org/2001/XMLSchema';
const XSI_NS  = 'http://www.w3.org/2001/XMLSchema-instance';
const SOAP_ENC_NS = 'http://schemas.xmlsoap.org/soap/encoding/';

// TR-069 Parameter OID map — multi-vendor support (ZTE primary)
export const ZteParamMap = {
  // WiFi 2.4GHz
  ssid:             'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID',
  wifiPassword:     'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey',
  wifiEnable:       'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Enable',
  wifiChannel:      'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.Channel',

  // WiFi 5GHz
  ssid5g:           'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID',
  wifiPassword5g:   'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey',
  wifiEnable5g:     'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.Enable',

  // PPPoE WAN
  pppoeUsername:    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Username',
  pppoePassword:    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.Password',
  wanExternalIp:    'InternetGatewayDevice.WANDevice.1.WANConnectionDevice.1.WANPPPConnection.1.ExternalIPAddress',

  // GPON Optical Signal
  rxPower:          'InternetGatewayDevice.WANDevice.1.X_ZTE-COM_PONInterfaceConfig.RxPower',
  txPower:          'InternetGatewayDevice.WANDevice.1.X_ZTE-COM_PONInterfaceConfig.TxPower',
  rxPowerAlt:       'InternetGatewayDevice.WANDevice.1.WANDSLDiagnostics.ReceiveAttenuation',
  rxPowerAlt2:      'InternetGatewayDevice.WANDevice.1.WANDSLInterfaceConfig.OpticalSignalLevel',

  // Device Info
  hardwareVersion:  'InternetGatewayDevice.DeviceInfo.HardwareVersion',
  softwareVersion:  'InternetGatewayDevice.DeviceInfo.SoftwareVersion',
  uptime:           'InternetGatewayDevice.DeviceInfo.UpTime',

  // ACS Management
  periodicInformInterval: 'InternetGatewayDevice.ManagementServer.PeriodicInformInterval',
  periodicInformEnable:   'InternetGatewayDevice.ManagementServer.PeriodicInformEnable',
  connectionRequestUrl:   'InternetGatewayDevice.ManagementServer.ConnectionRequestURL',

  // LAN Hosts
  hostCount:        'InternetGatewayDevice.LANDevice.1.Hosts.HostNumberOfEntries',
};

// Parameter set yang standar (pasti ada di semua ONT)
export const BASIC_PARAM_SET = [
  ZteParamMap.ssid,
  ZteParamMap.wifiPassword,
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_HW_PreSharedKey',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_ZTE-COM_PreSharedKey',
  ZteParamMap.pppoeUsername,
  ZteParamMap.wanExternalIp,
  ZteParamMap.hardwareVersion,
  ZteParamMap.softwareVersion,
  ZteParamMap.uptime,
  ZteParamMap.periodicInformInterval,
  ZteParamMap.hostCount,
];

// Parameter set tambahan (5GHz, Redaman GPON multi-vendor ZTE/Huawei/Fiberhome)
export const ADVANCED_PARAM_SET = [
  ZteParamMap.ssid5g,
  ZteParamMap.wifiPassword5g,
  ZteParamMap.wifiEnable5g,
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.PreSharedKey',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.KeyPassphrase',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.Enable',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase',
  'InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey',
  ZteParamMap.rxPower,
  ZteParamMap.txPower,
  'InternetGatewayDevice.WANDevice.1.X_HW_PONInterfaceConfig.RxPower',
  'InternetGatewayDevice.WANDevice.1.X_FH_PONInterfaceConfig.RxPower',
];

// Parameter untuk ambil daftar connected devices (Hosts)
// Diperlukan HostNumberOfEntries dulu, lalu loop per-entry
export const HOST_BASE_PARAMS = (n: number): string[] => {
  const base = `InternetGatewayDevice.LANDevice.1.Hosts.Host.${n}.`;
  return [
    base + 'MACAddress',
    base + 'IPAddress',
    base + 'HostName',
    base + 'UserHostName',
    base + 'X_ZTE-COM_HostName',
    base + 'X_HW_HostName',
    base + 'DeviceName',
    base + 'InterfaceType',
    base + 'Active',
    base + 'AddressSource',
  ];
};

// Interval minimal antara full-refresh (ms) — 10 menit
const FULL_REFRESH_INTERVAL_MS = 10 * 60 * 1000;

// ─────────────────────────────────────────────
// Helper: parse rxPower raw value → dBm float
// ─────────────────────────────────────────────
function parseRxPower(raw: string | undefined): number | null {
  if (!raw) return null;
  const n = parseFloat(raw);
  if (isNaN(n)) return null;
  if (n < -1000) return n / 1000;
  if (n < -100 && n > -1000) return n / 10;
  return n;
}

// ─────────────────────────────────────────────
// Helper: extract connected devices dari params
// ─────────────────────────────────────────────
function extractConnectedDevices(params: Record<string, string>): { mac: string; ip: string; hostname: string; interface: string; active: boolean }[] {
  const hosts: { mac: string; ip: string; hostname: string; interface: string; active: boolean }[] = [];
  const hostPrefix = 'InternetGatewayDevice.LANDevice.1.Hosts.Host.';

  // Kumpulkan semua indeks host yang ada
  const indices = new Set<number>();
  for (const key of Object.keys(params)) {
    if (key.startsWith(hostPrefix)) {
      const rest = key.slice(hostPrefix.length);
      const idx = parseInt(rest.split('.')[0], 10);
      if (!isNaN(idx)) indices.add(idx);
    }
  }

  for (const idx of Array.from(indices).sort((a, b) => a - b)) {
    const base = `${hostPrefix}${idx}.`;
    const mac = params[base + 'MACAddress'] || '';
    const ip = params[base + 'IPAddress'] || '';
    if (!mac && !ip) continue;

    let rawHostname =
      params[base + 'HostName'] ||
      params[base + 'UserHostName'] ||
      params[base + 'X_ZTE-COM_HostName'] ||
      params[base + 'X_HW_HostName'] ||
      params[base + 'DeviceName'] ||
      '';

    let cleanedHostname = rawHostname.trim();
    // Jika hostname cuma berupa angka murni (seperti "1", "2", "3") atau "Host1", bersihkan agar tidak aneh di UI
    if (cleanedHostname && (!isNaN(Number(cleanedHostname)) || /^Host\s*\d+$/i.test(cleanedHostname))) {
      cleanedHostname = '';
    }

    hosts.push({
      mac,
      ip,
      hostname: cleanedHostname,
      interface: params[base + 'InterfaceType'] || '',
      active: (params[base + 'Active'] || '').toLowerCase() === 'true' || (params[base + 'Active'] || '') === '1',
    });
  }
  return hosts;
}

export class CwmpService {
  /**
   * Extract the text content of a simple XML element.
   */
  static xmlValue(xml: string, tag: string): string {
    const re = new RegExp(`<(?:[\\w-]+:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[\\w-]+:)?${tag}>`, 'i');
    const m = xml.match(re);
    return m ? m[1].trim() : '';
  }

  static hasCwmpMethod(xml: string, method: string): boolean {
    const re = new RegExp(`<(?:[\\w-]+:)?${method}[\\s>]`, 'i');
    return re.test(xml);
  }

  static extractCwmpId(xml: string): string {
    const m = xml.match(/<(?:[\w-]+:)?ID[^>]*>([\s\S]*?)<\/(?:[\w-]+:)?ID>/i);
    return m ? m[1].trim() : '1';
  }

  static parseDeviceId(xml: string) {
    const deviceIdBlock = this.xmlValue(xml, 'DeviceId');
    if (!deviceIdBlock) return null;
    return {
      Manufacturer: this.xmlValue(deviceIdBlock, 'Manufacturer'),
      OUI: this.xmlValue(deviceIdBlock, 'OUI'),
      SerialNumber: this.xmlValue(deviceIdBlock, 'SerialNumber'),
      ProductClass: this.xmlValue(deviceIdBlock, 'ProductClass'),
    };
  }

  /**
   * Parse ConnectionRequestURL dari Inform ParameterList
   */
  static parseConnectionRequestUrl(xml: string): string {
    // Cari di ParameterList dari Inform message
    const structRe = /<(?:[\w-]+:)?ParameterValueStruct>([\s\S]*?)<\/(?:[\w-]+:)?ParameterValueStruct>/gi;
    let m;
    while ((m = structRe.exec(xml)) !== null) {
      const block = m[1];
      const name = this.xmlValue(block, 'Name');
      if (name && name.includes('ConnectionRequestURL')) {
        return this.xmlValue(block, 'Value');
      }
    }
    return '';
  }

  static parseParameterValues(xml: string): Record<string, string> {
    const params: Record<string, string> = {};
    const structRe = /<(?:[\w-]+:)?ParameterValueStruct>([\s\S]*?)<\/(?:[\w-]+:)?ParameterValueStruct>/gi;
    let m;
    while ((m = structRe.exec(xml)) !== null) {
      const block = m[1];
      const name = this.xmlValue(block, 'Name');
      const value = this.xmlValue(block, 'Value');
      if (name) {
        params[name] = value;
      }
    }
    return params;
  }

  static parseFault(xml: string) {
    if (!/<(?:[\w-]+:)?Fault/i.test(xml)) return null;
    return {
      faultCode: this.xmlValue(xml, 'FaultCode') || this.xmlValue(xml, 'faultcode'),
      faultString: this.xmlValue(xml, 'FaultString') || this.xmlValue(xml, 'faultstring'),
    };
  }

  // --- SOAP BUILDERS ---

  static soapEnvelopeWrap(cwmpId: string, bodyContent: string): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope
  xmlns:soap="${SOAP_NS}"
  xmlns:cwmp="${CWMP_NS}"
  xmlns:xsd="${XSD_NS}"
  xmlns:xsi="${XSI_NS}"
  xmlns:soap-enc="${SOAP_ENC_NS}">
  <soap:Header>
    <cwmp:ID soap:mustUnderstand="1">${cwmpId}</cwmp:ID>
  </soap:Header>
  <soap:Body>
    ${bodyContent}
  </soap:Body>
</soap:Envelope>`;
  }

  static buildInformResponse(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:InformResponse>
        <MaxEnvelopes>1</MaxEnvelopes>
      </cwmp:InformResponse>`
    );
  }

  static buildReboot(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:Reboot>
        <CommandKey>reboot-${Date.now()}</CommandKey>
      </cwmp:Reboot>`
    );
  }

  static buildFactoryReset(cwmpId: string): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:FactoryReset></cwmp:FactoryReset>`
    );
  }

  static buildSetParameterValues(cwmpId: string, parameterValues: Array<{name: string, value: string, type?: string}>): string {
    const pvList = parameterValues.map(pv => {
      const xsdType = pv.type || 'xsd:string';
      return `        <ParameterValueStruct>
          <Name>${this.escapeXml(pv.name)}</Name>
          <Value xsi:type="${this.escapeXml(xsdType)}">${this.escapeXml(String(pv.value))}</Value>
        </ParameterValueStruct>`;
    }).join('\n');

    const arrayType = `cwmp:ParameterValueStruct[${parameterValues.length}]`;

    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:SetParameterValues>
        <ParameterList soap-enc:arrayType="${arrayType}">
${pvList}
        </ParameterList>
        <ParameterKey>${Date.now()}</ParameterKey>
      </cwmp:SetParameterValues>`
    );
  }

  static buildGetParameterValues(cwmpId: string, parameterNames: string[]): string {
    const names = parameterNames.map(n =>
      `        <string>${this.escapeXml(n)}</string>`
    ).join('\n');

    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:GetParameterValues>
        <ParameterNames soap-enc:arrayType="xsd:string[${parameterNames.length}]">
${names}
        </ParameterNames>
      </cwmp:GetParameterValues>`
    );
  }

  static escapeXml(str: string): string {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // --- DEVICE DB OPS ---

  /**
   * Upsert device saat Inform masuk.
   * - Create jika baru, update ipAddress + lastInform + status jika sudah ada
   * - Auto-queue GetParameterValues full jika belum pernah di-refresh dalam FULL_REFRESH_INTERVAL_MS
   * - Auto-queue SetParameterValues untuk set PeriodicInformInterval = 300 jika interval saat ini > 300
   */
  static async upsertDevice(
    deviceId: string,
    deviceInfo: { Manufacturer?: string; OUI?: string; ProductClass?: string; SerialNumber?: string },
    ipAddress: string,
    connectionRequestUrl?: string
  ) {
    let device = await prisma.acsDevice.findUnique({ where: { serialNumber: deviceId } });

    if (device) {
      device = await prisma.acsDevice.update({
        where: { serialNumber: deviceId },
        data: {
          ipAddress,
          lastInform: new Date(),
          status: 'online',
          informCount: { increment: 1 },
          ...(connectionRequestUrl ? { connectionRequestUrl } : {}),
        }
      });
    } else {
      const company = await prisma.company.findFirst();
      if (!company) throw new Error('No company found');
      device = await prisma.acsDevice.create({
        data: {
          serialNumber: deviceId,
          oui: deviceInfo.OUI || '',
          productClass: deviceInfo.ProductClass || '',
          manufacturer: deviceInfo.Manufacturer || '',
          ipAddress,
          lastInform: new Date(),
          status: 'online',
          informCount: 1,
          companyId: company.id,
          ...(connectionRequestUrl ? { connectionRequestUrl } : {}),
        }
      });
      console.log(`[Built-in ACS] ✨ New device registered: ${deviceId} (${deviceInfo.Manufacturer} ${deviceInfo.ProductClass})`);
    }

    // Queue full refresh jika:
    // 1. Belum pernah ada task GetParameterValues, ATAU
    // 2. Task GetParameterValues terakhir sudah > FULL_REFRESH_INTERVAL_MS yang lalu
    const lastRefreshTask = await prisma.acsTask.findFirst({
      where: { deviceId: device.id, name: 'GetParameterValues' },
      orderBy: { createdAt: 'desc' },
    });

    const needsRefresh = !lastRefreshTask ||
      (Date.now() - lastRefreshTask.createdAt.getTime()) > FULL_REFRESH_INTERVAL_MS;

    if (needsRefresh) {
      // Hapus pending GetParameterValues yang sudah ada supaya tidak numpuk
      await prisma.acsTask.deleteMany({
        where: { deviceId: device.id, name: 'GetParameterValues', status: 'pending' }
      });

      // Task 1: Basic Parameters (Pasti sukses)
      await prisma.acsTask.create({
        data: {
          name: 'GetParameterValues',
          command: 'GetParameterValues',
          payload: JSON.stringify({ parameterNames: BASIC_PARAM_SET }),
          status: 'pending',
          deviceId: device.id,
        }
      });
      
      // Task 2: Advanced Parameters (Bisa jadi gagal jika ONT single-band atau bukan ZTE, tapi tidak akan membatalkan Task 1)
      await prisma.acsTask.create({
        data: {
          name: 'GetParameterValues',
          command: 'GetParameterValues',
          payload: JSON.stringify({ parameterNames: ADVANCED_PARAM_SET }),
          status: 'pending',
          deviceId: device.id,
        }
      });
      console.log(`[Built-in ACS] 📡 Queued basic & advanced parameter refresh for ${deviceId}`);
    }

    return device;
  }

  static async getNextTask(deviceDbId: string) {
    return await prisma.acsTask.findFirst({
      where: { deviceId: deviceDbId, status: 'pending' },
      orderBy: { createdAt: 'asc' }
    });
  }

  static async markTaskDone(taskId: string, status: string = 'success') {
    await prisma.acsTask.update({
      where: { id: taskId },
      data: { status }
    });
  }

  /**
   * Proses GetParameterValuesResponse:
   * 1. Merge params baru ke JSON blob
   * 2. Ekstrak ke kolom dedicated (ssid, rxPower, dll)
   * 3. Parse connected devices (Hosts)
   * 4. Auto-link pppoeUserId
   * 5. Auto-set PeriodicInformInterval ke 300 jika > 300
   */
  static async markTaskDoneWithResult(taskId: string, status: string = 'success', result: any) {
    const task = await prisma.acsTask.findUnique({ where: { id: taskId }, include: { device: true } });

    if (task && task.name === 'GetParameterValues' && result) {
      const existingParams = (task.device.parameters as Record<string, any>) || {};
      const newParams: Record<string, string> = { ...existingParams, ...result };

      // ─── Extract dedicated fields ───────────────────────────────────
      const ssid         = newParams[ZteParamMap.ssid] || newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.SSID'] || task.device.ssid || null;
      const ssid5g       = newParams[ZteParamMap.ssid5g] || newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.SSID'] || newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.SSID'] || task.device.ssid5g || null;
      const wifiPassword =
        newParams[ZteParamMap.wifiPassword] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.KeyPassphrase'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_HW_PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.X_ZTE-COM_PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.1.PreSharedKey.1.PreSharedKey'] ||
        task.device.wifiPassword ||
        null;

      const wifiPass5g   =
        newParams[ZteParamMap.wifiPassword5g] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.KeyPassphrase'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.KeyPassphrase'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.2.PreSharedKey.1.PreSharedKey'] ||
        newParams['InternetGatewayDevice.LANDevice.1.WLANConfiguration.5.PreSharedKey.1.PreSharedKey'] ||
        task.device.wifiPassword5g ||
        null;
      const hwVersion    = newParams[ZteParamMap.hardwareVersion] || task.device.hardwareVersion || null;
      const swVersion    = newParams[ZteParamMap.softwareVersion] || task.device.softwareVersion || null;
      const wanIp        = newParams[ZteParamMap.wanExternalIp] || task.device.wanIpAddress || null;

      // Uptime (dalam detik)
      const uptimeRaw = newParams[ZteParamMap.uptime];
      const deviceUptime = uptimeRaw ? parseInt(uptimeRaw, 10) || null : task.device.deviceUptime;

      // RxPower / TxPower (ZTE / Huawei / FiberHome / Alt)
      const rxPowerRaw = newParams[ZteParamMap.rxPower] ||
        newParams['InternetGatewayDevice.WANDevice.1.X_HW_PONInterfaceConfig.RxPower'] ||
        newParams['InternetGatewayDevice.WANDevice.1.X_FH_PONInterfaceConfig.RxPower'] ||
        newParams[ZteParamMap.rxPowerAlt] ||
        newParams[ZteParamMap.rxPowerAlt2];
      const rxPower = parseRxPower(rxPowerRaw);
      const txPowerRaw = newParams[ZteParamMap.txPower];
      const txPower = txPowerRaw ? parseFloat(txPowerRaw) || null : task.device.txPower;

      // PeriodicInformInterval
      const piRaw = newParams[ZteParamMap.periodicInformInterval];
      const periodicInformInterval = piRaw ? parseInt(piRaw, 10) || null : task.device.periodicInformInterval;

      // ─── Connected Devices (LAN Hosts) ──────────────────────────────
      const connectedDevicesList = extractConnectedDevices(newParams);
      const connectedDevicesCount = connectedDevicesList.length > 0
        ? connectedDevicesList.length
        : (newParams[ZteParamMap.hostCount] ? parseInt(newParams[ZteParamMap.hostCount], 10) || null : task.device.connectedDevicesCount);

      // ─── Auto-link PPPoE user ────────────────────────────────────────
      let matchedUserId: string | null = task.device.pppoeUserId || null;
      if (!matchedUserId) {
        let rawPppUsername = '';
        for (const [k, v] of Object.entries(newParams)) {
          if (k.toLowerCase().includes('wanpppconnection') && k.toLowerCase().includes('username')) {
            rawPppUsername = String(v || '').trim();
            if (rawPppUsername) break;
          }
        }

        if (rawPppUsername) {
          const cleanUsername = rawPppUsername.split('@')[0].trim();
          const pppUser = await prisma.pppoeUser.findFirst({
            where: {
              OR: [
                { username: { equals: rawPppUsername } },
                { username: { equals: cleanUsername } },
              ]
            }
          });
          if (pppUser) {
            matchedUserId = pppUser.id;
            console.log(`[Built-in ACS] 🔗 Auto-linked ${task.device.serialNumber} → PPPoE: ${pppUser.username}`);
          }
        }
      }

      // ─── Persist ke DB ───────────────────────────────────────────────
      await prisma.acsDevice.update({
        where: { id: task.deviceId },
        data: {
          parameters: newParams,
          pppoeUserId: matchedUserId || undefined,
          ssid:        ssid ?? undefined,
          ssid5g:      ssid5g ?? undefined,
          wifiPassword: wifiPassword ?? undefined,
          wifiPassword5g: wifiPass5g ?? undefined,
          hardwareVersion: hwVersion ?? undefined,
          softwareVersion: swVersion ?? undefined,
          wanIpAddress: wanIp ?? undefined,
          rxPower:     rxPower !== null ? rxPower : undefined,
          txPower:     txPower !== null ? txPower : undefined,
          deviceUptime: deviceUptime !== null ? deviceUptime : undefined,
          periodicInformInterval: periodicInformInterval !== null ? periodicInformInterval : undefined,
          connectedDevicesCount: connectedDevicesCount !== null ? connectedDevicesCount : undefined,
          connectedDevices: connectedDevicesList.length > 0 ? connectedDevicesList : undefined,
        }
      });

      // ─── Auto-percepat PeriodicInformInterval ke 300s jika > 300 ─────
      if (periodicInformInterval && periodicInformInterval > 300) {
        const alreadyQueued = await prisma.acsTask.findFirst({
          where: { deviceId: task.deviceId, name: 'SetPeriodicInform', status: 'pending' }
        });
        if (!alreadyQueued) {
          await prisma.acsTask.create({
            data: {
              name: 'SetPeriodicInform',
              command: 'SetParameterValues',
              payload: JSON.stringify({
                parameterValues: [
                  { name: ZteParamMap.periodicInformInterval, value: '300', type: 'xsd:unsignedInt' },
                  { name: ZteParamMap.periodicInformEnable, value: 'true', type: 'xsd:boolean' },
                ]
              }),
              status: 'pending',
              deviceId: task.deviceId,
            }
          });
          console.log(`[Built-in ACS] ⚡ Queued PeriodicInformInterval=300 for ${task.device.serialNumber} (was: ${periodicInformInterval}s)`);
        }
      }
    }

    await prisma.acsTask.update({
      where: { id: taskId },
      data: { status, result }
    });
  }

  /**
   * Queue GetParameterValues untuk semua parameter + Hosts
   */
  static async queueRefreshTask(deviceId: string) {
    const device = await prisma.acsDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error('Device not found');

    // Hapus pending GetParameterValues yang ada
    await prisma.acsTask.deleteMany({
      where: { deviceId: device.id, name: 'GetParameterValues', status: 'pending' }
    });

    await prisma.acsTask.create({
      data: {
        name: 'GetParameterValues',
        command: 'GetParameterValues',
        payload: JSON.stringify({ parameterNames: BASIC_PARAM_SET }),
        status: 'pending',
        deviceId: device.id,
      }
    });

    await prisma.acsTask.create({
      data: {
        name: 'GetParameterValues',
        command: 'GetParameterValues',
        payload: JSON.stringify({ parameterNames: ADVANCED_PARAM_SET }),
        status: 'pending',
        deviceId: device.id,
      }
    });
  }

  /**
   * Queue GetParameterValues khusus connected devices (Hosts)
   * Perlu tahu jumlah host dulu dari HostNumberOfEntries
   */
  static async queueConnectedDevicesRefresh(deviceId: string) {
    const device = await prisma.acsDevice.findUnique({ where: { id: deviceId } });
    if (!device) throw new Error('Device not found');

    const count = device.connectedDevicesCount || 20; // default max 20 hosts
    const params: string[] = [ZteParamMap.hostCount];
    for (let i = 1; i <= count; i++) {
      params.push(...HOST_BASE_PARAMS(i));
    }

    await prisma.acsTask.create({
      data: {
        name: 'GetConnectedDevices',
        command: 'GetParameterValues',
        payload: JSON.stringify({ parameterNames: params }),
        status: 'pending',
        deviceId: device.id,
      }
    });
  }

  /**
   * Kirim Connection Request ke device (agar segera Inform ke ACS)
   * Hanya bisa jika VPS bisa reach IP device di LAN
   */
  static async sendConnectionRequest(deviceId: string): Promise<{ success: boolean; error?: string }> {
    const device = await prisma.acsDevice.findUnique({ where: { id: deviceId } });
    if (!device) return { success: false, error: 'Device not found' };
    if (!device.connectionRequestUrl) return { success: false, error: 'Connection Request URL tidak tersedia. Perangkat belum mengirimkan URL-nya.' };

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(device.connectionRequestUrl, {
        method: 'GET',
        signal: controller.signal,
        // Basic auth — ZTE biasanya username/password kosong atau admin/admin
        headers: {
          'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
        }
      });
      clearTimeout(timeoutId);

      if (res.ok || res.status === 204 || res.status === 200) {
        console.log(`[Built-in ACS] ✅ Connection Request sent to ${device.serialNumber}: HTTP ${res.status}`);
        return { success: true };
      } else {
        return { success: false, error: `HTTP ${res.status} dari ${device.connectionRequestUrl}` };
      }
    } catch (err: any) {
      const msg = err.name === 'AbortError' ? 'Timeout (10s) — VPS mungkin tidak bisa reach IP device' : err.message;
      console.warn(`[Built-in ACS] ⚠️ Connection Request failed for ${device.serialNumber}: ${msg}`);
      return { success: false, error: msg };
    }
  }

  static buildAddObject(cwmpId: string, objectName: string, parameterKey: string = ''): string {
    return this.soapEnvelopeWrap(cwmpId,
      `<cwmp:AddObject>
        <ObjectName>${this.escapeXml(objectName)}</ObjectName>
        <ParameterKey>${this.escapeXml(parameterKey)}</ParameterKey>
      </cwmp:AddObject>`
    );
  }

  // ─── SESSION MANAGEMENT (DB-based) ───────────────────────────────────────

  static async getOrCreateSession(sessionId: string): Promise<{ serialNumber: string | null; deviceDbId: string | null; currentTaskId: string | null }> {
    // Hapus session expired
    await prisma.acsSession.deleteMany({
      where: { expiresAt: { lt: new Date() } }
    }).catch(() => {}); // non-blocking

    let session = await prisma.acsSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      session = await prisma.acsSession.create({
        data: {
          id: sessionId,
          expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 menit
        }
      });
    } else {
      // Refresh TTL
      await prisma.acsSession.update({
        where: { id: sessionId },
        data: { expiresAt: new Date(Date.now() + 30 * 60 * 1000) }
      });
    }
    return {
      serialNumber: session.serialNumber,
      deviceDbId: session.deviceDbId,
      currentTaskId: session.currentTaskId,
    };
  }

  static async updateSession(sessionId: string, data: { serialNumber?: string; deviceDbId?: string; currentTaskId?: string | null }) {
    await prisma.acsSession.update({
      where: { id: sessionId },
      data: {
        ...data,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000),
      }
    }).catch(() => {});
  }

  static async clearSessionTask(sessionId: string) {
    await prisma.acsSession.update({
      where: { id: sessionId },
      data: { currentTaskId: null }
    }).catch(() => {});
  }

  // ─── OFFLINE DETECTION ───────────────────────────────────────────────────

  /**
   * Tandai device sebagai offline jika lastInform > thresholdMinutes menit yang lalu.
   * Disempurnakan: Sebelum menandai offline, periksa apakah ada sesi PPPoE aktif di radacct.
   * Jika sesi aktif, device PASTI online.
   */
  static async runOfflineDetection(thresholdMinutes: number = 12): Promise<{ marked: number }> {
    const threshold = new Date(Date.now() - thresholdMinutes * 60 * 1000);

    // Ambil device yang berpotensi offline (online tapi lastInform lewat batas)
    const candidates = await prisma.acsDevice.findMany({
      where: {
        status: 'online',
        lastInform: { lt: threshold }
      }
    });

    if (candidates.length === 0) return { marked: 0 };

    let marked = 0;

    for (const device of candidates) {
      let isReallyOffline = true;

      // Cek apakah device ini punya pppoeUserId
      if (device.pppoeUserId) {
        // Cek sesi aktif di radacct melalui username PPPoE-nya
        const user = await prisma.pppoeUser.findUnique({
          where: { id: device.pppoeUserId },
          select: { username: true }
        });

        if (user && user.username) {
          const activeSession = await prisma.mikrotikSession.findFirst({
            where: {
              username: user.username,
              stopTime: null
            }
          });
          
          if (activeSession) {
            // Sesi PPPoE aktif! Modem ini sebenarnya masih online.
            // Kita skip menandai offline, dan sekalian update lastInform biar gak terus masuk kandidat
            isReallyOffline = false;
            await prisma.acsDevice.update({
              where: { id: device.id },
              data: { lastInform: new Date() }
            });
            console.log(`[Built-in ACS] 🛡️ ${device.serialNumber} saved from offline status (PPPoE session is active)`);
          }
        }
      }

      if (isReallyOffline) {
        await prisma.acsDevice.update({
          where: { id: device.id },
          data: { status: 'offline' }
        });
        marked++;
      }
    }

    if (marked > 0) {
      console.log(`[Built-in ACS] 🔴 Marked ${marked} device(s) as offline`);
    }

    return { marked };
  }

  /**
   * Tarik DHCP lease dari MikroTik dan paksa ONT untuk Inform dengan mengirim Connection Request.
   * Hanya untuk IP yang BELUM online di ACS untuk menghindari spamming.
   */
  static async syncAcsFromDhcp(): Promise<{ triggered: number; errors: number }> {
    let triggered = 0;
    let errors = 0;

    const routers = await prisma.router.findMany({
      where: { isActive: true },
    });

    // Ambil IP yang sudah online di ACS
    const onlineDevices = await prisma.acsDevice.findMany({
      where: { status: 'online', ipAddress: { not: null } },
      select: { ipAddress: true }
    });
    const onlineIps = new Set(onlineDevices.map(d => d.ipAddress));

    for (const router of routers) {
      const apiPort = router.port || 8728;
      const conn = new MikroTikConnection({
        host: router.ipAddress,
        username: router.username,
        password: router.password,
        port: apiPort,
        tls: false,
      });

      try {
        await conn.connect();
        
        // Ambil lease DHCP yang bound (aktif)
        const leases = await conn.execute('/ip/dhcp-server/lease/print', ['?status=bound']);
        
        const chunkSize = 20;
        for (let i = 0; i < leases.length; i += chunkSize) {
          const chunk = leases.slice(i, i + chunkSize);
          await Promise.all(chunk.map(async (lease: any) => {
            const ip = lease.address;
            // Skip jika IP sudah online di ACS, jangan di-spam!
            if (!ip || onlineIps.has(ip)) return;

            try {
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 1500); // 1.5 detik timeout

              const res = await fetch(`http://${ip}:7547/`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                  'Authorization': 'Basic ' + Buffer.from('admin:admin').toString('base64'),
                }
              }).catch(() => null);

              clearTimeout(timeoutId);

              if (res) {
                triggered++;
              }
            } catch (e) {
              // Ignore
            }
          }));
        }

        await conn.disconnect();
      } catch (err: any) {
        console.error(`[Built-in ACS] DHCP Sync failed for router ${router.name}:`, err.message);
        errors++;
      }
    }

    return { triggered, errors };
  }
}
