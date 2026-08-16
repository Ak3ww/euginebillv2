import { prisma } from '../src/server/db/client';

async function cleanupDuplicatePsbInvoices() {
  console.log('🔍 Cleaning up duplicate invoices generated for paid PSB customers...');

  // Specific invoice numbers specified by user
  const targetNumbers = [
    'INV-20260816-ABC754',
    'INV-20260816-8AB623',
    'INV-20260816-F00616',
  ];

  // Also search for any PENDING invoice generated today for users who already have a PAID invoice in August 2026
  const targetInvoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { invoiceNumber: { in: targetNumbers } },
        {
          status: 'PENDING',
          invoiceType: 'MONTHLY',
          createdAt: { gte: new Date('2026-08-16T00:00:00Z') },
        },
      ],
    },
    include: {
      user: {
        include: {
          invoices: true,
        },
      },
    },
  });

  console.log(`Found ${targetInvoices.length} candidate invoice(s) to evaluate.`);

  let cancelledCount = 0;
  for (const inv of targetInvoices) {
    if (!inv.user) continue;

    // Check if user already has a PAID invoice in August 2026
    const augPaidInvoices = inv.user.invoices.filter(i =>
      i.id !== inv.id &&
      i.status === 'PAID' &&
      ((i.paidAt && new Date(i.paidAt) >= new Date('2026-08-01T00:00:00Z')) ||
       (i.createdAt && new Date(i.createdAt) >= new Date('2026-08-01T00:00:00Z')))
    );

    const isExplicitTarget = targetNumbers.includes(inv.invoiceNumber);

    if (isExplicitTarget || augPaidInvoices.length > 0) {
      console.log(`- Cancelling duplicate invoice #${inv.invoiceNumber} for ${inv.customerName} (${inv.customerUsername}) - Paid August invoices: ${augPaidInvoices.length}`);

      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: 'CANCELLED' },
      });

      cancelledCount++;
    }
  }

  console.log(`🎉 Cleanup complete! Cancelled ${cancelledCount} duplicate invoice(s).`);
}

cleanupDuplicatePsbInvoices()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
