# Agent Deposit System Implementation Guide

## Overview
Sistem deposit/saldo untuk agent dengan dua mode top-up:
- Payment gateway (Midtrans, Xendit, Duitku)
- Manual transfer (upload bukti transfer, verifikasi admin)

## Database Schema Changes

### 1. Update `agent` table
```sql
ALTER TABLE agents 
ADD COLUMN balance INT DEFAULT 0,
ADD COLUMN minBalance INT DEFAULT 0;
```

### 2. Create `agent_deposits` table
```sql
CREATE TABLE agent_deposits (
  id VARCHAR(191) PRIMARY KEY,
  agentId VARCHAR(191) NOT NULL,
  amount INT NOT NULL,
  status VARCHAR(191) DEFAULT 'PENDING', -- PENDING, PAID, EXPIRED, FAILED
  paymentGateway VARCHAR(191),           -- midtrans, xendit, duitku  
  paymentToken VARCHAR(191) UNIQUE,
  paymentUrl TEXT,
  transactionId VARCHAR(191),
  targetBankName VARCHAR(191),
  targetBankAccountNumber VARCHAR(191),
  targetBankAccountName VARCHAR(191),
  senderAccountName VARCHAR(191),
  senderAccountNumber VARCHAR(191),
  receiptImage TEXT,
  note TEXT,
  paidAt DATETIME,
  expiredAt DATETIME,
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (agentId) REFERENCES agents(id) ON DELETE CASCADE,
  INDEX idx_agentId (agentId),
  INDEX idx_status (status),
  INDEX idx_paymentToken (paymentToken)
);
```

### 3. Update `agent_sales` table
```sql
ALTER TABLE agent_sales 
ADD COLUMN paymentStatus VARCHAR(191) DEFAULT 'UNPAID',
ADD COLUMN paymentDate DATETIME,
ADD COLUMN paymentMethod VARCHAR(191),
ADD COLUMN paymentNote TEXT,
ADD COLUMN paidAmount INT DEFAULT 0,
ADD INDEX idx_paymentStatus (paymentStatus);
```

## Push Schema to Database
```bash
cd /var/www/EugineBill-radius
npx prisma db push --accept-data-loss
npx prisma generate
```

## API Endpoints

### 1. Create Deposit (Agent)
```
POST /api/agent/deposit/create
Body: {
  agentId: string,
  amount: number,    // min 10000
  gateway: string    // midtrans, xendit, duitku
}
Response: {
  success: true,
  deposit: {
    id: string,
    token: string,
    amount: number,
    paymentUrl: string,
    expiredAt: datetime
  }
}
```

### 2. Deposit Webhook (Payment Gateway)
```
POST /api/agent/deposit/webhook
Body: (varies by gateway)
- Midtrans: { order_id, transaction_status, transaction_id }
- Xendit: { external_id, status, id }
- Duitku: { merchantOrderId, resultCode, reference }

Action: Updates deposit status and agent balance
```

### 3. Create Manual Deposit Request (Agent)
```
POST /api/agent/deposit/manual-request
Body: {
  agentId: string,
  amount: number,                    // min 10000
  targetBankName: string,
  targetBankAccountNumber: string,
  targetBankAccountName: string,
  senderAccountName: string,
  senderAccountNumber?: string,
  receiptImage: string,              // URL/path hasil upload proof
  note?: string
}

Response: {
  success: true,
  message: string,
  deposit: {
    id: string,
    status: "PENDING",
    paymentGateway: "manual"
  }
}
```

### 4. Admin Manual Deposit Verification
```
GET /api/admin/agent-deposits?status=ALL|PENDING|PAID|CANCELLED
PATCH /api/admin/agent-deposits

PATCH Body: {
  depositId: string,
  action: "approve" | "reject"
}
```

### 5. Company Info (Bank Accounts Source)
```
GET /api/company/info

Response includes:
{
  companyInfo: {
    ...,
    bankAccounts: [
      {
        bankName: string,
        accountNumber: string,
        accountName: string
      }
    ]
  }
}
```

