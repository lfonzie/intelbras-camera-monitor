'use client';

import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';

interface CameraProps {
  id: number;
  streamUrl?: string;
  onRecord: (id: number) => void;
  onError?: (id: number, error: string) => void;
}

export default function Camera({ id, streamUrl, onRecord, onError }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error' | 'disconnected'>('loading');
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string>('');

  useEffect(() => {
    const video = videoRef.current;
    if (!streamUrl || !video) {
      setStatus('disconnected');
      return;
    }

    let hls: Hls | null = null;

    const setupHls = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 15, // Buffer reduzido para baixa latência
          liveSyncDurationCount: 3, // Segmentos para sincronia
          enableWorker: true,
          lowLatencyMode: true,
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          setStatus('playing');
          setLastError('');
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`Erro HLS na câmera ${id}:`, data);
          setStatus('error');
          setLastError(data.details || 'Erro desconhecido');
          onError?.(id, data.details || 'Erro desconhecido');
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          console.warn(`Fragmento carregado na câmera ${id}`);
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Suporte nativo do Safari
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => {
          setStatus('playing');
          setLastError('');
        });
        video.addEventListener('error', () => {
          setStatus('error');
          setLastError('Erro de reprodução');
          onError?.(id, 'Erro de reprodução');
        });
      } else {
        setStatus('error');
        setLastError('HLS não suportado');
        onError?.(id, 'HLS não suportado');
      }
    };

    setupHls();

    return () => {
      if (hls) {
        hls.destroy();
      }
    };
  }, [streamUrl, id, onError]);

  const handleRecord = async () => {
    try {
      setIsRecording(true);
      
      // Chamar API para iniciar gravação
      const response = await fetch(`/api/record/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Gravação iniciada:', data);
        onRecord(id);
      } else {
        console.error('Erro ao iniciar gravação');
      }
    } catch (error) {
      console.error('Erro na gravação:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'playing':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'loading':
        return 'text-yellow-500';
      case 'disconnected':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'playing':
        return 'Ao vivo';
      case 'error':
        return 'Erro';
      case 'loading':
        return 'Conectando';
      case 'disconnected':
        return 'Desconectado';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div className="border rounded-lg shadow-md p-3 bg-white hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">Câmera {id}</h3>
        <div className="flex items-center space-x-2">
          <div className={`w-2 h-2 rounded-full ${status === 'playing' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`}></div>
          <span className={`text-xs font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </span>
        </div>
      </div>
      
      <div className="relative">
        <video
          ref={videoRef}
          width="100%"
          height="200"
          controls
          muted
          autoPlay
          playsInline
          className="rounded-lg bg-gray-100"
          style={{ aspectRatio: '16/9' }}
        />
        
        {status === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}
        
        {status === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">⚠️</div>
              <div className="text-sm">Erro de conexão</div>
              {lastError && <div className="text-xs mt-1">{lastError}</div>}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-3 flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {streamUrl ? 'Stream ativo' : 'Sem stream'}
        </div>
        
        <button
          onClick={handleRecord}
          disabled={status !== 'playing' || isRecording}
          className={`px-3 py-1 text-sm rounded transition-colors ${
            isRecording
              ? 'bg-red-600 text-white'
              : status === 'playing'
              ? 'bg-blue-500 text-white hover:bg-blue-600'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isRecording ? 'Gravando...' : 'Gravar'}
        </button>
      </div>
    </div>
  );
}
