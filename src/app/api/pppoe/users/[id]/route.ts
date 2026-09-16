import { NextRequest } from 'next/server';
import { ok, notFound, serverError, badRequest, conflict, unauthorized } from '@/lib/api-response';
import { getPppoeUserById, updatePppoeUser } from '@/server/services/pppoe.service';
import { prisma } from '@/server/db/client';
import { checkAuth } from '@/server/middleware/api-auth';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

export const dynamic = 'force-dynamic';

// GET - Get single user with active session info
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await checkAuth();
  if (!auth.authorized) return auth.response;
  try {
    const { id } = await params;
    const result = await getPppoeUserById(id);
    if (!result) return notFound('User');
    
    return ok({ user: result.user, activeSession: result.activeSession });
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
  const auth = await checkAuth();
  if (!auth.authorized) return auth.response;
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
    
    // Allow safe fields to be updated
    const { name, phone, email, address, password, comment, expiredAt } = body;
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (phone !== undefined) updateData.phone = phone;
    if (email !== undefined) updateData.email = email;
    if (address !== undefined) updateData.address = address;
    if (password !== undefined && password.trim() !== '') updateData.password = password;
    if (comment !== undefined) updateData.comment = comment;
    if (expiredAt !== undefined) {
      const expStr = String(expiredAt);
      if (/^\d{4}-\d{2}-\d{2}$/.test(expStr)) {
        const [y, m, d] = expStr.split('-').map(Number);
        updateData.expiredAt = new Date(Date.UTC(y, m - 1, d, 16, 59, 59, 999));
      } else {
        updateData.expiredAt = new Date(expStr);
      }
    }
    
    const updated = await prisma.pppoeUser.update({
      where: { id: existing.id },
      data: updateData,
    });

    if (phone !== undefined || name !== undefined) {
      await prisma.invoice.updateMany({
        where: { userId: existing.id },
        data: {
          ...(phone !== undefined && { customerPhone: phone }),
          ...(name !== undefined && { customerName: name }),
        },
      }).catch(() => {});

      if (phone !== undefined || name !== undefined) {
        await prisma.invoice.updateMany({
          where: { userId: existing.id },
          data: {
            ...(phone !== undefined && { customerPhone: phone }),
            ...(name !== undefined && { customerName: name }),
          },
        }).catch(() => {});
        await prisma.workOrder.updateMany({
          where: { linkedUserId: existing.id },
          data: {
            ...(phone !== undefined && { customerPhone: phone }),
            ...(name !== undefined && { customerName: name }),
          },
        }).catch(() => {});
      }
    }
    
    return ok({ success: true, user: updated });
  } catch (error) {
    console.error('PATCH user error:', error);
    return serverError();
  }
}

// PUT - Update full PPPoE user by id (supports inventory ONT replacement)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const { id } = await params;
    const body = await request.json();
    const user = await updatePppoeUser({ ...body, id }, session, request);
    return ok({ success: true, user });
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.code === 'NOT_FOUND') return notFound(err.message);
    if (err.code === 'DUPLICATE_USERNAME') return conflict(err.message!);
    console.error('Update PPPoE user [id] error:', error);
    return serverError(err.message || 'Gagal memperbarui pelanggan PPPoE');
  }
}
