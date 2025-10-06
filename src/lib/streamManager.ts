import 'server-only';

import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import fs from 'fs';
import path from 'path';

import { streamLogger } from '@/lib/logger';
import {
  buildRtspUrl,
  getCameraById,
  getStreamsDirectoryPath,
  getStreamLimits,
  maskCredentials,
  type CameraConfig,
} from '@/lib/cameraConfig';

interface StreamProcess {
  camera: CameraConfig;
  ffmpeg: ChildProcessWithoutNullStreams;
  playlistPath: string;
  segmentGlob: string;
  startedAt: number;
  lastAccessedAt: number;
  stopTimeout?: NodeJS.Timeout;
}

interface EnsureStreamResult {
  playlistUrl: string;
  sanitizedRtspUrl: string;
  alreadyRunning: boolean;
}

interface PendingStreamStart {
  promise: Promise<EnsureStreamResult>;
  cancel: (reason: StopReason) => void;
}

export class StreamError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'StreamError';
    this.statusCode = statusCode;
  }
}

const activeStreams = new Map<number, StreamProcess>();
const pendingStreamStarts = new Map<number, PendingStreamStart>();

const DEFAULT_WAIT_FOR_PLAYLIST_MS = 4000;
const FILE_CHECK_INTERVAL_MS = 250;
const ORPHANED_FILE_MAX_AGE_MS = 10 * 60 * 1000;

type StopReason = 'manual' | 'timeout' | 'error' | 'shutdown';

let shutdownHooksRegistered = false;

export function resolveFfmpegBinary() {
  return process.env.FFMPEG_BINARY || 'ffmpeg';
}

function createPlaylistPath(cameraId: number) {
  const directory = getStreamsDirectoryPath();
  return path.join(directory, `camera_${cameraId}.m3u8`);
}

function createSegmentPattern(cameraId: number) {
  const directory = getStreamsDirectoryPath();
  return path.join(directory, `camera_${cameraId}_%03d.ts`);
}

function waitForPlaylist(playlistPath: string, timeoutMs: number) {
  const timeoutAt = Date.now() + timeoutMs;

  return new Promise<void>((resolve, reject) => {
    const check = () => {
      if (fs.existsSync(playlistPath)) {
        resolve();
        return;
      }

      if (Date.now() > timeoutAt) {
        reject(new StreamError('Timeout ao gerar playlist HLS', 504));
        return;
      }

      setTimeout(check, FILE_CHECK_INTERVAL_MS);
    };

    check();
  });
}

function scheduleAutoStop(cameraId: number) {
  const stream = activeStreams.get(cameraId);
  if (!stream) return;

  if (stream.stopTimeout) {
    clearTimeout(stream.stopTimeout);
  }

  const { autoStopMs } = getStreamLimits();
  stream.stopTimeout = setTimeout(() => {
    streamLogger.warn(`Encerrando stream ${cameraId} por inatividade`);
    stopStream(cameraId, 'timeout');
  }, autoStopMs).unref();
}

function registerStream(cameraId: number, process: ChildProcessWithoutNullStreams, camera: CameraConfig, playlistPath: string, segmentGlob: string) {
  const record: StreamProcess = {
    camera,
    ffmpeg: process,
    playlistPath,
    segmentGlob,
    startedAt: Date.now(),
    lastAccessedAt: Date.now(),
  };

  activeStreams.set(cameraId, record);
  scheduleAutoStop(cameraId);
}

