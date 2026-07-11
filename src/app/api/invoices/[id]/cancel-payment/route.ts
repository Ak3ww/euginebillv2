import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { disconnectPPPoEUser } from '@/server/services/radius/coa-handler.service';

const ok = (data: any = {}) => NextResponse.json(data);
const unauthorized = () => NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
const notFound = (resource = 'Resource') => NextResponse.json({ error: `${resource} not found` }, { status: 404 });
const badRequest = (error: string) => NextResponse.json({ error }, { status: 400 });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return unauthorized();

    const { id } = await params;
    if (!id) return badRequest('Invoice ID is required');

    // Find the invoice
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        user: {
          include: { profile: true }
        }
      }
    });

    if (!invoice) return notFound('Invoice');
    if (invoice.status !== 'PAID') return badRequest('Only PAID invoices can be cancelled');

    // Transaction for atomic update
    await prisma.$transaction(async (tx) => {
      // 1. Delete associated manual payments (where gatewayId is null, or just all payments for this invoice)
      await tx.payment.deleteMany({
        where: { invoiceId: id }
      });

      // 2. Set invoice back to PENDING and remove paidAt
      await tx.invoice.update({
        where: { id },
        data: {
          status: 'PENDING',
          paidAt: null
        }
      });

      // 3. Revert expiredAt on the user
      const user = invoice.user;
      if (user && user.profile && user.expiredAt) {
        const profile = user.profile;
        const currentExpiry = new Date(user.expiredAt);
        const revertedExpiry = new Date(currentExpiry);

        switch (profile.validityUnit) {
          case 'DAYS':
            revertedExpiry.setDate(revertedExpiry.getDate() - profile.validityValue);
            break;
          case 'MONTHS':
            revertedExpiry.setMonth(revertedExpiry.getMonth() - profile.validityValue);
            break;
          case 'HOURS':
            revertedExpiry.setHours(revertedExpiry.getHours() - profile.validityValue);
            break;
          case 'MINUTES':
            revertedExpiry.setMinutes(revertedExpiry.getMinutes() - profile.validityValue);
            break;
        }

        await tx.pppoeUser.update({
          where: { id: user.id },
          data: { expiredAt: revertedExpiry }
        });
      }
    });

    // Re-fetch user to check if they need isolation now that expiredAt is reverted
    const updatedUser = await prisma.pppoeUser.findUnique({
      where: { id: invoice.userId! },
      include: { profile: true }
    });

    if (updatedUser && updatedUser.expiredAt) {
      const now = new Date();
      if (new Date(updatedUser.expiredAt) < now) {
        // They are expired! Disconnect them so RADIUS gives them the isolation profile next.
        try {
          if (updatedUser.username) {
            await disconnectPPPoEUser(updatedUser.username);
          }
        } catch (error) {
          console.error('[Cancel Payment] Error disconnecting user:', error);
        }
      }
    }

    return ok({ success: true });
  } catch (error: any) {
    console.error('[Cancel Payment] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
