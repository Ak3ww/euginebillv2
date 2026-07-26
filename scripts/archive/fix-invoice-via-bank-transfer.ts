import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixInvoiceViaBankTransfer() {
  console.log('🔧 Memperbarui Via pembayaran invoice INV-20260725-7AE12E ke Bank Transfer...\n');

  try {
    const inv = await prisma.invoice.findFirst({
      where: {
        invoiceNumber: { contains: '7AE12E' },
      },
    });

    if (!inv) {
      console.log('❌ Invoice INV-20260725-7AE12E tidak ditemukan.');
      return;
    }

    // 1. Check if payment record exists
    const existingPayment = await prisma.payment.findFirst({
      where: { invoiceId: inv.id },
    });

    if (existingPayment) {
      await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          method: 'bank_transfer',
          status: 'PAID',
        },
      });
      console.log(`✅ Berhasil memperbarui Payment record (${existingPayment.id}) -> method: 'bank_transfer'`);
    } else {
      await prisma.payment.create({
        data: {
          id: crypto.randomUUID(),
          invoiceId: inv.id,
          amount: inv.amount,
          method: 'bank_transfer',
          status: 'PAID',
          paidAt: inv.paidAt || new Date(),
        },
      });
      console.log(`✅ Berhasil membuat Payment record baru -> method: 'bank_transfer'`);
    }

    console.log('\n🎉 Selesai! Invoice INV-20260725-7AE12E sekarang 100% menampilkan: Via: Bank Transfer!');
  } catch (error) {
    console.error('❌ Error fixing invoice via:', error);
  } finally {
    await prisma.$disconnect();
    process.exit(0);
  }
}

fixInvoiceViaBankTransfer();
