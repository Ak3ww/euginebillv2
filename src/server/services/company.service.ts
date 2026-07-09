import 'server-only'
import { prisma } from '@/server/db/client';

export async function getCompanyName(): Promise<string> {
  try {
    const company = await prisma.company.findFirst({
      select: { name: true }
    });
    return company?.name || 'EugineBill RADIUS';
  } catch (error) {
    console.error('Error fetching company name:', error);
    return 'EugineBill RADIUS';
  }
}

export async function getCompanyInfo() {
  try {
    const company = await prisma.company.findFirst();
    return company || {
      name: 'EugineBill RADIUS',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  } catch (error) {
    console.error('Error fetching company info:', error);
    return {
      name: 'EugineBill RADIUS',
      baseUrl: process.env.NEXT_PUBLIC_APP_URL || '',
    };
  }
}
