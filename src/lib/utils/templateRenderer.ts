import QRCode from 'qrcode'

export interface VoucherData {
  code: string
  secret?: string
  total: number
  profile?: {
    name?: string
    validityValue?: number
    validityUnit?: string
    usageQuota?: number | null
    usageDuration?: number | null
  }
  router?: {
    name?: string
    shortname?: string
    dnsName?: string
  }
  dnsName?: string
  voucherType?: string // 'same' or 'different'
}

export interface RenderContext {
  currencyCode?: string
  companyName?: string
  dnsName?: string
  ssid?: string
}

export const DEFAULT_CARD_TEMPLATE = `{include file="rad-template-header.tpl"}
<style>
@media (max-width: 640px) {
  .voucher-preview-container { display: flex !important; flex-direction: column !important; padding: 0 8px !important; gap: 10px !important; }
  .voucher-card { display: block !important; width: calc(100% - 16px) !important; max-width: none !important; margin: 0 auto 10px auto !important; }
}
@media (min-width: 641px) and (max-width: 1024px) {
  .voucher-card { width: calc(50% - 12px) !important; }
}
@media (min-width: 1025px) {
  .voucher-card { width: 220px !important; }
}
@media print {
  body { margin: 0; padding: 4mm; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .voucher-card { break-inside: avoid; page-break-inside: avoid; }
}
</style>
{foreach $v as $vs}
{if $vs['code'] eq $vs['secret']}
<div class="voucher-card" style="display: inline-block; width: 220px; min-height: 120px; border: 1.5px solid #002c60; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 4px; padding: 0; vertical-align: top; background: #fff; page-break-inside: avoid; box-sizing: border-box; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
  <div style="background: #002c60; color: #fff; padding: 5px 8px; font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border-radius: 4px 4px 0 0;">
    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">{$vs['router_name']}</span>
    <span style="font-size: 9px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 3px; font-weight: 600;">HOTSPOT</span>
  </div>
  <div style="padding: 6px 8px; display: flex; gap: 6px; align-items: center;">
    <div style="flex: 1; min-width: 0;">
      <div style="color: #64748b; font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Kode Voucher</div>
      <div style="font-family: 'Courier New', Courier, monospace; font-size: 15px; font-weight: 800; color: #002c60; line-height: 1.2; word-break: break-all; margin: 2px 0 4px 0; letter-spacing: 0.5px;">{$vs['code']}</div>
      <div style="font-size: 9px; color: #334155; line-height: 1.3;">
        <div><strong>Masa Aktif:</strong> {$vs['validity']}</div>
        <div><strong>Kuota:</strong> {$vs['quota']}</div>
      </div>
    </div>
    <div style="flex-shrink: 0; text-align: center;">
      <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
        {$vs['qrcode']}
      </div>
      <div style="font-size: 7.5px; color: #64748b; margin-top: 2px; font-weight: 600;">Scan utk Konek</div>
    </div>
  </div>
  <div style="border-top: 1px dashed #cbd5e1; padding: 4px 8px; font-size: 10px; font-weight: 700; color: #002c60; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
    <span>{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</span>
    <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">{$vs['dns_name']}</span>
  </div>
</div>
{else}
<div class="voucher-card" style="display: inline-block; width: 220px; min-height: 120px; border: 1.5px solid #002c60; border-radius: 6px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin: 4px; padding: 0; vertical-align: top; background: #fff; page-break-inside: avoid; box-sizing: border-box; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.08);">
  <div style="background: #002c60; color: #fff; padding: 5px 8px; font-size: 11px; font-weight: 700; display: flex; justify-content: space-between; align-items: center; border-radius: 4px 4px 0 0;">
    <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 130px;">{$vs['router_name']}</span>
    <span style="font-size: 9px; background: rgba(255,255,255,0.2); padding: 1px 5px; border-radius: 3px; font-weight: 600;">HOTSPOT</span>
  </div>
  <div style="padding: 6px 8px; display: flex; gap: 6px; align-items: center;">
    <div style="flex: 1; min-width: 0;">
      <div style="display: flex; gap: 4px; margin-bottom: 2px;">
        <div style="flex: 1;">
          <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase;">User</div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 800; color: #002c60; word-break: break-all;">{$vs['code']}</div>
        </div>
        <div style="flex: 1;">
          <div style="color: #64748b; font-size: 8px; font-weight: 600; text-transform: uppercase;">Pass</div>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 11px; font-weight: 800; color: #002c60; word-break: break-all;">{$vs['secret']}</div>
        </div>
      </div>
      <div style="font-size: 9px; color: #334155; line-height: 1.3;">
        <div><strong>Masa Aktif:</strong> {$vs['validity']}</div>
        <div><strong>Kuota:</strong> {$vs['quota']}</div>
      </div>
    </div>
    <div style="flex-shrink: 0; text-align: center;">
      <div style="width: 68px; height: 68px; display: flex; align-items: center; justify-content: center; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 2px;">
        {$vs['qrcode']}
      </div>
      <div style="font-size: 7.5px; color: #64748b; margin-top: 2px; font-weight: 600;">Scan utk Konek</div>
    </div>
  </div>
  <div style="border-top: 1px dashed #cbd5e1; padding: 4px 8px; font-size: 10px; font-weight: 700; color: #002c60; background: #f8fafc; display: flex; justify-content: space-between; align-items: center;">
    <span>{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</span>
    <span style="font-size: 8px; color: #94a3b8; font-weight: normal;">{$vs['dns_name']}</span>
  </div>
</div>
{/if}
{/foreach}
{include file="rad-template-footer.tpl"}`;

