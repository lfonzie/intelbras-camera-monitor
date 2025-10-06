import { NextResponse } from 'next/server';

import { getCameraConfigs } from '@/lib/cameraConfig';

export async function GET() {
  const cameras = getCameraConfigs();
  const response = NextResponse.json({ count: cameras.length });
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}
