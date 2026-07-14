const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('--- Querying DB ---');
  
  // Find recent webhook logs
  const logs = await prisma.webhookLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log('Recent Webhook Logs:');
  logs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] Gateway: ${l.gateway}, OrderID: ${l.orderId}, Status: ${l.status}, Success: ${l.success}, Error: ${l.errorMessage || '-'}`);
    console.log(`Payload: ${l.payload ? l.payload.substring(0, 200) : '-'}`);
  });

  // Find invoice
  const invs = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: 'INV-20260712-9A933C' },
        { invoiceNumber: { startsWith: 'INV-20260712' } }
      ]
    }
  });
  console.log('\nMatching Invoices:');
  invs.forEach(inv => {
    console.log(`Number: ${inv.invoiceNumber}, Amount: ${inv.amount}, Status: ${inv.status}, Token: ${inv.paymentToken}`);
  });
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
