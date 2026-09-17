/**
 * ONT Metadata & Vendor Detector
 * Auto-detects ONT/ONU Vendor and Model based on ITU-T Vendor ID prefix,
 * Serial Number patterns, and OLT onuType metadata.
 */

export interface OntDetectedMetadata {
  vendor: string;
  model: string;
  isRecognized: boolean;
  rawSn: string;
}

/**
 * ITU-T standard vendor prefixes (first 4 chars of GPON Serial Number)
 */
const VENDOR_PREFIX_MAP: Record<string, { vendor: string; defaultModel: string }> = {
  ZTEG: { vendor: 'ZTE', defaultModel: 'F609' },
  ZXHN: { vendor: 'ZTE', defaultModel: 'F670L' },
  HWTC: { vendor: 'Huawei', defaultModel: 'HG8245H5' },
  FHTT: { vendor: 'FiberHome', defaultModel: 'AN5506-01' },
  VSOL: { vendor: 'VSOL', defaultModel: 'V2801SG' },
  V160: { vendor: 'VSOL', defaultModel: 'V2804' },
  HSGQ: { vendor: 'HSGQ', defaultModel: 'G01' },
  ALCL: { vendor: 'Nokia', defaultModel: 'G-240W-A' },
  NOKG: { vendor: 'Nokia', defaultModel: 'G-140W-ME' },
  SMBS: { vendor: 'Skyworth', defaultModel: 'GN542VF' },
  SKYW: { vendor: 'Skyworth', defaultModel: 'GN542VF' },
  CDAT: { vendor: 'C-Data', defaultModel: 'FD511G' },
  GMAC: { vendor: 'Realtek', defaultModel: 'RTL9601D' },
  RLTK: { vendor: 'Realtek', defaultModel: 'RTL9601D' },
  TPLK: { vendor: 'TP-Link', defaultModel: 'TX-6610' },
  DBCM: { vendor: 'BDCOM', defaultModel: 'GP1704' },
};

/**
 * Clean & normalize a serial number string
 */
export function normalizeSerialNumber(sn: string | null | undefined): string {
  if (!sn) return '';
  return sn.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Detect ONT Vendor and Model from serial number and optional metadata
 */
export function detectOntVendorAndModel(
  serialNumber?: string | null,
  onuType?: string | null,
  oltVendor?: string | null
): OntDetectedMetadata {
  const cleanSn = normalizeSerialNumber(serialNumber);

  if (!cleanSn) {
    return {
      vendor: oltVendor ? normalizeVendorName(oltVendor) : 'Generic',
      model: onuType?.trim() || 'Generic ONT',
      isRecognized: false,
      rawSn: '',
    };
  }

  // 1. Check ITU-T prefix (first 4 chars)
  const prefix4 = cleanSn.substring(0, 4);
  if (VENDOR_PREFIX_MAP[prefix4]) {
    const info = VENDOR_PREFIX_MAP[prefix4];
    let detectedModel = info.defaultModel;

    // If onuType is provided and meaningful, use it for model
    if (onuType && onuType.trim().length > 1 && !onuType.toLowerCase().includes('unknown')) {
      detectedModel = cleanModelName(onuType.trim(), info.vendor);
    }

    return {
      vendor: info.vendor,
      model: detectedModel,
      isRecognized: true,
      rawSn: cleanSn,
    };
  }

  // 2. Check prefix 3 (e.g. ZTE)
  if (cleanSn.startsWith('ZTE')) {
    return {
      vendor: 'ZTE',
      model: onuType?.trim() || 'F609',
      isRecognized: true,
      rawSn: cleanSn,
    };
  }

  // 3. Fallback to OLT vendor or onuType if available
  if (oltVendor) {
    const v = normalizeVendorName(oltVendor);
    return {
      vendor: v,
      model: onuType?.trim() || `${v} ONT`,
      isRecognized: true,
      rawSn: cleanSn,
    };
  }

  // 4. Unknown/Generic
  return {
    vendor: 'Generic',
    model: onuType?.trim() || 'Generic ONT',
    isRecognized: false,
    rawSn: cleanSn,
  };
}

function normalizeVendorName(raw: string): string {
  const lower = raw.toLowerCase().trim();
  if (lower.includes('zte')) return 'ZTE';
  if (lower.includes('huawei')) return 'Huawei';
  if (lower.includes('fiberhome')) return 'FiberHome';
  if (lower.includes('vsol')) return 'VSOL';
  if (lower.includes('hsgq')) return 'HSGQ';
  if (lower.includes('nokia') || lower.includes('alcatel')) return 'Nokia';
  if (lower.includes('skyworth')) return 'Skyworth';
  if (lower.includes('c-data') || lower.includes('cdata') || lower.includes('hioso')) return 'C-Data';
  if (lower.includes('realtek')) return 'Realtek';
  if (lower.includes('bdcom')) return 'BDCOM';
  return raw.trim();
}

function cleanModelName(rawModel: string, vendor: string): string {
  let cleaned = rawModel.trim();
  // Strip vendor name if model starts with vendor name (e.g. "ZTE-F609" -> "F609")
  const vendorRegex = new RegExp(`^${vendor}[-_\\s]+`, 'i');
  cleaned = cleaned.replace(vendorRegex, '').trim();
  return cleaned || rawModel.trim();
}
