import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { runInitialModemImport } from '../../../../../../scripts/import-initial-modems';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const secret = req.headers.get('x-cron-secret');
    const host = req.headers.get('host') || '';
    const isLocalhost = host.startsWith('localhost') || host.startsWith('127.0.0.1');
    const isValidSecret = process.env.CRON_SECRET && secret === process.env.CRON_SECRET;

    if (!isLocalhost && !isValidSecret) {
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }

      const userRole = (session.user as { role?: string }).role;
      if (userRole !== 'SUPER_ADMIN' && userRole !== 'WAREHOUSE') {
        return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN or WAREHOUSE only' }, { status: 403 });
      }
    }

    const result = await runInitialModemImport();

    return NextResponse.json({
      success: true,
      message: `Berhasil mengimpor ${result.importedCount} ONT pelanggan. ${result.linkedCustomerCount} ONT langsung terhubung ke akun PPPoE pelanggan!`,
      data: result,
    });
  } catch (error: any) {
    console.error('Error in import-initial-modems route:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Gagal mengimpor data ONT awal' },
      { status: 500 }
    );
  }
}
