import 'server-only';

import fs from 'fs';
import path from 'path';

import logger from '@/lib/logger';

export type CameraType = 'intelbras' | 'tapo' | 'generic';

export interface CameraConfig {
  id: number;
  host: string;
  port: number;
  name: string;
  type: CameraType;
  streamPath: string;
}

export interface CameraCredentials {
  username: string;
  password: string;
}

interface CameraEnvironment {
  cameras: CameraConfig[];
  credentials: CameraCredentials;
  limits: {
    maxConcurrentStreams: number;
    autoStopMs: number;
  };
}

interface ParsedCameraEntry {
  host: string;
  port: number;
  derivedPath?: string;
}

interface ParsedCameraEntryResult {
  parsed: ParsedCameraEntry | null;
  warnings: string[];
}

const DEFAULT_RTSP_PATHS: Record<CameraType, string> = {
  intelbras: '/live/mpeg4',
  tapo: '/stream1',
  generic: '/live',
};

const CAMERA_TYPES: CameraType[] = ['intelbras', 'tapo', 'generic'];

let cachedConfig: CameraEnvironment | null = null;

const STREAMS_DIR = path.join(process.cwd(), 'public', 'streams');

function parseListEnv(value: string | undefined): string[] {
  if (!value) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function coerceCameraType(value: string | undefined): CameraType {
  if (!value) {
    return 'intelbras';
  }

  const normalized = value.toLowerCase();
  if (CAMERA_TYPES.includes(normalized as CameraType)) {
    return normalized as CameraType;
  }

  return 'generic';
}

function ensureStreamsDirectory() {
  if (!fs.existsSync(STREAMS_DIR)) {
    fs.mkdirSync(STREAMS_DIR, { recursive: true });
  }
}

function loadCameraEnvironment(): CameraEnvironment {
  if (cachedConfig) {
    return cachedConfig;
  }

  ensureStreamsDirectory();

  const cameraEntries = parseListEnv(process.env.CAMERAS);
  const cameraNames = parseListEnv(process.env.CAMERA_NAMES);
  const cameraTypes = parseListEnv(process.env.CAMERA_TYPES);
  const cameraPaths = parseListEnv(process.env.CAMERA_PATHS ?? process.env.CAMERA_STREAMS);

  const warnings: string[] = [];
  if (cameraEntries.length !== cameraNames.length && cameraNames.length > 0) {
    warnings.push('Quantidade de CAMERA_NAMES diferente da quantidade de CAMERAS. Valores excedentes serão ignorados.');
  }

  if (cameraEntries.length !== cameraTypes.length && cameraTypes.length > 0) {
    warnings.push('Quantidade de CAMERA_TYPES diferente da quantidade de CAMERAS. Tipos ausentes usarão o padrão por câmera.');
  }

  if (cameraEntries.length !== cameraPaths.length && cameraPaths.length > 0) {
    warnings.push('Quantidade de CAMERA_PATHS diferente da quantidade de CAMERAS. Câmeras sem caminho usarão valores padrão.');
  }

  const seenHosts = new Set<string>();

  const cameras: CameraConfig[] = cameraEntries
    .map((entry, index) => {
      const { parsed, warnings: entryWarnings } = parseCameraEntry(entry);
      warnings.push(...entryWarnings);

      if (!parsed) {
        warnings.push(`Entrada de câmera inválida "${entry}" ignorada.`);
        return null;
      }

      const dedupeKey = `${parsed.host}:${parsed.port}`;
      if (seenHosts.has(dedupeKey)) {
        warnings.push(`Câmera duplicada detectada para ${dedupeKey}. A entrada posterior será ignorada.`);
        return null;
      }
      seenHosts.add(dedupeKey);

      const name = cameraNames[index] || `Câmera ${index + 1}`;
      const type = coerceCameraType(cameraTypes[index]);
      const rawPath = cameraPaths[index] || parsed.derivedPath;
      const streamPath = rawPath ? normaliseRtspPath(rawPath) : DEFAULT_RTSP_PATHS[type] || '/live';

      return {
        id: index + 1,
        host: parsed.host,
        port: parsed.port,
        name,
        type,
        streamPath,
      } satisfies CameraConfig;
    })
    .filter((camera): camera is CameraConfig => Boolean(camera));

  if (cameraEntries.length === 0) {
    warnings.push('Nenhuma câmera configurada. Defina a variável de ambiente CAMERAS para disponibilizar streams.');
  }

  const username = process.env.USERNAME?.trim() || 'admin';
  const password = process.env.PASSWORD?.trim() || 'admin';

  const maxConcurrentStreamsEnv = Number(process.env.MAX_CONCURRENT_STREAMS || '6');
  const autoStopMsEnv = Number(process.env.STREAM_AUTO_STOP_MS || String(5 * 60 * 1000));

  const maxConcurrentStreams = Number.isFinite(maxConcurrentStreamsEnv) && maxConcurrentStreamsEnv > 0
    ? Math.floor(maxConcurrentStreamsEnv)
    : 6;

  const autoStopMs = Number.isFinite(autoStopMsEnv) && autoStopMsEnv >= 60_000
    ? Math.floor(autoStopMsEnv)
    : 5 * 60 * 1000;

  cachedConfig = {
    cameras,
    credentials: {
      username,
      password,
    },
    limits: {
      maxConcurrentStreams,
      autoStopMs,
    },
  };

  if (warnings.length > 0) {
    warnings.forEach((warning) => {
      logger.warn(`[camera-config] ${warning}`);
    });
  }

  return cachedConfig;
}

function parseCameraEntry(entry: string): ParsedCameraEntryResult {
  const warnings: string[] = [];
  const trimmed = entry?.trim();

  if (!trimmed) {
    return { parsed: null, warnings };
  }

  const sanitizeHost = (hostValue: string) => hostValue.replace(/^\[|\]$/g, '').trim();

  if (trimmed.includes('://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname) {
        warnings.push(`Entrada sem host definido: ${trimmed}`);
        return { parsed: null, warnings };
      }

      const portValue = url.port ? Number(url.port) : 554;
      if (!Number.isFinite(portValue) || portValue <= 0) {
        warnings.push(`Porta inválida detectada em ${trimmed}. Será utilizado o valor padrão 554.`);
      }

      const pathWithQuery = `${url.pathname}${url.search ?? ''}`;
      const derivedPath = pathWithQuery && pathWithQuery !== '/' ? normaliseRtspPath(pathWithQuery) : undefined;

      return {
        parsed: {
          host: sanitizeHost(url.hostname),
          port: Number.isFinite(portValue) && portValue > 0 ? Math.floor(portValue) : 554,
          derivedPath,
        },
        warnings,
      };
    } catch {
      warnings.push(`Não foi possível interpretar a entrada de câmera ${trimmed}.`);
      return { parsed: null, warnings };
    }
  }

  const hostPortMatch = trimmed.match(/^(?<host>\[[^\]]+\]|[^:]+)(?::(?<port>\d+))?$/);
  const hostValue = hostPortMatch?.groups?.host;

  if (!hostValue) {
    return { parsed: null, warnings };
  }

  const portValue = hostPortMatch?.groups?.port ? Number(hostPortMatch.groups.port) : 554;
  if (!Number.isFinite(portValue) || portValue <= 0) {
    warnings.push(`Porta inválida detectada em ${trimmed}. Será utilizado o valor padrão 554.`);
  }

  return {
    parsed: {
      host: sanitizeHost(hostValue),
      port: Number.isFinite(portValue) && portValue > 0 ? Math.floor(portValue) : 554,
    },
    warnings,
  };
}

