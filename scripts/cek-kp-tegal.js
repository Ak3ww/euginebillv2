#!/usr/bin/env node
/**
 * Skrip Cek Status Isolir Pelanggan Area KAMPUNG TEGAL
 * Penggunaan di VPS:
 *   node scripts/cek-kp-tegal.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('='.repeat(70));
  console.log('🔍 PENGECEKAN STATUS ISOLIR PELANGGAN AREA: KAMPUNG TEGAL');
  console.log('='.repeat(70));

  try {
    // 1. Cari area Kampung Tegal
    const areas = await prisma.$queryRawUnsafe(
      `SELECT id, name FROM pppoe_areas WHERE LOWER(name) LIKE '%tegal%'`
    );

    if (!areas || areas.length === 0) {
      console.log('❌ Area "KAMPUNG TEGAL" tidak ditemukan di database pppoe_areas.');
      return;
    }

    console.log(`📍 Ditemukan ${areas.length} area:`);
    areas.forEach(a => console.log(`   - ID: ${a.id} | Nama: ${a.name}`));

    const areaIds = areas.map(a => `'${a.id}'`).join(',');

    // 2. Ambil ringkasan
    const summary = await prisma.$queryRawUnsafe(`
      SELECT 
        COUNT(*) AS total,
        SUM(CASE WHEN autoIsolationEnabled = 0 THEN 1 ELSE 0 END) AS no_action_count,
        SUM(CASE WHEN autoIsolationEnabled = 1 OR autoIsolationEnabled IS NULL THEN 1 ELSE 0 END) AS isolate_count,
        SUM(CASE WHEN status = 'isolated' THEN 1 ELSE 0 END) AS currently_isolated,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS currently_active
      FROM pppoe_users 
      WHERE areaId IN (${areaIds})
    `);

    const row = summary[0] || {};
    const total = Number(row.total || 0);
    const noAction = Number(row.no_action_count || 0);
    const isolate = Number(row.isolate_count || 0);
    const currentlyIsolated = Number(row.currently_isolated || 0);
    const currentlyActive = Number(row.currently_active || 0);

    console.log('\n📊 RINGKASAN STATUS KAMPUNG TEGAL:');
    console.log(`   • Total Pelanggan         : ${total}`);
    console.log(`   • TETAP TERHUBUNG (Kebal Isolir) : ${noAction} pelanggan`);
    console.log(`   • Auto-Isolir Masih Aktif        : ${isolate} pelanggan`);
    console.log(`   • Status Saat Ini Aktif          : ${currentlyActive}`);
    console.log(`   • Status Saat Ini Terisolir      : ${currentlyIsolated}`);

    // 3. Tampilkan daftar pelanggan
    const users = await prisma.$queryRawUnsafe(`
      SELECT username, name, status, expiredAt, autoIsolationEnabled
      FROM pppoe_users
      WHERE areaId IN (${areaIds})
      ORDER BY autoIsolationEnabled ASC, username ASC
    `);

    console.log('\n📋 DAFTAR DETAIL PELANGGAN:');
    console.log('-'.repeat(70));
    console.log('Username'.padEnd(20) + 'Status'.padEnd(12) + 'Aksi Jatuh Tempo'.padEnd(25) + 'Expired At');
    console.log('-'.repeat(70));

    users.forEach(u => {
      const isKebal = (u.autoIsolationEnabled === 0 || u.autoIsolationEnabled === false);
      const aksiText = isKebal ? 'TETAP TERHUBUNG (Aman)' : 'ISOLIR OTOMATIS';
      const expText = u.expiredAt ? new Date(u.expiredAt).toLocaleDateString('id-ID') : '-';
      console.log(
        (u.username || '').padEnd(20) +
        (u.status || '').padEnd(12) +
        aksiText.padEnd(25) +
        expText
      );
    });
    console.log('-'.repeat(70));

    if (currentlyIsolated > 0 || isolate > 0) {
      console.log('\n⚠️ PERHATIAN: Masih ada pelanggan yang kena Auto-Isolir atau sedang terisolir!');
      console.log('   Menjalankan auto-fix: mengubah seluruh pelanggan Kampung Tegal ke "TETAP TERHUBUNG" & mengaktifkan status...');
      
      const fixed = await prisma.$executeRawUnsafe(`
        UPDATE pppoe_users 
        SET autoIsolationEnabled = 0,
            status = CASE WHEN status = 'isolated' THEN 'active' ELSE status END
        WHERE areaId IN (${areaIds})
      `);

      console.log(`   ✅ Selesai! ${fixed} pelanggan berhasil disetel ke TETAP TERHUBUNG (No Action) dan status aktif.`);
    } else {
      console.log('\n✅ KONDISI SEMPURNA: Semua pelanggan Kampung Tegal sudah berstatus TETAP TERHUBUNG (Kebal Isolir).');
    }

  } catch (error) {
    console.error('❌ Error saat mengecek data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