export const THERMAL_TEMPLATE = `{include file="rad-template-header.tpl"}
<style>
@media print {
  @page { margin: 0; size: auto; }
  body { margin: 0; padding: 2mm; width: 100%; }
  .thermal-ticket { page-break-after: always; break-after: page; }
}
</style>
{foreach $v as $vs}
<div class="thermal-ticket" style="width: 200px; margin: 0 auto 16px auto; padding: 8px 4px; font-family: 'Courier New', Courier, monospace; text-align: center; color: #000; background: #fff; box-sizing: border-box;">
  <div style="font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">{$vs['router_name']}</div>
  <div style="font-size: 10px; font-weight: 600; margin-top: 2px;">HOTSPOT VOUCHER</div>
  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  
  <div style="font-size: 11px; margin: 2px 0;"><strong>{$vs['validity']}</strong> | <strong>{$vs['quota']}</strong></div>
  <div style="font-size: 13px; font-weight: 900; margin: 4px 0;">{$_c['currency_code']}. {number_format($vs['total'], 0, ',', '.')}</div>
  
  <div style="margin: 8px auto; display: flex; justify-content: center; align-items: center;">
    <div style="padding: 4px; border: 1px solid #000; display: inline-block;">
      {$vs['qrcode']}
    </div>
  </div>
  <div style="font-size: 9px; font-weight: bold; margin-bottom: 6px;">SCAN LANGSUNG KONEK</div>
  
  {if $vs['code'] eq $vs['secret']}
  <div style="border: 1px solid #000; padding: 4px 6px; margin: 4px 0; background: #f4f4f4;">
    <div style="font-size: 8px; text-transform: uppercase;">Kode Voucher:</div>
    <div style="font-size: 15px; font-weight: 900; letter-spacing: 1px; word-break: break-all;">{$vs['code']}</div>
  </div>
  {else}
  <div style="border: 1px solid #000; padding: 4px 6px; margin: 4px 0; background: #f4f4f4; text-align: left;">
    <div style="font-size: 9px;"><strong>User:</strong> <span style="font-size: 12px; font-weight: 900;">{$vs['code']}</span></div>
    <div style="font-size: 9px;"><strong>Pass:</strong> <span style="font-size: 12px; font-weight: 900;">{$vs['secret']}</span></div>
  </div>
  {/if}

  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  <div style="font-size: 8px; line-height: 1.3; text-align: left; padding: 0 4px;">
    1. Hubungkan ke Wi-Fi Hotspot<br/>
    2. Scan QR Code di atas dengan kamera HP<br/>
    Atau buka browser: <strong>{$vs['dns_name']}</strong>
  </div>
  <div style="border-bottom: 1px dashed #000; margin: 6px 0;"></div>
  <div style="font-size: 9px; font-weight: 600;">Terima Kasih</div>
</div>
{/foreach}
{include file="rad-template-footer.tpl"}`;

