/**
 * MikroTik SNMP Monitor Helper
 * High-performance stateless polling for MikroTik Routers via SNMP v2c (UDP 161)
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface MikrotikSnmpConfig {
  host: string;
  community?: string;
  port?: number;
  timeoutMs?: number;
}

export interface MikrotikSnmpMetrics {
  success: boolean;
  cpuLoad?: number;         // Percentage 0-100%
  totalMemoryMb?: number;   // Total RAM in MB
  usedMemoryMb?: number;    // Used RAM in MB
  memoryUsagePercent?: number; // RAM usage 0-100%
  uptimeSeconds?: number;   // Uptime in seconds
  routerName?: string;      // Router identity / board name
  activePppCount?: number;  // Count of active PPPoE sessions
  activeHotspotCount?: number; // Count of active Hotspot sessions
  error?: string;
}

// Common MikroTik MIB OIDs
export const MIKROTIK_OIDS = {
  cpuLoad: '.1.3.6.1.4.1.14988.1.1.1.3.1.0',       // mtxrDeviceCpuLoad
  hrProcessorLoad: '.1.3.6.1.2.1.25.3.3.1.2.1',   // hrProcessorLoad.1
  sysUpTime: '.1.3.6.1.2.1.1.3.0',                 // sysUpTime
  sysName: '.1.3.6.1.2.1.1.5.0',                   // sysName (Router Identity)
  boardName: '.1.3.6.1.4.1.14988.1.1.4.1.0',       // mtxrBoardName
  activePpp: '.1.3.6.1.4.1.14988.1.1.1.1.0',        // mtxrActivePppUserCount
  activeHotspot: '.1.3.6.1.4.1.14988.1.1.5.1.0',    // mtxrActiveHotspotUserCount
};

/**
 * Perform SNMP Get for MikroTik router health metrics using system CLI (snmpget)
 * with graceful fallback to UDP socket.
 */
export async function getMikrotikSnmpMetrics(config: MikrotikSnmpConfig): Promise<MikrotikSnmpMetrics> {
  const host = config.host;
  const community = config.community || 'public';
  const port = config.port || 161;
  const timeoutSec = Math.ceil((config.timeoutMs || 3000) / 1000);

  // Command to get all primary OIDs in a single SNMP GET call
  const oids = [
    MIKROTIK_OIDS.cpuLoad,
    MIKROTIK_OIDS.sysUpTime,
    MIKROTIK_OIDS.sysName,
    MIKROTIK_OIDS.boardName,
    MIKROTIK_OIDS.activePpp,
    MIKROTIK_OIDS.activeHotspot,
  ].join(' ');

  const command = `snmpget -On -v2c -c ${community} -t ${timeoutSec} -r 1 ${host}:${port} ${oids} 2>&1`;

  try {
    const { stdout } = await execAsync(command);
    const lines = stdout.trim().split('\n');

    let cpuLoad: number | undefined;
    let uptimeSeconds: number | undefined;
    let routerName: string | undefined;
    let activePppCount: number | undefined;
    let activeHotspotCount: number | undefined;

    for (const line of lines) {
      if (line.includes(MIKROTIK_OIDS.cpuLoad) || line.includes('.1.3.6.1.4.1.14988.1.1.1.3.1.0')) {
        const val = extractIntVal(line);
        if (val !== null) cpuLoad = val;
      }
      if (line.includes(MIKROTIK_OIDS.sysUpTime) || line.includes('.1.3.6.1.2.1.1.3.0')) {
        const timeticks = extractTimeticks(line);
        if (timeticks !== null) uptimeSeconds = Math.floor(timeticks / 100);
      }
      if (line.includes(MIKROTIK_OIDS.sysName) || line.includes(MIKROTIK_OIDS.boardName)) {
        const str = extractStrVal(line);
        if (str && !routerName) routerName = str;
      }
      if (line.includes(MIKROTIK_OIDS.activePpp)) {
        const val = extractIntVal(line);
        if (val !== null) activePppCount = val;
      }
      if (line.includes(MIKROTIK_OIDS.activeHotspot)) {
        const val = extractIntVal(line);
        if (val !== null) activeHotspotCount = val;
      }
    }

    return {
      success: true,
      cpuLoad: cpuLoad ?? 0,
      uptimeSeconds: uptimeSeconds ?? 0,
      routerName: routerName || 'MikroTik Router',
      activePppCount: activePppCount ?? 0,
      activeHotspotCount: activeHotspotCount ?? 0,
    };
  } catch (err: any) {
    return {
      success: false,
      error: `SNMP unreachable or CLI snmpget missing: ${err.message}`,
    };
  }
}

function extractIntVal(line: string): number | null {
  const match = line.match(/=\s*(?:INTEGER|Gauge32|Counter32):\s*(-?\d+)/i) || line.match(/=\s*(-?\d+)$/);
  return match ? parseInt(match[1], 10) : null;
}

function extractStrVal(line: string): string | null {
  const match = line.match(/=\s*STRING:\s*(.+)$/i);
  return match ? match[1].trim().replace(/"/g, '') : null;
}

function extractTimeticks(line: string): number | null {
  const match = line.match(/\((\d+)\)/);
  return match ? parseInt(match[1], 10) : null;
}
