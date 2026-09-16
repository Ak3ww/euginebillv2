/**
 * HSGQ OLT SNMP/Telnet/SSH Integration
 * Supports:
 *   - HSGQ-G02ID (2-Port GPON Mini OLT)
 *   - HSGQ-G008 / HSGQ-G016 (8/16-Port GPON)
 *   - HSGQ-E04 / HSGQ-E08 (4/8-Port EPON)
 */

import { SNMPConfig, snmpGet } from '../snmp';
import { TelnetConfig, executeCommand } from '../telnet';
import { SSHConfig, executeCommand as sshExecute } from '../ssh';

// HSGQ Enterprise MIB root: 1.3.6.1.4.1.50222
const HSGQ_OIDS = {
  temperature: '1.3.6.1.4.1.50222.2.1.1.1.0',
  cpuUsage:    '1.3.6.1.4.1.50222.2.1.1.2.0',
  memoryUsage: '1.3.6.1.4.1.50222.2.1.1.3.0',
  // Host resources fallback
  hostCpu:     '1.3.6.1.2.1.25.3.3.1.2.1',
  hostMemTotal:'1.3.6.1.2.1.25.2.3.1.5.1',
  hostMemUsed: '1.3.6.1.2.1.25.2.3.1.6.1',
};

export async function getTemperature(config: SNMPConfig): Promise<number | null> {
  const result = await snmpGet(config, HSGQ_OIDS.temperature);
  if (result.success && result.value) {
    const val = parseFloat(result.value);
    if (val > 150) return val / 10;
    if (val > 1000) return val / 100;
    return val;
  }
  return null;
}

export async function getCpuUsage(config: SNMPConfig): Promise<number | null> {
  let result = await snmpGet(config, HSGQ_OIDS.cpuUsage);
  if (!result.success || !result.value) {
    result = await snmpGet(config, HSGQ_OIDS.hostCpu);
  }
  if (result.success && result.value) {
    const val = parseInt(result.value);
    if (!isNaN(val) && val >= 0 && val <= 100) return val;
  }
  return null;
}

export async function getMemoryUsage(config: SNMPConfig): Promise<number | null> {
  const result = await snmpGet(config, HSGQ_OIDS.memoryUsage);
  if (result.success && result.value) {
    const val = parseInt(result.value);
    if (!isNaN(val) && val >= 0 && val <= 100) return val;
  }

  // Fallback: calculate from HOST-RESOURCES-MIB
  try {
    const [totRes, usedRes] = await Promise.all([
      snmpGet(config, HSGQ_OIDS.hostMemTotal),
      snmpGet(config, HSGQ_OIDS.hostMemUsed),
    ]);
    if (totRes.success && usedRes.success && totRes.value && usedRes.value) {
      const tot = parseInt(totRes.value);
      const used = parseInt(usedRes.value);
      if (tot > 0) return Math.round((used / tot) * 100);
    }
  } catch { /* ignore */ }

  return null;
}

/**
 * Parses HSGQ table outputs from CLI commands.
 * Examples:
 *   Port  ONU ID  Serial-Number    Status     Distance(m)  Rx-Power(dBm)
 *   1     1       ZTEGC3200001     online     245          -21.30
 *   2     1       HWTC8899AABB     offline    0            -
 *   1/1:1         SKYW12345678     online     150          -18.45
 */
function parseHsgqOnuOutput(output: string, defaultPort: number = 1): any[] {
  const onus: any[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('-') || /^(port|onu|index|pon)/i.test(trimmed)) {
      continue;
    }

    // Pattern 1: Multi-column: Port, ONU-ID, SN/MAC, Status, [Distance], [RxPower]
    // e.g.: 1   1   ZTEGC3200001   online   245   -21.30
    const matchCols = trimmed.match(/^(\d+)\s+(\d+)\s+([0-9a-zA-Z]{8,16})\s+(\S+)(?:\s+([-\d.]+|n\/a))?(?:\s+([-\d.]+|n\/a))?/i);
    if (matchCols) {
      const [, portStr, onuIdStr, sn, statusStr, distStr, rxStr] = matchCols;
      const port = parseInt(portStr) || defaultPort;
      const onuId = parseInt(onuIdStr);
      const status = normalizeStatus(statusStr);
      const distance = distStr && distStr !== '-' && distStr.toLowerCase() !== 'n/a' ? parseInt(distStr) : undefined;
      const rxPower = rxStr && rxStr !== '-' && rxStr.toLowerCase() !== 'n/a' ? parseFloat(rxStr) : undefined;

      onus.push({ frame: 0, slot: 0, port, onuId, serialNumber: sn.toUpperCase(), status, distance, rxPower });
      continue;
    }

    // Pattern 2: Index format: "1/1:1" or "1:1"
    const matchIndex = trimmed.match(/^(?:1\/)?(\d+)[:/](\d+)\s+([0-9a-zA-Z]{8,16})\s+(\S+)(?:\s+([\d.]+m?))?(?:\s+([-\d.]+))?/i);
    if (matchIndex) {
      const [, portStr, onuIdStr, sn, statusStr, distStr, rxStr] = matchIndex;
      const port = parseInt(portStr) || defaultPort;
      const onuId = parseInt(onuIdStr);
      const status = normalizeStatus(statusStr);
      const distance = distStr ? parseInt(distStr.replace(/m/i, '')) : undefined;
      const rxPower = rxStr && rxStr !== '-' ? parseFloat(rxStr) : undefined;

      onus.push({ frame: 0, slot: 0, port, onuId, serialNumber: sn.toUpperCase(), status, distance, rxPower });
      continue;
    }

    // Pattern 3: Simple ONU ID + SN + Status (when inside per-port command)
    const matchSimple = trimmed.match(/^(\d+)\s+([0-9a-zA-Z]{8,16})\s+(\S+)/i);
    if (matchSimple) {
      const [, onuIdStr, sn, statusStr] = matchSimple;
      onus.push({
        frame: 0,
        slot: 0,
        port: defaultPort,
        onuId: parseInt(onuIdStr),
        serialNumber: sn.toUpperCase(),
        status: normalizeStatus(statusStr),
      });
    }
  }

  return onus;
}

