import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { randomBytes } from 'crypto';
import { getUploadDir } from '@/lib/upload-dir';

// POST - Universal fallback upload endpoint (/api/upload)
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawType = (formData.get('type') as string) || 'idCard';

    if (!file) {
      return NextResponse.json({ success: false, error: 'File tidak ditemukan' }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Tipe file tidak valid. Hanya JPG, PNG, WebP, dan PDF yang diizinkan.' },
        { status: 400 }
      );
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file melebihi batas 10MB.' },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const uniqueId = randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const extension = file.name.split('.').pop() || 'jpg';

    const isIdCard = rawType === 'idCard' || rawType === 'id_card' || rawType === 'ktp';
    const subfolder = isIdCard ? 'id-cards' : 'installations';
    const prefix = isIdCard ? 'ktp' : 'upload';
    const filename = `${prefix}-${timestamp}-${uniqueId}.${extension}`;

    const uploadDir = getUploadDir('pppoe-customers', subfolder);
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const url = `/api/uploads/pppoe-customers/${subfolder}/${filename}`;

    return NextResponse.json({
      success: true,
      url,
      filename,
    });
  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengunggah file' },
      { status: 500 }
    );
  }
}
