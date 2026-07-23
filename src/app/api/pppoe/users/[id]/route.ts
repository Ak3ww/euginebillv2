import { NextRequest } from 'next/server';
import { ok, notFound, serverError } from '@/lib/api-response';
import { getPppoeUserById } from '@/server/services/pppoe.service';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

// GET - Get single user with active session info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await getPppoeUserById(id);
    if (!result) return notFound('User');
    
    // The frontend UI expects { user: { ... }, activeSession: { ... } }
    const { activeSession, unpaidInvoicesCount, ...userData } = result;
    return ok({ user: userData, activeSession });
  } catch (error) {
    console.error('Get user error:', error);
    return serverError();
  }
}

// PATCH - Update single user fields directly from details page
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    const existing = await prisma.pppoeUser.findFirst({
      where: {
        OR: [
          { id },
          { customerId: id },
          { username: id },
        ]
      }
    });
    
    if (!existing) return notFound('User');
    
    // Only allow safe fields to be updated
    const { name, phone, email, address, password, comment } = body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (password !== undefined && password.trim() !== '') updateData.password = password;
    if (comment !== undefined) updateData.comment = comment;
    
    const updated = await prisma.pppoeUser.update({
      where: { id: existing.id },
      data: updateData,
    });
    
    return ok({ success: true, user: updated });
  } catch (error) {
    console.error('PATCH user error:', error);
    return serverError();
  }
}
