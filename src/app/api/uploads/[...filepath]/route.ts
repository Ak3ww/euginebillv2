import { NextRequest } from 'next/server';
import { GET as serveUpload } from '@/app/uploads/[...filepath]/route';

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ filepath: string[] }> }
) {
  return serveUpload(request, props);
}
