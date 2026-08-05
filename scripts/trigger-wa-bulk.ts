import { sendInvoiceReminders } from '../src/server/jobs/voucher-sync';

async function runBulkReminders() {
  console.log('🚀 Triggering Bulk WhatsApp Invoice Reminders (CLI Mode)...');
  console.log('   (Bypassing 10:00 AM time check)\n');

  try {
    const result = await sendInvoiceReminders(true);
    console.log('\n====================================================');
    console.log('🎉 BULK REMINDER EXECUTION FINISHED:');
    console.log(`   - Status  : ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.log(`   - Sent    : ${result.sent} WhatsApp notification(s)`);
    console.log(`   - Skipped : ${result.skipped} invoice(s)`);
    if (result.error) {
      console.log(`   - Error   : ${result.error}`);
    }
    console.log('====================================================');
  } catch (err: any) {
    console.error('❌ Trigger Error:', err);
    process.exit(1);
  }
}

runBulkReminders();
