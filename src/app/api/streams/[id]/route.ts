import { NextRequest, NextResponse } from 'next/server';
import { ensureStream, stopStream, StreamError } from '@/lib/streamManager';
import { streamLogger } from '@/lib/logger';

function jsonNoStore<T>(data: T, init?: ResponseInit) {
  const response = NextResponse.json(data, init);
  response.headers.set('Cache-Control', 'no-store, max-age=0');
  return response;
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

    const result = await ensureStream(cameraId);

    return jsonNoStore({
      url: result.playlistUrl,
      status: result.alreadyRunning ? 'active' : 'started',
      cameraId,
      rtspUrl: result.sanitizedRtspUrl,
    });
  } catch (error) {
    if (error instanceof StreamError) {
      streamLogger.warn(`Erro de stream (${params.id}): ${error.message}`);
      return jsonNoStore({ error: error.message }, { status: error.statusCode });
    }

    streamLogger.error(`Erro inesperado ao iniciar stream ${params.id}: ${String(error)}`);
    return jsonNoStore({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const cameraId = Number(params.id);
    if (!Number.isFinite(cameraId) || cameraId <= 0) {
      return jsonNoStore({ error: 'Identificador de câmera inválido' }, { status: 400 });
    }

    const stopped = stopStream(cameraId, 'manual');
    if (!stopped) {
      return jsonNoStore({ error: 'Stream não encontrado' }, { status: 404 });
    }

    return jsonNoStore({ message: `Stream da câmera ${cameraId} finalizado` });
  } catch (error) {
    streamLogger.error(`Erro ao finalizar stream ${params.id}: ${String(error)}`);
    return jsonNoStore({ error: 'Erro interno do servidor' }, { status: 500 });
  }
}