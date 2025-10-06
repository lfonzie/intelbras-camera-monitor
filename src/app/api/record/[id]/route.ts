import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

import { recordingLogger } from '@/lib/logger';
import { buildRtspUrl, getCameraById, maskCredentials } from '@/lib/cameraConfig';
import { resolveFfmpegBinary } from '@/lib/streamManager';

function jsonNoStore<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
}

interface RecordingProcess {
  ffmpeg: ReturnType<typeof spawn>;
  outputFile: string;
  startTime: Date;
}

const activeRecordings = new Map<number, RecordingProcess>();

function ensureRecordingsDirectory() {
  const recordingsDir = path.join(process.cwd(), 'public', 'recordings');
  if (!fs.existsSync(recordingsDir)) {
    fs.mkdirSync(recordingsDir, { recursive: true });
  }
  return recordingsDir;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cameraId = Number(params.id);
    if (!Number.isFinite(cameraId) || cameraId <= 0) {
      return jsonNoStore({ error: 'Identificador de câmera inválido' }, { status: 400 });
    }

    const { action, duration } = await request.json();

    if (action === 'start') {
      if (activeRecordings.has(cameraId)) {
        return jsonNoStore({
          error: 'Gravação já em andamento para esta câmera',
        }, { status: 400 });
      }

      const camera = getCameraById(cameraId);
      if (!camera) {
        recordingLogger.error(`Câmera ${cameraId} não encontrada para gravação`);
        return jsonNoStore({ error: 'Câmera não encontrada' }, { status: 404 });
      }

      const recordingsDir = ensureRecordingsDirectory();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(recordingsDir, `camera_${cameraId}_${timestamp}.mp4`);

      const rtspUrl = buildRtspUrl(camera);

      const ffmpegArgs = [
        '-rtsp_transport', 'tcp',
        '-i', rtspUrl,
        '-c:v', 'libx264',
        '-preset', 'medium',
        '-c:a', 'aac',
        '-f', 'mp4',
        '-movflags', '+faststart',
        '-y',
        outputFile,
      ];

      if (duration && duration > 0) {
        ffmpegArgs.splice(-2, 0, '-t', duration.toString());
      }

      recordingLogger.info(`Iniciando gravação FFmpeg para câmera ${cameraId}: ${outputFile}`, {
        camera: camera.name,
        rtspUrl: maskCredentials(rtspUrl),
      });

      const ffmpegBinary = resolveFfmpegBinary();
      const ffmpeg = spawn(ffmpegBinary, ffmpegArgs, {
        stdio: ['ignore', 'ignore', 'pipe'],
        windowsHide: true,
      });
      activeRecordings.set(cameraId, { ffmpeg, outputFile, startTime: new Date() });

      try {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            recordingLogger.warn(`Tempo limite ao aguardar inicialização da gravação para a câmera ${cameraId}`);
            resolve();
          }, 4000);

          ffmpeg.once('spawn', () => {
            clearTimeout(timeout);
            recordingLogger.info(`Gravação FFmpeg iniciada com sucesso para câmera ${cameraId}`);
            resolve();
          });

          ffmpeg.once('error', (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });
      } catch (error) {
        recordingLogger.error(`Falha ao inicializar gravação para a câmera ${cameraId}: ${String(error)}`);
        activeRecordings.delete(cameraId);
        return jsonNoStore({
          error: 'Não foi possível iniciar a gravação para a câmera informada',
        }, { status: 500 });
      }

      ffmpeg.on('error', (err) => {
        recordingLogger.error(`FFmpeg erro na gravação da câmera ${cameraId}: ${err.message}`);
        activeRecordings.delete(cameraId);
      });

      ffmpeg.on('close', (code, signal) => {
        recordingLogger.info(`Gravação FFmpeg finalizada para câmera ${cameraId}`, { code, signal });
        activeRecordings.delete(cameraId);
      });
      if (ffmpeg.stderr) {
        ffmpeg.stderr.setEncoding('utf-8');
        ffmpeg.stderr.on('data', (chunk: string) => {
          if (chunk.toLowerCase().includes('error')) {
            recordingLogger.warn(`FFmpeg stderr (gravação ${cameraId}): ${chunk.trim()}`);
          }
        });
      }

      const recordingId = `rec_${cameraId}_${Date.now()}`;

      return jsonNoStore({
        message: `Gravação iniciada para câmera ${cameraId}`,
        recordingId,
        startTime: new Date().toISOString(),
        outputFile: `/recordings/camera_${cameraId}_${timestamp}.mp4`,
      });
    }

    if (action === 'stop') {
      const recording = activeRecordings.get(cameraId);
      if (!recording) {
        return jsonNoStore({
          error: 'Nenhuma gravação ativa encontrada para esta câmera',
        }, { status: 404 });
      }

      recording.ffmpeg.kill('SIGTERM');
      activeRecordings.delete(cameraId);

      return jsonNoStore({
        message: `Gravação finalizada para câmera ${cameraId}`,
        endTime: new Date().toISOString(),
        outputFile: recording.outputFile,
      });
    }

    return jsonNoStore({ error: 'Ação inválida' }, { status: 400 });
  } catch (error) {
    recordingLogger.error(`Erro na gravação da câmera ${params.id}: ${String(error)}`);
    return jsonNoStore({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cameraId = Number(params.id);
    if (!Number.isFinite(cameraId) || cameraId <= 0) {
      return jsonNoStore({ error: 'Identificador de câmera inválido' }, { status: 400 });
    }

    const isRecording = activeRecordings.has(cameraId);
    const recording = isRecording ? activeRecordings.get(cameraId) : null;

    const recordingsDir = ensureRecordingsDirectory();
    const files = fs.readdirSync(recordingsDir, { withFileTypes: true });

    const recordings = files
      .filter((entry) => entry.isFile() && entry.name.startsWith(`camera_${cameraId}_`))
      .map((entry) => `/recordings/${entry.name}`)
      .sort()
      .reverse();

    return jsonNoStore({
      cameraId,
      isRecording,
      startTime: recording?.startTime,
      outputFile: recording?.outputFile,
      recordings,
    });
  } catch (error) {
    recordingLogger.error(`Erro ao obter status da gravação ${params.id}: ${String(error)}`);
    return jsonNoStore({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}
