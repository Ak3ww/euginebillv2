import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { activateAndBillUser } from '@/server/services/activation.service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;

    const invoice = await activateAndBillUser(id);
    return NextResponse.json({ success: true, invoice });
  } catch (error: any) {
    console.error('Activate and bill error:', error);
    return NextResponse.json({ error: error.message || 'Failed to activate and bill' }, { status: 500 });
  }
}
