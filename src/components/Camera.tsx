'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';

interface CameraProps {
  id: number;
  name?: string;
  streamUrl?: string;
  onRecord: (id: number) => void;
  onError?: (id: number, error: string) => void;
  isVisible?: boolean;
  statusOverride?: 'idle' | 'loading' | 'online' | 'offline' | 'error';
}

type PlayerStatus = 'idle' | 'loading' | 'playing' | 'error' | 'disconnected';

export default function Camera({
  id,
  name,
  streamUrl,
  onRecord,
  onError,
  isVisible = true,
  statusOverride,
}: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();
  const retryCountRef = useRef(0);

  const [status, setStatus] = useState<PlayerStatus>('idle');
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string>('');

  const destroyHlsInstance = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = undefined;
    }
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      destroyHlsInstance();
    };
  }, []);

  useEffect(() => {
    if (!streamUrl || !isVisible) {
      destroyHlsInstance();
      setStatus(statusOverride === 'loading' ? 'loading' : statusOverride === 'offline' ? 'disconnected' : 'disconnected');
      return;
    }

    const video = videoRef.current;
    if (!video) {
      setStatus('disconnected');
      return;
    }

    setStatus('loading');
    setLastError('');
    retryCountRef.current = 0;

    if (Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: true,
        enableWorker: true,
        backBufferLength: 30,
        maxBufferLength: 10,
        liveSyncDurationCount: 1,
        liveMaxLatencyDurationCount: 3,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setStatus('playing');
        retryCountRef.current = 0;
        video.play().catch(() => undefined);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!hlsRef.current) return;

        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR: {
              if (retryCountRef.current < 3) {
                retryCountRef.current += 1;
                retryTimeoutRef.current = setTimeout(() => {
                  hlsRef.current?.startLoad();
                }, retryCountRef.current * 1000);
              } else {
                setStatus('error');
                setLastError('Erro de rede');
                onError?.(id, 'Erro de rede');
              }
              break;
            }
            case Hls.ErrorTypes.MEDIA_ERROR: {
              try {
                hlsRef.current?.recoverMediaError();
              } catch {
                setStatus('error');
                setLastError('Erro de mídia');
                onError?.(id, 'Erro de mídia');
              }
              break;
            }
            default: {
              setStatus('error');
              setLastError(data.details || 'Erro desconhecido');
              onError?.(id, data.details || 'Erro desconhecido');
            }
          }
        }
      });

      hlsRef.current = hls;
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.addEventListener('loadedmetadata', () => {
        setStatus('playing');
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

    return () => {
      destroyHlsInstance();
    };
  }, [streamUrl, isVisible, id, onError, statusOverride]);

  const handleRecord = async () => {
    try {
      setIsRecording(true);
      const response = await fetch(`/api/record/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      if (response.ok) {
        onRecord(id);
      } else {
        setLastError('Não foi possível iniciar a gravação');
      }
    } catch {
      setLastError('Erro de gravação');
    } finally {
      setIsRecording(false);
    }
  };

  const displayStatus = useMemo<PlayerStatus>(() => {
    if (streamUrl) {
      return status;
    }

    if (statusOverride === 'loading') return 'loading';
    if (statusOverride === 'offline') return 'disconnected';
    if (statusOverride === 'error') return 'error';
    return status;
  }, [status, statusOverride, streamUrl]);

  const getStatusColor = () => {
    switch (displayStatus) {
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
    switch (displayStatus) {
      case 'playing':
        return 'Ao vivo';
      case 'error':
        return 'Erro';
      case 'loading':
        return 'Conectando';
      case 'disconnected':
        return 'Offline';
      default:
        return 'Aguardando';
    }
  };

  const openInNewTab = () => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    window.open(`${origin}/camera/${id}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="border rounded-lg shadow-md p-3 bg-white hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-semibold text-gray-800">{name ?? `Câmera ${id}`}</h3>
        <div className="flex items-center space-x-2">
          <div
            className={`w-2 h-2 rounded-full ${
              displayStatus === 'playing' ? 'bg-green-500' : displayStatus === 'error' ? 'bg-red-500' : 'bg-yellow-500'
            }`}
          ></div>
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

        {displayStatus === 'loading' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          </div>
        )}

        {displayStatus === 'error' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">⚠️</div>
              <div className="text-sm">Erro de conexão</div>
              {lastError && <div className="text-xs mt-1">{lastError}</div>}
            </div>
          </div>
        )}

        {displayStatus === 'disconnected' && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100 rounded-lg">
            <div className="text-center text-gray-500">
              <div className="text-2xl mb-2">📴</div>
              <div className="text-sm">Câmera offline</div>
              <div className="text-xs mt-1">Verifique conectividade</div>
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {streamUrl ? (isVisible ? 'Stream ativo' : 'Stream pausado') : 'Sem stream'}
        </div>

        <div className="flex space-x-2">
          <button
            onClick={openInNewTab}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            title="Abrir em nova aba"
          >
            🔗
          </button>

          <button
            onClick={handleRecord}
            disabled={displayStatus !== 'playing' || isRecording}
            className={`px-3 py-1 text-sm rounded transition-colors ${
              isRecording
                ? 'bg-red-600 text-white'
                : displayStatus === 'playing'
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isRecording ? 'Gravando...' : 'Gravar'}
          </button>
        </div>
      </div>
    </div>
  );
}
