import { NextResponse } from 'next/server';

import { getCameraConfigs, getCameraCredentials, getStreamLimits, maskCredentials, buildRtspUrl } from '@/lib/cameraConfig';

export async function GET() {
  const cameras = getCameraConfigs();
  const credentials = getCameraCredentials();
  const limits = getStreamLimits();

  const data = cameras.map((camera) => ({
    id: camera.id,
    name: camera.name,
    host: camera.host,
    port: camera.port,
    type: camera.type,
    streamPath: camera.streamPath,
    rtspTemplate: maskCredentials(buildRtspUrl(camera, credentials)),
  }));

  const response = NextResponse.json({
    total: cameras.length,
    cameras: data,
    limits,
  });

  response.headers.set('Cache-Control', 'no-store, max-age=0');

  return response;
}
