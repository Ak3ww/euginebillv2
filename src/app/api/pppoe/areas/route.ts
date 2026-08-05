import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';
import { logActivity } from '@/server/services/activity-log.service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/server/auth/config';

// GET - List all areas
export async function GET() {
  try {
    const areas = await prisma.pppoeArea.findMany({
      include: {
        router: {
          select: { id: true, name: true, nasname: true },
        },
        _count: {
          select: { users: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({
      areas: areas.map((area: any) => ({
        ...area,
        userCount: area._count.users,
      })),
      count: areas.length,
    });
  } catch (error) {
    console.error('Get areas error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Create new area
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { name, description, routerId, isActive } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama area wajib diisi' }, { status: 400 });
    }

    if (!routerId || !routerId.trim()) {
      return NextResponse.json({ error: 'Router / NAS wajib dipilih untuk area ini' }, { status: 400 });
    }

    // Check if area name already exists
    const existingArea = await prisma.pppoeArea.findUnique({
      where: { name: name.trim() },
    });

    if (existingArea) {
      return NextResponse.json({ error: `Area "${name}" sudah ada` }, { status: 400 });
    }

    const area = await prisma.pppoeArea.create({
      data: {
        id: crypto.randomUUID(),
        name: name.trim(),
        description: description || null,
        routerId: routerId.trim(),
        isActive: isActive !== false,
      },
      include: {
        router: { select: { id: true, name: true } },
      },
    });

    // Log activity
    await logActivity({
      username: session?.user?.name || 'System',
      userRole: session?.user?.role,
      action: 'CREATE_AREA',
      description: `Area "${area.name}" dibuat (NAS: ${area.router?.name || routerId})`,
      module: 'pppoe',
      status: 'success',
      metadata: { areaId: area.id, areaName: area.name, routerId },
      request,
    });

    return NextResponse.json({ area, success: true });
  } catch (error) {
    console.error('Create area error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT - Update area
export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const body = await request.json();
    const { id, name, description, routerId, isActive } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID area wajib diisi' }, { status: 400 });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama area wajib diisi' }, { status: 400 });
    }

    if (!routerId || !routerId.trim()) {
      return NextResponse.json({ error: 'Router / NAS wajib dipilih untuk area ini' }, { status: 400 });
    }

    // Check if area exists
    const existingArea = await prisma.pppoeArea.findUnique({
      where: { id },
    });

    if (!existingArea) {
      return NextResponse.json({ error: 'Area tidak ditemukan' }, { status: 404 });
    }

    // Check if new name conflicts with another area
    if (name.trim() !== existingArea.name) {
      const conflictArea = await prisma.pppoeArea.findUnique({
        where: { name: name.trim() },
      });
      if (conflictArea) {
        return NextResponse.json({ error: `Area "${name}" sudah ada` }, { status: 400 });
      }
    }

    const area = await prisma.pppoeArea.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description || null,
        routerId: routerId.trim(),
        isActive: isActive !== false,
      },
      include: {
        router: { select: { id: true, name: true } },
      },
    });

    // Also update all users belonging to this area to match area's routerId
    await prisma.pppoeUser.updateMany({
      where: { areaId: id },
      data: { routerId: routerId.trim() },
    });

    // Log activity
    await logActivity({
      username: session?.user?.name || 'System',
      userRole: session?.user?.role,
      action: 'UPDATE_AREA',
      description: `Area "${area.name}" diperbarui`,
      module: 'pppoe',
      status: 'success',
      metadata: { areaId: area.id, areaName: area.name },
      request,
    });

    return NextResponse.json({ area, success: true });
  } catch (error) {
    console.error('Update area error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Delete area
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID area wajib diisi' }, { status: 400 });
    }

    // Check if area exists and has users
    const area = await prisma.pppoeArea.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });

    if (!area) {
      return NextResponse.json({ error: 'Area tidak ditemukan' }, { status: 404 });
    }

    if (area._count.users > 0) {
      return NextResponse.json(
        { error: `Tidak dapat menghapus area "${area.name}" karena masih memiliki ${area._count.users} pelanggan` },
        { status: 400 }
      );
    }

    await prisma.pppoeArea.delete({
      where: { id },
    });

    // Log activity
    await logActivity({
      username: session?.user?.name || 'System',
      userRole: session?.user?.role,
      action: 'DELETE_AREA',
      description: `Area "${area.name}" dihapus`,
      module: 'pppoe',
      status: 'success',
      metadata: { areaId: id, areaName: area.name },
      request,
    });

    return NextResponse.json({ success: true, message: 'Area berhasil dihapus' });
  } catch (error) {
    console.error('Delete area error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