### 3. Generate Voucher (Updated)
```
POST /api/agent/generate-voucher
Body: {
  agentId: string,
  profileId: string,
  quantity: number
}

New Logic:
1. Calculate totalCost = profile.costPrice * quantity
2. Check agent.balance >= totalCost
3. Check agent.balance - totalCost >= agent.minBalance
4. Generate vouchers
5. Deduct balance: agent.balance -= totalCost
6. Return new balance

Response: {
  success: true,
  vouchers: [...],
  cost: number,
  newBalance: number,
  message: string
}
```

### 6. Agent Dashboard (Updated)
```
GET /api/agent/dashboard?agentId=xxx

Response includes:
{
  stats: { ... },
  profiles: [...],
  vouchers: [...],
  balance: number,        // NEW
  minBalance: number,     // NEW
  deposits: [             // NEW
    {
      id: string,
      amount: number,
      status: string,
      paymentUrl: string,
      createdAt: datetime
    }
  ]
}
```

## Workflow

### Agent Deposit Flow (Gateway)
```
1. Agent login to /agent/dashboard
2. Click "Top Up" button
3. Enter amount (min Rp 10.000)
4. Select payment gateway (Midtrans/Xendit/Duitku)
5. Click "Create Payment"
6. System creates deposit record (status: PENDING)
7. System generates payment URL via gateway API
8. Agent redirected to payment page
9. Agent completes payment
10. Gateway sends webhook to /api/agent/deposit/webhook
11. System updates:
    - deposit.status = 'PAID'
    - deposit.paidAt = now()
    - agent.balance += deposit.amount
12. Agent sees updated balance in dashboard
```

### Agent Deposit Flow (Manual Transfer)
```
1. Agent login ke /agent/dashboard
2. Klik "Top Up"
3. Pilih mode "Manual Transfer"
4. Isi nominal + pilih rekening admin tujuan
5. Isi data rekening pengirim
6. Upload bukti transfer
7. Submit request ke /api/agent/deposit/manual-request
8. Admin review di /admin/hotspot/agent/deposits:
   - nominal
   - rekening tujuan
   - data pengirim
   - bukti transfer
9. Admin approve/reject
10. Jika approve:
  - status deposit -> PAID
  - saldo agent bertambah
  - agent menerima notifikasi sukses
11. Jika reject:
  - status deposit -> CANCELLED
  - agent menerima notifikasi ditolak
```

### Generate Voucher Flow
```
1. Agent selects profile
2. Enter quantity
3. System checks:
   - cost = profile.costPrice * quantity
   - agent.balance >= cost ?
   - agent.balance - cost >= minBalance ?
4. If OK:
   - Generate vouchers
   - agent.balance -= cost
   - Return success + new balance
5. If NOT OK:
   - Return error: "Insufficient balance, please top up"
```

### Sales Commission Flow
```
1. Customer uses voucher (status: WAITING → ACTIVE)
2. Cron job (every 5 min) detects ACTIVE vouchers
3. System creates agent_sale record:
   - amount = profile.resellerFee (agent profit)
   - paymentStatus = 'UNPAID' (agent owes admin)
4. Admin sees unpaid sales in /admin/hotspot/agent
5. Agent pays admin (cash/transfer)
6. Admin marks sale as PAID
```

## Admin Features

### Agent Management (/admin/hotspot/agent)
Add columns:
- Balance (current saldo)
- Min Balance (minimum required)
- Actions: "Adjust Balance" button

### Adjust Balance Dialog
```
- Agent: [name]
- Current Balance: Rp xxx
- Adjustment Type: [Add / Deduct / Set]
- Amount: [input]
- Note: [textarea]
- [Save Button]
```

### Sales Payment Tracking
Add filter:
- Payment Status: [All / UNPAID / PAID]

Add bulk action:
- Mark Selected as PAID

### Manual Deposit Verification UI
Halaman `/admin/hotspot/agent/deposits` menampilkan kolom tambahan:
- Rekening tujuan admin
- Rekening pengirim agent
- Catatan request
- Link bukti transfer (`receiptImage`)

