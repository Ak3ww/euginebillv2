import { NextRequest } from 'next/server';
import { ok, notFound, serverError } from '@/lib/api-response';
import { getPppoeUserById } from '@/server/services/pppoe.service';

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