function normalizeStatus(raw: string): string {
  const s = raw.toLowerCase().trim();
  if (['online', 'active', 'working', 'up', 'enable', 'registered'].includes(s)) return 'online';
  if (['dying-gasp', 'dying_gasp', 'pwr_off', 'power-off', 'dyinggasp'].includes(s)) return 'dying_gasp';
  if (['los', 'link-down', 'wire-down', 'losi', 'lofi'].includes(s)) return 'los';
  if (['auth-failed', 'unregistered', 'unauth', 'unconfig'].includes(s)) return 'auth_failed';
  return 'offline';
}

export async function discoverONUs(config: TelnetConfig): Promise<any[]> {
  const onus: any[] = [];

  // 1. Try global commands first
  const globalCmds = [
    'show gpon onu information',
    'show gpon onu state',
    'show onu status',
    'show epon onu state',
  ];

  for (const cmd of globalCmds) {
    const res = await executeCommand(config, cmd);
    if (res.success && res.output && res.output.length > 30) {
      const parsed = parseHsgqOnuOutput(res.output);
      if (parsed.length > 0) return parsed;
    }
  }

  // 2. Fallback: iterate over PON ports (HSGQ-G02ID has 2 ports, others up to 16)
  for (let port = 1; port <= 8; port++) {
    const res = await executeCommand(config, `show gpon onu state ${port}`);
    if (res.success && res.output && !res.output.includes('Invalid') && !res.output.includes('error')) {
      onus.push(...parseHsgqOnuOutput(res.output, port));
    }
  }

  return onus;
}

export async function discoverONUsSSH(config: SSHConfig): Promise<any[]> {
  const onus: any[] = [];

  const globalCmds = [
    'show gpon onu information',
    'show gpon onu state',
    'show onu status',
    'show epon onu state',
  ];

  for (const cmd of globalCmds) {
    const res = await sshExecute(config, cmd);
    if (res.success && res.output && res.output.length > 30) {
      const parsed = parseHsgqOnuOutput(res.output);
      if (parsed.length > 0) return parsed;
    }
  }

  for (let port = 1; port <= 8; port++) {
    const res = await sshExecute(config, `show gpon onu state ${port}`);
    if (res.success && res.output && !res.output.includes('Invalid')) {
      onus.push(...parseHsgqOnuOutput(res.output, port));
    }
  }

  return onus;
}

function parseOpticalOutput(output: string): any {
  const info: any = {};
  const rxMatch = output.match(/rx.*?(?:power|\(dbm\))[:\s]+([-\d.]+)/i)
    || output.match(/receive.*?(?:power|\(dbm\))[:\s]+([-\d.]+)/i)
    || output.match(/rx-power[:\s]+([-\d.]+)/i);
  if (rxMatch) info.rxPower = parseFloat(rxMatch[1]);

  const txMatch = output.match(/tx.*?(?:power|\(dbm\))[:\s]+([-\d.]+)/i)
    || output.match(/transmit.*?(?:power|\(dbm\))[:\s]+([-\d.]+)/i)
    || output.match(/tx-power[:\s]+([-\d.]+)/i);
  if (txMatch) info.txPower = parseFloat(txMatch[1]);

  const distMatch = output.match(/distance[:\s]+([-\d.]+)/i);
  if (distMatch) info.distance = Math.round(parseFloat(distMatch[1]));

  const tempMatch = output.match(/temp(?:erature)?[:\s]+([-\d.]+)/i);
  if (tempMatch) info.temperature = parseFloat(tempMatch[1]);

  const voltMatch = output.match(/volt(?:age)?[:\s]+([-\d.]+)/i);
  if (voltMatch) info.voltage = parseFloat(voltMatch[1]);

  return Object.keys(info).length > 0 ? info : null;
}

export async function getOnuOpticalInfo(
  config: TelnetConfig,
  _frame: number,
  _slot: number,
  port: number,
  onuId: number
): Promise<any> {
  const commands = [
    `show gpon onu optical-info ${port} ${onuId}`,
    `show pon power onu-rx ${port}`,
    `show gpon optical-info ${port} ${onuId}`,
  ];

  for (const cmd of commands) {
    const result = await executeCommand(config, cmd);
    if (result.success && result.output) {
      const parsed = parseOpticalOutput(result.output);
      if (parsed) return parsed;
    }
  }

  return null;
}

export async function getOnuOpticalInfoSSH(
  config: SSHConfig,
  _frame: number,
  _slot: number,
  port: number,
  onuId: number
): Promise<any> {
  const commands = [
    `show gpon onu optical-info ${port} ${onuId}`,
    `show gpon optical-info ${port} ${onuId}`,
  ];

  for (const cmd of commands) {
    const result = await sshExecute(config, cmd);
    if (result.success && result.output) {
      const parsed = parseOpticalOutput(result.output);
      if (parsed) return parsed;
    }
  }

  return null;
}

export async function getTrafficStats(_config: SNMPConfig): Promise<{ rxBytes?: bigint; txBytes?: bigint }> {
  return {};
}
