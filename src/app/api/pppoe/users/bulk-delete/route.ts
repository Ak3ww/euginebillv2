import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { ok, badRequest, unauthorized, serverError } from '@/lib/api-response';
import { deletePppoeUser } from '@/server/services/pppoe.service';

export const dynamic = 'force-dynamic';

async function handleBulkDelete(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return unauthorized();

  try {
    const body = await request.json();
    const userIds: string[] = body.userIds || body.ids;
    const deleteSecretFromMikrotik = body.deleteSecret !== false;

    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return badRequest('User IDs are required');
    }

    let deletedCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    for (const userId of userIds) {
      try {
        await deletePppoeUser(userId, session, request, { deleteSecretFromMikrotik });
        deletedCount++;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Failed to bulk-delete PPPoE user ${userId}:`, err);
        errors.push({ id: userId, error: message });
      }
    }

    if (deletedCount === 0 && errors.length > 0) {
      return serverError(`Gagal menghapus pelanggan: ${errors[0].error}`);
    }

    return ok({
      success: true,
      deleted: deletedCount,
      total: userIds.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Bulk delete PPPoE users error:', error);
    return serverError(message);
  }
}

export async function DELETE(request: NextRequest) {
  return handleBulkDelete(request);
}

export async function POST(request: NextRequest) {
  return handleBulkDelete(request);
}
