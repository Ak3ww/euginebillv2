/**
 * VSOL OLT SNMP/Telnet/SSH Integration
 * Supports:
 *   - V1600GS (1-Port GPON, Cortina)
 *   - V1600GS-ZF (1-Port GPON, ZTE Falcon Chipset)
 *   - V1600GT (4/8/16-Port GPON)
 *   - V1600G1 / V1600G2 (4/8 Port GPON)
 *   - V1600D series (EPON)
 */

import { SNMPConfig, snmpGet, snmpWalk } from '../snmp';
import { TelnetConfig, executeCommand } from '../telnet';
import { SSHConfig, executeCommand as sshExecute } from '../ssh';

// VSOL Enterprise MIB root: 1.3.6.1.4.1.37950
const VSOL_OIDS = {
  temperature: '1.3.6.1.4.1.37950.1.1.5.1.1.2.0',
  cpuUsage:    '1.3.6.1.4.1.37950.1.1.5.1.1.3.0',
  memoryUsage: '1.3.6.1.4.1.37950.1.1.5.1.1.4.0',
  // Fallbacks using standard HOST-RESOURCES-MIB
  hostCpu:     '1.3.6.1.2.1.25.3.3.1.2.1',
  hostMemTotal:'1.3.6.1.2.1.25.2.3.1.5.1',
  hostMemUsed: '1.3.6.1.2.1.25.2.3.1.6.1',
};

export async function getTemperature(config: SNMPConfig): Promise<number | null> {
  const result = await snmpGet(config, VSOL_OIDS.temperature);
  if (result.success && result.value) {
    const val = parseFloat(result.value);
    // Some firmwares return value multiplied by 10 or 100 (e.g. 450 = 45.0 C)
    if (val > 150) return val / 10;
    if (val > 1000) return val / 100;
    return val;
  }
  return null;
}

export async function getCpuUsage(config: SNMPConfig): Promise<number | null> {
  let result = await snmpGet(config, VSOL_OIDS.cpuUsage);
  if (!result.success || !result.value) {
    result = await snmpGet(config, VSOL_OIDS.hostCpu);
  }
  if (result.success && result.value) {
    const val = parseInt(result.value);
    if (!isNaN(val) && val >= 0 && val <= 100) return val;
  }
  return null;
}

export async function getMemoryUsage(config: SNMPConfig): Promise<number | null> {
  const result = await snmpGet(config, VSOL_OIDS.memoryUsage);
  if (result.success && result.value) {
    const val = parseInt(result.value);
    if (!isNaN(val) && val >= 0 && val <= 100) return val;
  }

  // Fallback: calculate from HOST-RESOURCES-MIB
  try {
    const [totRes, usedRes] = await Promise.all([
      snmpGet(config, VSOL_OIDS.hostMemTotal),
      snmpGet(config, VSOL_OIDS.hostMemUsed),
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
 * Parses VSOL table outputs from CLI commands.
 * Handles:
 * - "show ont status" / "show gpon onu state"
 * - "show ont info" / "show interface gpon 0/x onu"
 *
 * Example patterns:
 * 0/1    1   ZTEGD4A3C19B   Online    320   -19.45
 * 1      1   HWTC12345678   online    150   -21.20
 * 0/1:1      ZTEGD4A3C19B   working   320   -19.45
 */
function parseVsolOnuOutput(output: string, defaultPort: number = 1): any[] {
  const onus: any[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('-') || /^(port|onu|index|pon)/i.test(trimmed)) {
      continue;
    }

    // Pattern 1: Port format "0/1:1" or "0/2:3" or "1:3"
    // e.g.: 0/1:1  ZTEGD4A3C19B  Online  320m  -19.45dBm
    const matchSlashColon = trimmed.match(/^(?:0\/)?(\d+)[:/](\d+)\s+([0-9a-zA-Z]{8,16})\s+(\S+)(?:\s+([\d.]+m?))?(?:\s+([-\d.]+))?/i);
    if (matchSlashColon) {
      const [, portStr, onuIdStr, sn, statusStr, distStr, rxStr] = matchSlashColon;
      const port = parseInt(portStr) || defaultPort;
      const onuId = parseInt(onuIdStr);
      const status = normalizeStatus(statusStr);
      const distance = distStr ? parseInt(distStr.replace(/m/i, '')) : undefined;
      const rxPower = rxStr && rxStr !== '-' ? parseFloat(rxStr) : undefined;

      onus.push({ frame: 0, slot: 0, port, onuId, serialNumber: sn.toUpperCase(), status, distance, rxPower });
      continue;
    }

    // Pattern 2: Columns: Port (or 0/1), ONT-ID, SerialNumber, Status, [Distance], [RxPower]
    // e.g.: 0/1   1   ZTEGD4A3C19B   Online   320   -19.45
    // e.g.: 1     2   HWTC12345678   Offline  -     -
    const matchCols = trimmed.match(/^(?:0\/)?(\d+)\s+(\d+)\s+([0-9a-zA-Z]{8,16})\s+(\S+)(?:\s+([-\d.]+|n\/a))?(?:\s+([-\d.]+|n\/a))?/i);
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

    // Pattern 3: Simple ONT ID + Serial + Status (when inside per-port output)
    // e.g.: 1   ZTEGD4A3C19B   Online
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

  // 1. Try global discovery commands first (fastest)
  const globalCmds = ['show ont status', 'show gpon onu state', 'show onu status', 'show ont info'];
  for (const cmd of globalCmds) {
    const res = await executeCommand(config, cmd);
    if (res.success && res.output && res.output.length > 30) {
      const parsed = parseVsolOnuOutput(res.output);
      if (parsed.length > 0) return parsed;
    }
  }

  // 2. Fallback: iterate over PON ports (1..8)
  for (let port = 1; port <= 8; port++) {
    const res = await executeCommand(config, `show ont status 0/${port}`);
    if (res.success && res.output && !res.output.includes('Invalid') && !res.output.includes('Incomplete')) {
      onus.push(...parseVsolOnuOutput(res.output, port));
    } else {
      // Try alternate syntax without 0/ prefix: "show gpon onu state {port}"
      const res2 = await executeCommand(config, `show gpon onu state ${port}`);
      if (res2.success && res2.output && !res2.output.includes('Invalid')) {
        onus.push(...parseVsolOnuOutput(res2.output, port));
      }
    }
  }

  return onus;
}

export async function discoverONUsSSH(config: SSHConfig): Promise<any[]> {
  const onus: any[] = [];

  const globalCmds = ['show ont status', 'show gpon onu state', 'show onu status', 'show ont info'];
  for (const cmd of globalCmds) {
    const res = await sshExecute(config, cmd);
    if (res.success && res.output && res.output.length > 30) {
      const parsed = parseVsolOnuOutput(res.output);
      if (parsed.length > 0) return parsed;
    }
  }

  for (let port = 1; port <= 8; port++) {
    const res = await sshExecute(config, `show ont status 0/${port}`);
    if (res.success && res.output && !res.output.includes('Invalid') && !res.output.includes('Incomplete')) {
      onus.push(...parseVsolOnuOutput(res.output, port));
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
    `show ont optical-info 0/${port} ${onuId}`,
    `show gpon onu optical-info 0/${port} ${onuId}`,
    `show ont optical-info ${port} ${onuId}`,
    `show pon power onu-rx 0/${port}`,
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
    `show ont optical-info 0/${port} ${onuId}`,
    `show gpon onu optical-info 0/${port} ${onuId}`,
    `show ont optical-info ${port} ${onuId}`,
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
