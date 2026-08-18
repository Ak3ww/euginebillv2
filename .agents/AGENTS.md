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
3. **Full VPS Update Command**:
   ```bash
   cd /var/www/EugineBill-radius
   git pull
   npx prisma db push
   npm run build
   pm2 restart all
   ```
