import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import * as XLSX from 'xlsx';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Ambil data referensi
    const [routers, profiles, areas] = await Promise.all([
      prisma.router.findMany({ select: { name: true } }),
      prisma.pppoeProfile.findMany({ select: { name: true } }),
      prisma.pppoeArea.findMany({ select: { name: true } }),
    ]);

    const wb = XLSX.utils.book_new();

    // 1. Sheet Data Utama
    const dataHeaders = [
      'ID PELANGGAN',
      'NAMA PELANGGAN (WAJIB)',
      'NOMER WA',
      'ALAMAT',
      'NO KTP',
      'EMAIL',
      'LATITUDE',
      'LONGITUDE',
      'AREA',
      'SERVER NAS (WAJIB)',
      'MODE USER (WAJIB)',
      'PAKET PELANGGAN (WAJIB)',
    ];
    
    // Contoh data (baris kedua)
    const exampleData = [
      'EU-0001',
      'Budi Santoso',
      '08123456789',
      'Jl. Merdeka No.1',
      '3201234567890001',
      'budi@example.com',
      '-6.200000',
      '106.816666',
      areas.length > 0 ? areas[0].name : 'Area Pusat',
      routers.length > 0 ? routers[0].name : 'Mikrotik Pusat',
      'PPPOE', // PPPOE, HOTSPOT, STATIC
      profiles.length > 0 ? profiles[0].name : '10 Mbps',
    ];

    const wsData = XLSX.utils.aoa_to_sheet([dataHeaders, exampleData]);
    
    // Atur lebar kolom agar rapi
    wsData['!cols'] = [
      { wch: 15 }, { wch: 25 }, { wch: 15 }, { wch: 30 }, 
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, 
      { wch: 20 }, { wch: 20 }, { wch: 15 }, { wch: 25 }
    ];

    XLSX.utils.book_append_sheet(wb, wsData, 'Data Import');

    // 2. Sheet Referensi
    const refData = [
      ['PANDUAN PENGISIAN'],
      [''],
      ['1. ID PELANGGAN: Boleh dikosongkan (akan dibuat otomatis oleh sistem).'],
      ['2. NAMA PELANGGAN: Wajib diisi. Username aplikasi/internet akan mengambil dari nama ini atau ID Pelanggan.'],
      ['3. MODE USER: Wajib diisi salah satu (PPPOE / HOTSPOT / STATIC).'],
      ['4. SERVER NAS: Wajib diisi sama persis dengan nama Server/NAS di bawah ini.'],
      ['5. PAKET PELANGGAN: Wajib diisi sama persis dengan nama Profil Paket di bawah ini.'],
      ['6. AREA: Wajib diisi sama persis dengan nama Area di bawah ini.'],
      [''],
      ['DAFTAR SERVER NAS (ROUTER)', ...routers.map(r => r.name)],
      [''],
      ['DAFTAR PROFIL PAKET', ...profiles.map(p => p.name)],
      [''],
      ['DAFTAR AREA', ...areas.map(a => a.name)],
    ];
    
    // Transpose refData agar menjorok ke bawah
    const transposedRefData = refData.map(row => [row[0], row.slice(1).join(', ')]);
    const wsRef = XLSX.utils.aoa_to_sheet(refData.map(row => row));
    wsRef['!cols'] = [{ wch: 30 }, { wch: 50 }, { wch: 20 }, { wch: 20 }, { wch: 20 }];
    
    XLSX.utils.book_append_sheet(wb, wsRef, 'Referensi & Bantuan');

    // Generate buffer
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    // Return sebagai file download
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'Content-Disposition': 'attachment; filename="Template_Import_Pelanggan_EugineBill.xlsx"',
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    });

  } catch (error) {
    console.error('Error generating template:', error);
    return NextResponse.json({ error: 'Gagal membuat template' }, { status: 500 });
  }
}