function normaliseRtspPath(pathValue: string): string {
  if (!pathValue) {
    return '/live';
  }

  const trimmed = pathValue.trim();
  if (!trimmed) {
    return '/live';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function invalidateCameraEnvironmentCache() {
  cachedConfig = null;
}

export function getCameraConfigs(): CameraConfig[] {
  return loadCameraEnvironment().cameras;
}

export function getCameraById(id: number): CameraConfig | undefined {
  return getCameraConfigs().find((camera) => camera.id === id);
}

export function getCameraCredentials(): CameraCredentials {
  return loadCameraEnvironment().credentials;
}

export function getStreamLimits() {
  return loadCameraEnvironment().limits;
}

export function buildRtspUrl(camera: CameraConfig, credentials = getCameraCredentials()): string {
  const { username, password } = credentials;
  return `rtsp://${encodeURIComponent(username)}:${encodeURIComponent(password)}@${camera.host}:${camera.port}${camera.streamPath}`;
}

export function maskCredentials(rtspUrl: string): string {
  if (!rtspUrl.includes('@')) {
    return rtspUrl;
  }

  const [protocolAndCredentials, hostPart] = rtspUrl.split('@');
  const [protocol] = protocolAndCredentials.split('://');
  return `${protocol}://***:***@${hostPart}`;
}

export function getStreamsDirectoryPath() {
  ensureStreamsDirectory();
  return STREAMS_DIR;
}