export const DEFAULT_VOUCHER_TEMPLATE = DEFAULT_CARD_TEMPLATE;

/**
 * Generate synchronous SVG QR Code string
 */
export function generateQrCodeSvg(text: string, size = 80): string {
  let svg = ''
  try {
    QRCode.toString(text, { type: 'svg', margin: 0, width: size }, (err, str) => {
      if (!err && str) svg = str
    })
  } catch (err) {
    console.error('Failed to generate QR code SVG:', err)
  }
  return svg
}

export function renderVoucherTemplate(
  templateHtml: string,
  vouchers: VoucherData[],
  context?: RenderContext
): string {
  const currencyCode = context?.currencyCode || 'Rp'
  const companyName = context?.companyName || 'EugineBill'
  const defaultDns = context?.dnsName || 'wifi.euginemediagroup.com'
  const defaultSsid = context?.ssid || 'Eugine Hotspot'

  // Split template into header, body, footer
  const headerMatch = templateHtml.match(/\{include file="rad-template-header\.tpl"\}([\s\S]*?)\{foreach/)
  const foreachMatch = templateHtml.match(/\{foreach \$v as \$vs\}([\s\S]*?)\{\/foreach\}/)
  const footerMatch = templateHtml.match(/\{\/foreach\}([\s\S]*?)\{include file="rad-template-footer\.tpl"\}/)

  const header = headerMatch ? headerMatch[1].trim() : ''
  const bodyTemplate = foreachMatch ? foreachMatch[1].trim() : templateHtml
  const footer = footerMatch ? footerMatch[1].trim() : ''

  // Render each voucher
  const renderedVouchers = vouchers.map(vs => {
    let html = bodyTemplate

    const secret = vs.secret !== undefined ? vs.secret : vs.code
    const dnsName = vs.dnsName || vs.router?.dnsName || defaultDns
    const routerName = vs.router?.name || companyName
    const ssid = context?.ssid || vs.router?.shortname || routerName || defaultSsid

    // Build direct auto-login URL
    const loginUrl = `http://${dnsName}/login?username=${encodeURIComponent(vs.code)}&password=${encodeURIComponent(secret)}`
    
    // Generate QR Code SVG for auto-login
    const qrSvg = generateQrCodeSvg(loginUrl, 76)
    // Generate Wi-Fi Connect QR code
    const wifiQrSvg = generateQrCodeSvg(`WIFI:S:${ssid};T:nopass;;`, 76)

    // Replace voucher variables
    html = html.replace(/\{\$vs\['code'\]\}/g, vs.code)
    html = html.replace(/\{\$vs\['secret'\]\}/g, secret)
    html = html.replace(/\{\$vs\['total'\]\}/g, vs.total.toString())

    // Replace QR Code and Network variables
    html = html.replace(/\{\$vs\['qrcode'\]\}/g, qrSvg)
    html = html.replace(/\{\$vs\['qr_code'\]\}/g, qrSvg)
    html = html.replace(/\{\$vs\['login_url'\]\}/g, loginUrl)
    html = html.replace(/\{\$vs\['dns_name'\]\}/g, dnsName)
    html = html.replace(/\{\$vs\['ssid'\]\}/g, ssid)
    html = html.replace(/\{\$vs\['wifi_qr'\]\}/g, wifiQrSvg)

    // Replace profile info
    html = html.replace(/\{\$vs\['profile_name'\]\}/g, vs.profile?.name || '')

    // Replace validity - format as "X Unit"
    const validityValue = vs.profile?.validityValue || 0
    const validityUnit = vs.profile?.validityUnit || ''
    const validityFormatted = formatValidity(validityValue, validityUnit)
    html = html.replace(/\{\$vs\['validity'\]\}/g, validityFormatted)

    // Replace quota and duration
    const quotaFormatted = formatQuota(vs.profile?.usageQuota)
    const durationFormatted = formatDuration(vs.profile?.usageDuration)
    html = html.replace(/\{\$vs\['quota'\]\}/g, quotaFormatted)
    html = html.replace(/\{\$vs\['duration'\]\}/g, durationFormatted)

    // Replace router/NAS info
    html = html.replace(/\{\$vs\['router_name'\]\}/g, routerName)
    html = html.replace(/\{\$vs\['router_shortname'\]\}/g, vs.router?.shortname || '')

    // Replace conditional for code/secret (same username=password vs different)
    html = html.replace(
      /\{if \$vs\['code'\] eq \$vs\['secret'\]\}([\s\S]*?)\{else\}([\s\S]*?)\{\/if\}/g,
      (_, ifBlock, elseBlock) => {
        const isSame = !vs.secret || vs.code === vs.secret
        return isSame ? ifBlock : elseBlock
      }
    )

    // Replace number_format function
    html = html.replace(
      /\{number_format\(\$vs\['total'\],\s*(\d+),\s*'([^']*)',\s*'([^']*)'\)\}/g,
      (_, decimals, decPoint, thousandsSep) => {
        return formatNumber(vs.total, parseInt(decimals), decPoint, thousandsSep)
      }
    )

    // Replace context variables
    html = html.replace(/\{\$_c\['currency_code'\]\}/g, currencyCode)
    html = html.replace(/\{company_name\}/g, companyName)

    return html
  }).join('\n')

  // Combine header + vouchers + footer
  return `${header}\n${renderedVouchers}\n${footer}`
}

/**
 * Format validity display
 */
function formatValidity(value: number, unit: string): string {
  if (!value || !unit) return ''

  const unitMap: Record<string, string> = {
    'MINUTES': 'Menit',
    'HOURS': 'Jam',
    'DAYS': 'Hari',
    'WEEKS': 'Minggu',
    'MONTHS': 'Bulan'
  }

  return `${value} ${unitMap[unit] || unit}`
}

/**
 * Format quota display (bytes to GB/MB)
 */
function formatQuota(bytes: number | null | undefined): string {
  if (!bytes) return 'Unlimited'
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 1) return `${gb.toFixed(2)} GB`
  const mb = bytes / (1024 * 1024)
  return `${mb.toFixed(2)} MB`
}

