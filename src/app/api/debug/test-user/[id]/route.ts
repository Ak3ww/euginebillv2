import { NextRequest, NextResponse } from 'next/server';
import { getPppoeUserById } from '@/server/services/pppoe.service';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPppoeUserById(id);
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: String(error), stack: error?.stack });
  }
}
