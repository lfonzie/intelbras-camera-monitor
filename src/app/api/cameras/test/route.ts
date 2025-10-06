import { NextRequest, NextResponse } from 'next/server';
import net from 'net';

import { buildRtspUrl, getCameraCredentials, getCameraConfigs, maskCredentials } from '@/lib/cameraConfig';

function jsonNoStore<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

interface TestRequestBody {
  ip?: string;
  port?: string | number;
  username?: string;
  password?: string;
  path?: string;
  cameraType?: string;
  cameraId?: number;
}

function validateIp(ip: string) {
  const ipv4Regex = /^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
  return ipv4Regex.test(ip);
}

function sanitisePath(path?: string) {
  if (!path) return undefined;
  const trimmed = path.trim();
  if (!trimmed) return undefined;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

async function checkTcpConnectivity(host: string, port: number, timeout = 4000) {
  return new Promise<boolean>((resolve) => {
    const socket = net.createConnection({ host, port }, () => {
      socket.end();
      resolve(true);
    });

    socket.setTimeout(timeout, () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestRequestBody;

    const cameraId = body.cameraId ? Number(body.cameraId) : undefined;
    const manualIp = body.ip?.trim();
    const port = Number(body.port ?? 554);
    const credentials = getCameraCredentials();

    const camera = Number.isFinite(cameraId) && cameraId
      ? getCameraConfigs().find((item) => item.id === cameraId)
      : undefined;

    const ip = manualIp || camera?.host;
    if (!ip || !validateIp(ip)) {
      return jsonNoStore({
        success: false,
        error: 'Endereço IP inválido ou ausente',
      }, { status: 400 });
    }

    if (!Number.isFinite(port) || port <= 0) {
      return jsonNoStore({
        success: false,
        error: 'Porta inválida',
      }, { status: 400 });
    }

    const username = body.username?.trim() || credentials.username;
    const password = body.password?.trim() || credentials.password;
    const streamPath = sanitisePath(body.path) || camera?.streamPath;

    const reachable = await checkTcpConnectivity(ip, port);

    const rtspUrl = camera
      ? buildRtspUrl(camera, { username, password })
      : `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${ip}:${port}${streamPath ?? ''}`;

    return jsonNoStore({
      success: reachable,
      reachable,
      sanitizedRtspUrl: maskCredentials(rtspUrl),
    });
  } catch (error) {
    return jsonNoStore({
      success: false,
      error: 'Erro ao testar conexão com a câmera',
      details: String(error),
    }, { status: 500 });
  }
}