/**
 * Format duration display (minutes to hours/minutes)
 */
function formatDuration(minutes: number | null | undefined): string {
  if (!minutes) return 'Unlimited'
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return remainingMinutes > 0 ? `${hours}j ${remainingMinutes}m` : `${hours} Jam`
  }
  return `${minutes} Menit`
}

/**
 * Format number with thousand separators
 */
function formatNumber(
  num: number,
  decimals: number = 0,
  decPoint: string = '.',
  thousandsSep: string = ','
): string {
  const parts = num.toFixed(decimals).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSep)
  return parts.join(decPoint)
}

/**
 * Get printable HTML with proper styling for print
 */
export function getPrintableHtml(renderedHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Print Vouchers</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: A4 portrait;
      margin: 5mm;
    }

    body {
      font-family: Arial, sans-serif;
      margin: 0;
      padding: 5px;
      background: #fff;
    }

    .voucher-container {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-start;
      align-content: flex-start;
      width: 100%;
    }

    @media print {
      html, body {
        width: 210mm;
        height: 297mm;
        margin: 0;
        padding: 0;
      }

      body {
        padding: 3mm;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .voucher-container {
        width: 100%;
        min-height: 291mm;
        display: flex;
        flex-wrap: wrap;
        align-content: space-between;
      }
    }
  </style>
</head>
<body>
<div class="voucher-container">
${renderedHtml}
</div>
</body>
</html>
  `.trim()
}