function handleProcessLifecycle(cameraId: number, ffmpeg: ChildProcessWithoutNullStreams, playlistPath: string) {
  ffmpeg.on('close', (code, signal) => {
    streamLogger.info(`FFmpeg finalizado para câmera ${cameraId}`, { code, signal });
    const record = activeStreams.get(cameraId);
    if (record?.stopTimeout) {
      clearTimeout(record.stopTimeout);
    }
    activeStreams.delete(cameraId);

    if (fs.existsSync(playlistPath)) {
      // Deixar playlist disponível para download posterior - arquivos serão limpos por rotinas de manutenção
      streamLogger.debug(`Playlist ${playlistPath} disponível após encerramento da câmera ${cameraId}`);
    }
  });

  ffmpeg.on('error', (error) => {
    streamLogger.error(`FFmpeg erro crítico na câmera ${cameraId}: ${error.message}`);
    stopStream(cameraId, 'error');
  });

  if (ffmpeg.stderr) {
    ffmpeg.stderr.setEncoding('utf-8');
    ffmpeg.stderr.on('data', (chunk: string) => {
      if (chunk.toLowerCase().includes('error')) {
        streamLogger.warn(`FFmpeg stderr (${cameraId}): ${chunk.trim()}`);
      }
    });
  }
}

export async function ensureStream(cameraId: number): Promise<EnsureStreamResult> {
  const camera = getCameraById(cameraId);
  if (!camera) {
    throw new StreamError('Câmera não encontrada', 404);
  }

  const pending = pendingStreamStarts.get(cameraId);
  if (pending) {
    const result = await pending.promise;
    return {
      ...result,
      alreadyRunning: true,
    };
  }

  const existing = activeStreams.get(cameraId);
  if (existing) {
    existing.lastAccessedAt = Date.now();
    scheduleAutoStop(cameraId);
    return {
      playlistUrl: `/streams/${path.basename(existing.playlistPath)}`,
      sanitizedRtspUrl: maskCredentials(buildRtspUrl(camera)),
      alreadyRunning: true,
    };
  }

  const { maxConcurrentStreams } = getStreamLimits();
  if (activeStreams.size + pendingStreamStarts.size >= maxConcurrentStreams) {
    throw new StreamError('Limite de streams simultâneos atingido', 429);
  }

  const playlistPath = createPlaylistPath(cameraId);
  const segmentPattern = createSegmentPattern(cameraId);
  const rtspUrl = buildRtspUrl(camera);

  const ffmpegArgs = [
    '-rtsp_transport', 'tcp',
    '-i', rtspUrl,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-tune', 'zerolatency',
    '-c:a', 'aac',
    '-f', 'hls',
    '-hls_time', '2',
    '-hls_list_size', '4',
    '-hls_flags', 'delete_segments+program_date_time',
    '-hls_segment_filename', segmentPattern,
    '-max_delay', '500000',
    '-bufsize', '4M',
    '-y',
    playlistPath,
  ];

  const ffmpegBinary = resolveFfmpegBinary();
  streamLogger.info(`Iniciando FFmpeg para câmera ${cameraId}`, {
    camera: camera.name,
    host: camera.host,
    rtspUrl: maskCredentials(rtspUrl),
  });

  const ffmpeg = spawn(ffmpegBinary, ffmpegArgs, {
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  });

  handleProcessLifecycle(cameraId, ffmpeg, playlistPath);

  let rejectStart: ((error: StreamError) => void) | undefined;
  let settled = false;

  const startPromise = new Promise<EnsureStreamResult>((resolve, reject) => {
    rejectStart = (error: StreamError) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };

    ffmpeg.once('error', (error: NodeJS.ErrnoException) => {
      const isMissingBinary = error?.code === 'ENOENT';
      const message = isMissingBinary
        ? 'FFmpeg não encontrado. Verifique a instalação do binário.'
        : `Falha ao iniciar FFmpeg: ${error?.message ?? 'erro desconhecido'}`;
      const statusCode = isMissingBinary ? 503 : 500;

      if (!settled) {
        settled = true;
        reject(new StreamError(message, statusCode));
      }
    });

    ffmpeg.once('spawn', async () => {
      try {
        await waitForPlaylist(playlistPath, DEFAULT_WAIT_FOR_PLAYLIST_MS);
        registerStream(cameraId, ffmpeg, camera, playlistPath, segmentPattern);
        settled = true;
        resolve({
          playlistUrl: `/streams/${path.basename(playlistPath)}`,
          sanitizedRtspUrl: maskCredentials(rtspUrl),
          alreadyRunning: false,
        });
      } catch (error) {
        ffmpeg.kill('SIGTERM');
        settled = true;
        reject(error instanceof StreamError ? error : new StreamError('Não foi possível preparar o stream', 500));
      }
    });
  });

  const trackedPromise = startPromise.finally(() => {
    if (pendingStreamStarts.get(cameraId)?.promise === trackedPromise) {
      pendingStreamStarts.delete(cameraId);
    }
  });

  pendingStreamStarts.set(cameraId, {
    promise: trackedPromise,
    cancel: (reason: StopReason) => {
      streamLogger.info(`Cancelando inicialização do stream da câmera ${cameraId} (${reason})`);
      ffmpeg.kill('SIGTERM');
      if (rejectStart) {
        const message = reason === 'manual'
          ? 'Inicialização do stream cancelada pelo usuário.'
          : `Inicialização do stream cancelada (${reason}).`;
        rejectStart(new StreamError(message, reason === 'manual' ? 499 : 503));
      }
    },
  });

  return trackedPromise;
}

