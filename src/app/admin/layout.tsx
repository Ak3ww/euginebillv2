import type { Metadata } from 'next';
import AdminClientLayout from './AdminClientLayout';
import { prisma } from '@/server/db/client';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  try {
    const company = await prisma.company.findFirst({ select: { name: true } });
    return {
      title: `Admin Panel - ${company?.name || 'EugineBill RADIUS'}`,
      manifest: '/manifest-admin.json',
    };
  } catch {
    return {
      title: 'Admin Panel - EugineBill RADIUS',
      manifest: '/manifest-admin.json',
    };
  }
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminClientLayout>{children}</AdminClientLayout>;
}
