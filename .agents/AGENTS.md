# Workspace Rules

## Admin Dashboard UI Standard (/admin/*)
1. **Shadcn UI & Lucide Icons**: All `/admin/*` pages, components, modals, and summary cards must strictly follow standard Shadcn UI design patterns (`@/components/ui/card`, `@/components/ui/badge`, `@/components/ui/button`, etc.) and Lucide React icons.
2. **Clean SaaS Aesthetic**: Use clean hairline borders (`border-border`), subtle muted backgrounds (`bg-muted/30`, `bg-card`), crisp typography, and standard data tables. Do NOT use cyberpunk gradients, neon glow shadows, or non-standard dark/alien elements in the admin portal.
3. **Interactive & Functional**: Every summary card or filter pill must be 100% interactive and directly update the table filter when clicked.
4. **Strictly No Text Emojis Across ALL Portals**: NEVER use text emojis/emoticons in any UI text or labels across ALL portals (Admin, Customer, Technician, Public Landing Page, e.g. 🌐, 🚀, 🟢, 🔴, ⚪, ↗, ⚡, 📍, 📡). ALWAYS use dedicated React Icon components (`Lucide React` icons like `<Wifi />`, `<Globe />`, `<MapPin />`, `<Zap />`, `<Server />`, `<CheckCircle2 />`, `<XCircle />`, `<Activity />`, etc.) adhering to the design system of each portal.

## Enterprise Export System Standard (PDF & Excel)
1. **Server-Side Engine Only**: All PDF and Excel exports must be generated server-side in API routes using `src/lib/utils/export.ts`. Do NOT build separate client-side PDF/XLSX generators.
2. **Preserve Export Utilities**: When updating `src/lib/utils/export.ts`, maintain backward compatibility and preserve helper export functions (e.g. `generateVoucherCardsPDF`, `generateInvoicePDF`, `formatDateExport`, `formatCurrencyExport`) so other routes do not fail during build.
3. **Enterprise Layout & Branding**:
   - **PDF**: Must include Company Logo (`getCompanyExportInfo`), Oceanic Blue (`#002C60`) header, Summary Metrics Card Box, Right-aligned currency columns, and Running Footer ("Halaman X dari Y").
   - **Excel**: Use `ExcelJS` with Header Banner, Numeric Currency format (`numFmt: '"Rp "#,##0'`), Auto Column Widths, and Accounting-style Double Underline Total Row.
4. **Strict Filter Respect**: All export endpoints must accept and apply ALL active UI filters (`status`, `dateRange`/`startDate`/`endDate`, `routerId`, `categoryId`, `search`).

## Hallmark Enterprise Standard (Customer Portal & Public Pages)
For ALL customer-facing UI development (customer portal, payment pages, public landing pages), follow the local `hallmark` skill with the **Oceanic Blue** theme.
1. **No Fake Jargon**: Never use fake terminal/hacker text. Use normal, professional Indonesian text.
2. **Fresh Hallmark Colors (Oceanic Blue)**: `--color-primary: #002c60`, `--color-accent: #1b437c`.
3. **Dark Mode Disabled**: Dark mode is disabled for the customer portal (light background).

## VPS Deployment & PM2 Standard
1. **VPS Project Directory**: `/var/www/EugineBill-radius`
2. **PM2 Process Names**:
   - `EugineBill-radius` (Next.js Web App)
   - `EugineBill-wa` (WhatsApp Baileys Service)
   - `EugineBill-cron` (Cron Jobs)