export function stopStream(cameraId: number, reason: StopReason = 'manual') {
  const pending = pendingStreamStarts.get(cameraId);
  if (pending) {
    pendingStreamStarts.delete(cameraId);
    pending.cancel(reason);
    return true;
  }

  const stream = activeStreams.get(cameraId);
  if (!stream) {
    return false;
  }

  streamLogger.info(`Finalizando stream da câmera ${cameraId} (${reason})`);

  if (stream.stopTimeout) {
    clearTimeout(stream.stopTimeout);
  }

  stream.ffmpeg.kill('SIGTERM');
  activeStreams.delete(cameraId);

  return true;
}

export function cleanupIdleStreams() {
  const { autoStopMs } = getStreamLimits();
  const now = Date.now();
  let cleaned = 0;

  for (const [cameraId, stream] of activeStreams.entries()) {
    if (now - stream.lastAccessedAt > autoStopMs) {
      stopStream(cameraId, 'timeout');
      cleaned += 1;
    }
  }

  return cleaned;
}

export function cleanupOrphanedStreamFiles(maxAgeMs = ORPHANED_FILE_MAX_AGE_MS) {
  const directory = getStreamsDirectoryPath();
  const files = fs.readdirSync(directory);
  const now = Date.now();
  let removed = 0;

  files.forEach((file) => {
    if (!file.startsWith('camera_') || (!file.endsWith('.m3u8') && !file.endsWith('.ts'))) {
      return;
    }

    const filePath = path.join(directory, file);
    const stats = fs.statSync(filePath);
    if (now - stats.mtimeMs > maxAgeMs) {
      fs.unlinkSync(filePath);
      removed += 1;
    }
  });

  return removed;
}

export function getActiveStreamInfo() {
  return {
    active: activeStreams.size,
    cameras: Array.from(activeStreams.keys()),
  };
}

export function stopAllStreams(reason: StopReason = 'manual') {
  let stopped = 0;

  for (const cameraId of Array.from(pendingStreamStarts.keys())) {
    if (stopStream(cameraId, reason)) {
      stopped += 1;
    }
  }

  for (const cameraId of Array.from(activeStreams.keys())) {
    if (stopStream(cameraId, reason)) {
      stopped += 1;
    }
  }

  return stopped;
}

function registerShutdownHooks() {
  if (shutdownHooksRegistered) {
    return;
  }

  shutdownHooksRegistered = true;

  const shutdown = (signal: NodeJS.Signals | 'exit') => {
    streamLogger.info('Encerrando streams ativos devido ao encerramento do processo', { signal });
    stopAllStreams('shutdown');
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
  process.once('exit', () => shutdown('exit'));
}

registerShutdownHooks();

