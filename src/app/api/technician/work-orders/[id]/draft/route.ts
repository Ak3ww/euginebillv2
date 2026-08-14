import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { prisma } from '@/server/db/client';
import { TECH_JWT_SECRET } from '@/server/auth/technician-secret';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

async function authenticate(req: NextRequest): Promise<boolean> {
  const session = await getServerSession(authOptions);
  if (session?.user) return true;
  const token = req.cookies.get('technician-token')?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, TECH_JWT_SECRET);
    return !!payload.id;
  } catch {
    return false;
  }
}

// GET — Load server-side wizard draft (for cross-device resume)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const wo = await prisma.workOrder.findUnique({
      where: { id },
    });
    if (!wo) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const rawWo = wo as any;
    return NextResponse.json({ success: true, wizardStep: rawWo.wizardStep || 1, wizardDraftData: rawWo.wizardDraftData || null });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT — Save wizard draft step to server (cross-device resume)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!(await authenticate(req))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { wizardStep, wizardDraftData } = body;
    const updateData: any = {};
    if (wizardStep !== undefined) updateData.wizardStep = Number(wizardStep);
    if (wizardDraftData !== undefined) updateData.wizardDraftData = wizardDraftData;

    await prisma.workOrder.update({
      where: { id },
      data: updateData,
    });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
