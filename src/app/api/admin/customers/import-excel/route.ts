import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { prisma } from '@/server/db/client';
import bcrypt from 'bcryptjs';
import * as XLSX from 'xlsx';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return NextResponse.json({ error: 'Tidak ada file yang diunggah' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Convert ke array of arrays (AOA)
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
    if (rows.length < 2) {
      return NextResponse.json({ error: 'File Excel kosong atau format tidak sesuai' }, { status: 400 });
    }

    // Baris 0 = header, baris 1 dst = data
    const dataRows = rows.slice(1).filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== ''));

    // Ambil referensi dari database untuk validasi
    const [routers, profiles, areas] = await Promise.all([
      prisma.router.findMany({ select: { id: true, name: true } }),
      prisma.pppoeProfile.findMany({ select: { id: true, name: true } }),
      prisma.pppoeArea.findMany({ select: { id: true, name: true } }),
    ]);

    const results = {
      total: dataRows.length,
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    const hashedPassword = await bcrypt.hash('123', 10);

    // Proses insert baris per baris
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const rowNum = i + 2; // +1 for header, +1 for 0-index

      try {
        const idPelanggan = (row[0] || '').toString().trim();
        const namaPelanggan = (row[1] || '').toString().trim();
        const noWa = (row[2] || '').toString().trim();
        const alamat = (row[3] || '').toString().trim();
        const noKtp = (row[4] || '').toString().trim();
        const email = (row[5] || '').toString().trim();
        const latStr = (row[6] || '').toString().trim();
        const lngStr = (row[7] || '').toString().trim();
        const areaName = (row[8] || '').toString().trim();
        const routerName = (row[9] || '').toString().trim();
        const modeUser = (row[10] || '').toString().trim().toUpperCase();
        const profileName = (row[11] || '').toString().trim();

        if (!namaPelanggan) throw new Error('Nama Pelanggan wajib diisi');
        if (!routerName) throw new Error('Server NAS wajib diisi');
        if (!modeUser) throw new Error('Mode User wajib diisi');
        if (!profileName) throw new Error('Paket Pelanggan wajib diisi');

        if (!['PPPOE', 'HOTSPOT', 'STATIC'].includes(modeUser)) {
          throw new Error(`Mode User tidak valid: ${modeUser}. Harus PPPOE/HOTSPOT/STATIC`);
        }

        const matchedRouter = routers.find(r => r.name === routerName);
        if (!matchedRouter) throw new Error(`Server NAS "${routerName}" tidak ditemukan di database`);

        const matchedProfile = profiles.find(p => p.name === profileName);
        if (!matchedProfile) throw new Error(`Profil "${profileName}" tidak ditemukan di database`);

        let matchedAreaId = null;
        if (areaName) {
          const matchedArea = areas.find(a => a.name === areaName);
          if (matchedArea) {
            matchedAreaId = matchedArea.id;
          } else {
            // Kita bisa skip area atau throw error. Di sini kita throw error biar datanya clean.
            throw new Error(`Area "${areaName}" tidak ditemukan di database`);
          }
        }

        const finalCustomerId = idPelanggan || `EU-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
        // Jika username PPPoE/Hotspot tidak ada, gunakan customerId atau nama (huruf kecil tanpa spasi)
        const safeUsername = finalCustomerId || namaPelanggan.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Cek duplikasi
        const existingUser = await prisma.pppoeUser.findFirst({
          where: { OR: [{ customerId: finalCustomerId }, { username: safeUsername }] }
        });

        if (existingUser) {
          throw new Error(`ID Pelanggan ${finalCustomerId} atau Username ${safeUsername} sudah digunakan`);
        }

        await prisma.pppoeUser.create({
          data: {
            id: crypto.randomUUID(),
            customerId: finalCustomerId,
            name: namaPelanggan,
            username: safeUsername,
            password: hashedPassword, // Password untuk login portal ("123") dan password intenet
            phone: noWa || '-',
            address: alamat || null,
            idCardNumber: noKtp || null,
            email: email || null,
            latitude: latStr ? parseFloat(latStr) : null,
            longitude: lngStr ? parseFloat(lngStr) : null,
            areaId: matchedAreaId,
            routerId: matchedRouter.id,
            connectionType: modeUser as any,
            profileId: matchedProfile.id,
            status: 'active',
            syncedToRadius: false,
          }
        });

        results.success++;
      } catch (err: any) {
        results.failed++;
        results.errors.push(`Baris ${rowNum}: ${err.message}`);
      }
    }

    return NextResponse.json(results);
  } catch (error: any) {
    console.error('Import Error:', error);
    return NextResponse.json({ error: 'Gagal memproses file' }, { status: 500 });
  }
}
