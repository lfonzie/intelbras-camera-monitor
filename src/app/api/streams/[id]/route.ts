import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { streamLogger } from '@/lib/logger';

// Cache para processos FFmpeg ativos
interface StreamProcess {
  ffmpeg: ReturnType<typeof import('child_process').spawn>;
}

const activeStreams = new Map<string, StreamProcess>();

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cameras = process.env.CAMERAS?.split(',') || [];
    const ipPort = cameras[parseInt(id) - 1];
    
    if (!ipPort) {
      streamLogger.error(`Câmera ${id} não encontrada`);
      return NextResponse.json({ error: 'Câmera não encontrada' }, { status: 404 });
    }

    const [ip, port] = ipPort.split(':');
    const username = process.env.USERNAME || 'admin';
    const password = process.env.PASSWORD || 'admin';
    
    // URL RTSP da câmera Intelbras Mibo
    const rtspUrl = `rtsp://${username}:${password}@${ip}:${port}/live/mpeg4`;
    
    // Diretório de saída para streams HLS
    const streamsDir = path.join(process.cwd(), 'public', 'streams');
    if (!fs.existsSync(streamsDir)) {
      fs.mkdirSync(streamsDir, { recursive: true });
    }
    
    const outputPath = path.join(streamsDir, `stream_${id}.m3u8`);
    const hlsUrl = `/streams/stream_${id}.m3u8`;

    // Verificar se já existe um stream ativo para esta câmera
    if (activeStreams.has(id)) {
      streamLogger.info(`Stream já ativo para câmera ${id}`);
      return NextResponse.json({ url: hlsUrl, status: 'active' });
    }

    // Configuração FFmpeg otimizada para baixa latência
    const ffmpegArgs = [
      '-i', rtspUrl,
      '-c:v', 'libx264',           // Codec de vídeo
      '-preset', 'ultrafast',      // Preset para baixa latência
      '-tune', 'zerolatency',      // Otimização para streaming ao vivo
      '-c:a', 'aac',               // Codec de áudio
      '-f', 'hls',                 // Formato de saída HLS
      '-hls_time', '2',            // Duração de cada segmento (2 segundos)
      '-hls_list_size', '3',       // Manter apenas 3 segmentos na playlist
      '-hls_flags', 'delete_segments', // Deletar segmentos antigos
      '-hls_segment_filename', path.join(streamsDir, `stream_${id}_%03d.ts`),
      '-y',                        // Sobrescrever arquivos existentes
      outputPath
    ];

    streamLogger.info(`Iniciando FFmpeg para câmera ${id} com URL: ${rtspUrl}`);

    const ffmpeg = spawn('ffmpeg', ffmpegArgs);

    // Armazenar referência do processo
    activeStreams.set(id, { ffmpeg });

    ffmpeg.on('error', (err) => {
      streamLogger.error(`FFmpeg erro na câmera ${id}: ${err.message}`);
      activeStreams.delete(id);
    });

    ffmpeg.on('close', (code) => {
      streamLogger.info(`FFmpeg finalizado para câmera ${id} com código ${code}`);
      activeStreams.delete(id);
    });

    ffmpeg.on('spawn', () => {
      streamLogger.info(`FFmpeg iniciado com sucesso para câmera ${id}`);
    });

    // Aguardar um pouco para garantir que o processo iniciou
    await new Promise(resolve => setTimeout(resolve, 1000));

    return NextResponse.json({ 
      url: hlsUrl, 
      status: 'started',
      cameraId: id,
      rtspUrl: rtspUrl.replace(password, '***') // Ocultar senha no log
    });

  } catch (error) {
    streamLogger.error(`Erro ao iniciar stream: ${error}`);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    if (activeStreams.has(id)) {
      const stream = activeStreams.get(id);
      if (stream) {
        stream.ffmpeg.kill('SIGTERM');
        activeStreams.delete(id);
      }
      
      streamLogger.info(`Stream da câmera ${id} finalizado`);
      
      // Limpar arquivos HLS
      const streamsDir = path.join(process.cwd(), 'public', 'streams');
      const files = [`stream_${id}.m3u8`];
      
      // Adicionar arquivos de segmento
      for (let i = 0; i < 10; i++) {
        files.push(`stream_${id}_${i.toString().padStart(3, '0')}.ts`);
      }
      
      files.forEach(file => {
        const filePath = path.join(streamsDir, file);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      });
      
      return NextResponse.json({ message: `Stream da câmera ${id} finalizado` });
    }
    
    return NextResponse.json({ error: 'Stream não encontrado' }, { status: 404 });
  } catch (error) {
    streamLogger.error(`Erro ao finalizar stream: ${error}`);
    return NextResponse.json(
      { error: 'Erro interno do servidor' }, 
      { status: 500 }
    );
  }
}