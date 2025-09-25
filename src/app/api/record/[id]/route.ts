import { NextRequest, NextResponse } from 'next/server';
import { recordingLogger } from '@/lib/logger';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// Cache para gravações ativas
interface RecordingProcess {
  ffmpeg: ReturnType<typeof import('child_process').spawn>;
  outputFile: string;
  startTime: Date;
}

const activeRecordings = new Map<string, RecordingProcess>();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { action, duration } = await request.json();
    
    if (action === 'start') {
      recordingLogger.info(`Iniciando gravação da câmera ${id}`);
      
      // Verificar se já existe uma gravação ativa
      if (activeRecordings.has(id)) {
        return NextResponse.json({ 
          error: 'Gravação já em andamento para esta câmera' 
        }, { status: 400 });
      }

      // Configurar caminhos para gravação
      const recordingsDir = path.join(process.cwd(), 'public', 'recordings');
      if (!fs.existsSync(recordingsDir)) {
        fs.mkdirSync(recordingsDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFile = path.join(recordingsDir, `camera_${id}_${timestamp}.mp4`);
      
      // Obter configuração da câmera
      const cameras = process.env.CAMERAS?.split(',') || [];
      const ipPort = cameras[parseInt(id) - 1];
      
      if (!ipPort) {
        recordingLogger.error(`Câmera ${id} não encontrada para gravação`);
        return NextResponse.json({ error: 'Câmera não encontrada' }, { status: 404 });
      }

      const [ip, port] = ipPort.split(':');
      const username = process.env.USERNAME || 'admin';
      const password = process.env.PASSWORD || 'admin';
      const rtspUrl = `rtsp://${username}:${password}@${ip}:${port}/live/mpeg4`;

      // Configuração FFmpeg para gravação
      const ffmpegArgs = [
        '-i', rtspUrl,
        '-c:v', 'libx264',           // Codec de vídeo
        '-preset', 'medium',         // Preset balanceado para gravação
        '-c:a', 'aac',               // Codec de áudio
        '-f', 'mp4',                 // Formato de saída MP4
        '-movflags', '+faststart',    // Otimização para web
        '-y',                        // Sobrescrever arquivos existentes
        outputFile
      ];

      // Se especificada duração, adicionar limite de tempo
      if (duration && duration > 0) {
        ffmpegArgs.splice(-2, 0, '-t', duration.toString());
      }

      recordingLogger.info(`Iniciando gravação FFmpeg para câmera ${id}: ${outputFile}`);

      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      // Armazenar referência do processo
      activeRecordings.set(id, { ffmpeg, outputFile, startTime: new Date() });

      ffmpeg.on('error', (err) => {
        recordingLogger.error(`FFmpeg erro na gravação da câmera ${id}: ${err.message}`);
        activeRecordings.delete(id);
      });

      ffmpeg.on('close', (code) => {
        recordingLogger.info(`Gravação FFmpeg finalizada para câmera ${id} com código ${code}`);
        activeRecordings.delete(id);
      });

      ffmpeg.on('spawn', () => {
        recordingLogger.info(`Gravação FFmpeg iniciada com sucesso para câmera ${id}`);
      });

      const recordingId = `rec_${id}_${Date.now()}`;
      
      return NextResponse.json({ 
        message: `Gravação iniciada para câmera ${id}`,
        recordingId,
        startTime: new Date().toISOString(),
        outputFile: `/recordings/camera_${id}_${timestamp}.mp4`
      });
    }
    
    if (action === 'stop') {
      recordingLogger.info(`Parando gravação da câmera ${id}`);
      
      if (!activeRecordings.has(id)) {
        return NextResponse.json({ 
          error: 'Nenhuma gravação ativa encontrada para esta câmera' 
        }, { status: 404 });
      }

      const recording = activeRecordings.get(id);
      if (recording) {
        recording.ffmpeg.kill('SIGTERM');
        activeRecordings.delete(id);
      }
      
      return NextResponse.json({ 
        message: `Gravação finalizada para câmera ${id}`,
        endTime: new Date().toISOString(),
        outputFile: recording?.outputFile
      });
    }
    
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    
  } catch (error) {
    recordingLogger.error(`Erro na gravação: ${error}`);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verificar se há gravação ativa
    const isRecording = activeRecordings.has(id);
    const recording = isRecording ? activeRecordings.get(id) : null;
    
    // Listar gravações disponíveis
    const recordingsDir = path.join(process.cwd(), 'public', 'recordings');
    let recordings: string[] = [];
    
    if (fs.existsSync(recordingsDir)) {
      const files = fs.readdirSync(recordingsDir);
      recordings = files
        .filter(file => file.startsWith(`camera_${id}_`))
        .map(file => `/recordings/${file}`)
        .sort()
        .reverse(); // Mais recentes primeiro
    }
    
    return NextResponse.json({ 
      cameraId: id,
      isRecording,
      startTime: recording?.startTime,
      outputFile: recording?.outputFile,
      recordings
    });
    
  } catch (error) {
    recordingLogger.error(`Erro ao obter status da gravação: ${error}`);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}