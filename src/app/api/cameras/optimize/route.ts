import { NextResponse } from 'next/server';

import { cleanupIdleStreams, cleanupOrphanedStreamFiles, getActiveStreamInfo } from '@/lib/streamManager';

export async function POST() {
  const cleanedStreams = cleanupIdleStreams();
  const removedFiles = cleanupOrphanedStreamFiles();
  const active = getActiveStreamInfo();

  const response = NextResponse.json({
    success: true,
    optimizations: {
      cleanedStreams,
      removedFiles,
      active,
    },
  });

  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}
