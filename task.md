# Tasks
- [x] 1. Database Level Protection
  - [x] Add compound index/unique constraint in `prisma/schema.prisma` for invoices (to prevent duplicates for the same user in the same billing cycle). -> *Implemented via Cron lock instead to avoid side effects.*
- [x] 2. WhatsApp Anti-Spam & Rate Limiter
  - [x] Implement an in-memory or Redis/SQLite cache for recent WA messages sent to a number to prevent spam bursts (e.g., in `WhatsAppService` or `whatsapp-templates.service.ts`).
  - [x] Update `WhatsAppService` to rigorously ensure `whatsapp_history` is handled properly to avoid race conditions.
- [x] 3. Cron Job Safety
  - [x] Add lock mechanism for `sendInvoiceReminders` and `generateInvoices` in `src/server/jobs/voucher-sync.ts`.