4. **VPS Build Optimization**: VPS hardware resources are limited and `npm run build` takes noticeable CPU/RAM. ALWAYS batch multiple updates, test thoroughly, and verify code syntax locally BEFORE asking the user to build on the VPS. Never ask the user to run `npm run build` repeatedly for small incremental changes.
```

## Persistent Upload & Zero-Data-Loss Standard
1. **Mandatory Persistent Storage**: ALL file uploads across ALL modules (manual payment proofs, receipts, topup proofs, PSB/SPK photos, customer KTPs, logos) MUST strictly write to persistent storage using `getUploadDir(...)` from `@/lib/upload-dir` (`/var/data/EugineBill/uploads/`).
2. **Never Save inside `public/uploads/` or `process.cwd()`**: NEVER write runtime uploaded files into `process.cwd()/public/uploads/` or any directory inside the Next.js project folder, as `npm run build` will wipe runtime files stored inside the build tree.
3. **Always Prepend Leading Slash on Image URLs**: All image URLs saved in the database or rendered in UI components MUST start with a leading slash `/` (e.g., `/uploads/receipts/filename.jpg`), never relative `uploads/receipts/...`.
4. **Universal Serve Route Handler**: All upload URLs must be served dynamically by `/uploads/[...filepath]` to guarantee multi-folder fallback resolution and instant access on VPS.

## EugineBill Network Architecture (VPN, PPPoE, ONT Remote)
1. **RADIUS Disabled by Default**: Most deployments have `company.radiusEnabled = false`. Always check `company.radiusEnabled` before querying `radacct`. For active sessions in non-RADIUS mode, query `mikrotikSession` table or `/ppp/active/print` directly.
2. **VPS = VPN Server, MikroTik = VPN Client**: EugineBill VPS acts as the central VPN Server. MikroTik connects as a VPN Client. VPS can reach MikroTik's VPN IP (`router.ipAddress`). However, VPS cannot directly reach customer PPPoE pool subnets (ONT local IPs) without routing/NAT on MikroTik.
3. **ONT Remote Proxy Architecture**:
   - Web admin access: `Admin Browser -> http://VPS_PUBLIC_IP:proxyPort (24000-24999)`
   - VPS proxy: `socat` forwards `VPS:proxyPort -> MikroTik_VPN_IP:proxyPort`
   - MikroTik NAT: MikroTik adds dynamic DST-NAT rule (`dst-port=proxyPort -> to-addresses=ONT_IP, to-ports=targetPort`), SRCNAT masquerade, and filter forward accept rule.
   - MikroTik NAT rules ARE MANDATORY because VPS cannot reach ONT IP directly without MikroTik's internal translation.
4. **ONT IP Resolution**:
   - Non-RADIUS mode: Query MikroTik API `/ppp/active/print`, read the `address` field (which contains the customer's remote-address / ONT IP).
   - RADIUS mode: Read `radacct.framedipaddress` where `acctstoptime IS NULL`.
   - Never confuse `nasipaddress` (the MikroTik gateway IP) with `framedipaddress` or `address` (the ONT/customer IP).
5. **VPS Socat & Port Firewall**:
   - Socat must be running on Linux VPS for port forwarding.
   - Port range `24000:24999` must be open on VPS firewall / cloud security group.

## Mandatory Documentation & Changelog Standard (Tulis Yang Dikerjakan, Kerjakan Yang Ditulis)
1. **Auto-Update CHANGELOG.md**: Setiap kali ada penambahan fitur, refaktor, perbaikan bug, atau fase kerja selesai, WAJIB mendokumentasikannya di file `CHANGELOG.md` pada root project dengan format standar:
   - Tanggal & Latar Belakang Masalah (Issue / Context)
   - Solusi Arsitektural & Perubahan Teknis
   - Daftar File yang Ditambahkan / Dimodifikasi (`Files`)
2. **Dokumentasi Teknis Fitur Baru di `docs/`**: Untuk setiap fitur baru atau perombakan sistem yang signifikan, WAJIB membuat atau memperbarui file panduan `.md` di dalam direktori `docs/` (misal `docs/customer/...` atau `docs/mikrotik/...`) yang merinci alur kerja, kontrak API, dan troubleshooting agar tim dapat membaca dan mengauditnya kembali sewaktu-waktu.
3. **Integritas Dokumentasi**: Selalu pastikan apa yang dituliskan pada dokumentasi sesuai 100% dengan kode yang diimplementasikan (*write what we do, and do what we write*).
