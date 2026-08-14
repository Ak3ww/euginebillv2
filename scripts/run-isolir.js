const { autoIsolatePPPoEUsers } = require('../src/server/jobs/pppoe-sync');

async function main() {
  console.log('=== RUNNING AUTO ISOLIR FROM CLI ===');
  const result = await autoIsolatePPPoEUsers();
  console.log('Result:', JSON.stringify(result, null, 2));
}

main().catch(console.error);
