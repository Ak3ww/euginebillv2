import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';
import { existsSync } from 'fs';
import { UPLOAD_DIR } from '@/lib/upload-dir';

const CONTENT_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf',
};

/**
 * Catch-all route: serves any uploaded file from persistent UPLOAD_DIR or fallbacks.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ filepath: string[] }> }
) {
  try {
    const { filepath: segments } = await params;

    // Security: reject path traversal
    for (const seg of segments) {
      if (seg === '..' || seg.includes('/') || seg.includes('\\') || seg.includes('\0')) {
        return new NextResponse('Invalid path', { status: 400 });
      }
    }

    const filename = segments[segments.length - 1];
    const ext = extname(filename).toLowerCase();
    const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';

    // Restrict filename characters
    if (!/^[a-zA-Z0-9._-]+$/.test(filename)) {
      return new NextResponse('Invalid filename', { status: 400 });
    }

    const relativePath = join(...segments);
    const candidatePaths = [
      join(UPLOAD_DIR, relativePath),
      join(process.cwd(), 'public', 'uploads', relativePath),
      join(process.cwd(), 'public', relativePath),
      join(process.cwd(), 'data', 'uploads', relativePath),
    ];

    let targetFile = '';
    for (const candidate of candidatePaths) {
      if (existsSync(candidate)) {
        targetFile = candidate;
        break;
      }
    }

    if (!targetFile) {
      return new NextResponse('File not found', { status: 404 });
    }

    const file = await readFile(targetFile);

    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Serve upload error:', error);
    return new NextResponse('Failed to serve file', { status: 500 });
  }
}
