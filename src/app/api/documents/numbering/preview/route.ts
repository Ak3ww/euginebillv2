import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';
import { previewNextNumber } from '@/server/services/document-numbering.service';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { category, dept, date } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    const preview = await previewNextNumber({
      category,
      dept: dept || 'HO',
      date: date ? new Date(date) : new Date(),
    });

    return NextResponse.json({ success: true, ...preview });
  } catch (error: any) {
    console.error('Error previewing document number:', error);
    return NextResponse.json({ error: error.message || 'Failed to preview document number' }, { status: 500 });
  }
}
