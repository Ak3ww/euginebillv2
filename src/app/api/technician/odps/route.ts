import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// GET - Fetch ODPs for technician autocomplete and GPS matching
export async function GET() {
  try {
    const odps = await prisma.networkODP.findMany({
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        portCount: true,
        status: true,
      },
      orderBy: {
        name: 'asc',
      },
    });

    return NextResponse.json({
      success: true,
      odps,
    });
  } catch (error: any) {
    console.error('Fetch technician ODPs error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch ODPs' },
      { status: 500 }
    );
  }
}
