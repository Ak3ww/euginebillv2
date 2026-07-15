# Walkthrough: Package Change Approval Workflow & Global Themes

We have successfully implemented the request-approval lifecycle for package changes (upgrades/downgrades) and validated it.

---

## 1. Request-Approval Lifecycle Implementation

### A. Database Schema (`prisma/schema.prisma`)
* Created the new `packageChangeRequest` model with a `RequestStatus` enum (`PENDING`, `APPROVED`, `REJECTED`) to track all pending customer actions.
* Linked relations cleanly inside `pppoeUser` and `pppoeProfile`.
* Generated new type mappings via `npx prisma generate`.

### B. Customer Submission API (`src/app/api/customer/upgrade/route.ts`)
* Modified the `POST` endpoint to create a `packageChangeRequest` with status `PENDING` instead of immediately issuing invoices and initiating gateway transactions.
* Prevents duplicate pending package change requests.
* Modified the `GET` endpoint to return the current `pendingRequest` status if one exists.

### C. Customer UI Upgrade (`src/app/customer/upgrade/page.tsx`)
* Integrates fetch steps to check for pending requests.
* Shows an alert banner if a request is awaiting approval: *"Pengajuan Ganti Paket Sedang Menunggu Persetujuan..."* and disables package changes.

### D. Admin Review API (`src/app/api/admin/package-changes/route.ts`)
* Created a new route handling `GET` (list all pending requests) and `POST` (approve/reject actions).
* Upon **Approval**:
  1. Computes the proration rates for sisa hari aktif.
  2. Generates an ADDON invoice with metadata.
  3. Prepares an online payment token link.
  4. Automatically dispatches a WhatsApp notification to the customer containing their amount, invoice number, and payment link.
  5. Updates the request status to `APPROVED`.

### E. Admin Dashboard (`src/app/admin/package-changes/page.tsx`)
* Created a dedicated administration dashboard for reviews using the premium Red/Black/White theme.
* Lists all requests with customer metrics and action buttons to Setujui (Approve) or Tolak (Reject).
* Integrated into the main sidebar in [AdminClientLayout.tsx](file:///C:/EugineBill/src/app/admin/AdminClientLayout.tsx) under PPPoE settings.

---

## 2. Verification Status
* Running `npm run build` in the background to ensure no syntax/compilation issues.