## Configuration

### Set Minimum Balance (per agent)
```
Admin can set minBalance for each agent:
- 0 = no minimum
- 50000 = agent must keep at least Rp 50k balance
```

### Payment Gateway Setup
Agent deposits use the same payment gateway config as invoices:
- /admin/payment-gateway
- Configure Midtrans/Xendit/Duitku
- Webhook URL: https://yourdomain.com/api/agent/deposit/webhook

### Manual Transfer Setup
- Pastikan `company.bankAccounts` terisi dari halaman pengaturan company/admin.
- Endpoint agent akan menolak request manual jika rekening tujuan/bukti transfer tidak diisi.

## Testing

### 1. Test Deposit
```bash
curl -X POST http://localhost:3000/api/agent/deposit/create \
  -H "Content-Type: application/json" \
  -d '{"agentId":"xxx","amount":100000,"gateway":"midtrans"}'
```

### 2. Test Generate with Balance Check
```bash
# Should fail if balance < cost
curl -X POST http://localhost:3000/api/agent/generate-voucher \
  -H "Content-Type: application/json" \
  -d '{"agentId":"xxx","profileId":"yyy","quantity":10}'
```

### 3. Test Webhook (Simulated)
```bash
curl -X POST http://localhost:3000/api/agent/deposit/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "order_id":"deposit-id",
    "transaction_status":"settlement",
    "transaction_id":"TRX-xxx"
  }'
```

### 4. Test Manual Request
```bash
curl -X POST http://localhost:3000/api/agent/deposit/manual-request \
  -H "Content-Type: application/json" \
  -d '{
    "agentId":"xxx",
    "amount":100000,
    "targetBankName":"BCA",
    "targetBankAccountNumber":"1234567890",
    "targetBankAccountName":"PT EugineBill",
    "senderAccountName":"Nama Agent",
    "senderAccountNumber":"0987654321",
    "receiptImage":"/uploads/payment-proofs/receipt-xxx.jpg",
    "note":"Top up manual Maret"
  }'
```

## Security Notes

1. **Webhook Security**: Add signature validation for production
2. **Balance Validation**: Always check balance before deducting
3. **Transaction Atomicity**: Use Prisma transactions for balance updates
4. **Minimum Balance**: Prevent agent from going below minBalance

## Files Created/Modified

### New Files
- `/src/app/api/agent/deposit/create/route.ts`
- `/src/app/api/agent/deposit/webhook/route.ts`
- `/src/app/api/agent/deposit/manual-request/route.ts`
- `/src/app/api/admin/agent-deposits/route.ts`
- `/src/app/admin/hotspot/agent/deposits/page.tsx`
- `/prisma/migrations/20260318120000_add_agent_manual_deposit_fields/migration.sql`
- `/docs/billing/AGENT_DEPOSIT_SYSTEM.md` (this file)

### Modified Files
- `/prisma/schema.prisma` - Added balance fields and agentDeposit model
- `/src/app/api/company/info/route.ts` - Expose `bankAccounts` for agent manual transfer target
- `/src/app/api/agent/generate-voucher/route.ts` - Added balance check and deduction
- `/src/app/api/agent/dashboard/route.ts` - Include latest deposits for dashboard
- `/src/app/agent/dashboard/page.tsx` - Add gateway/manual top-up UI + upload proof flow
- `/src/app/admin/hotspot/agent/page.tsx` - Balance management

## Next Steps

1. Push migration/schema ke database production
2. Validasi upload proof (size/type) sesuai kebijakan deployment
3. Uji end-to-end approval/rejection flow di environment staging
4. Konfirmasi notifikasi agent/admin untuk status manual request
5. Dokumentasikan SOP verifikasi deposit manual untuk tim finance

## Support

For issues or questions:
- Check logs: `/var/www/EugineBill-radius/logs/`
- Check deposit status in database
- Verify webhook is receiving callbacks
- Test payment gateway credentials
