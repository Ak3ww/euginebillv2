import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
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

    // Get registration
    const registration = await prisma.registrationRequest.findUnique({
      where: { id },
    });

    if (!registration) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    if (registration.status !== 'APPROVED') {
      return NextResponse.json(
        { error: 'Registration must be approved first' },
        { status: 400 }
      );
    }

    if (!registration.pppoeUserId) {
      return NextResponse.json(
        { error: 'PPPoE user not created yet' },
        { status: 400 }
      );
    }

    if (registration.invoiceId) {
      return NextResponse.json(
        { error: 'Installation invoice already generated' },
        { status: 400 }
      );
    }

    const invoice = await activateAndBillUser(registration.pppoeUserId);

    return NextResponse.json({
      success: true,
      message: 'Installation marked as done and invoice generated',
      invoice,
    });
  } catch (error: any) {
    console.error('Mark installed error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to mark installation done' },
      { status: 500 }
    );
  }
}
