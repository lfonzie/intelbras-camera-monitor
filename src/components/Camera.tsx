'use client';

import { useRef, useEffect, useState } from 'react';
import Hls from 'hls.js';

interface CameraProps {
  id: number;
  streamUrl?: string;
  onRecord: (id: number) => void;
  onError?: (id: number, error: string) => void;
  isVisible?: boolean;
  onVisibilityChange?: (id: number, visible: boolean) => void;
}

export default function Camera({ id, streamUrl, onRecord, onError, isVisible = true, onVisibilityChange }: CameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'playing' | 'error' | 'disconnected'>('loading');
  const [isRecording, setIsRecording] = useState(false);
  const [lastError, setLastError] = useState<string>('');
  const [hlsInstance, setHlsInstance] = useState<Hls | null>(null);

  // Intersection Observer desabilitado temporariamente para evitar loops
  // useEffect(() => {
  //   const container = containerRef.current;
  //   if (!container) return;

  //   let timeoutId: NodeJS.Timeout;
  //   let lastVisibilityState = false;

  //   const observer = new IntersectionObserver(
  //     (entries) => {
  //       entries.forEach((entry) => {
  //         const visible = entry.isIntersecting;
          
  //         // Debounce para evitar múltiplas chamadas
  //         if (visible !== lastVisibilityState) {
  //           clearTimeout(timeoutId);
  //           timeoutId = setTimeout(() => {
  //             lastVisibilityState = visible;
  //             onVisibilityChange?.(id, visible);
  //           }, 300); // 300ms de debounce
  //         }
  //       });
  //     },
  //     {
  //       threshold: 0.5, // Trigger when 50% of the element is visible
  //       rootMargin: '0px' // Sem margem para evitar chamadas prematuras
  //     }
  //   );

  //   observer.observe(container);

  //   return () => {
  //     clearTimeout(timeoutId);
  //     observer.disconnect();
  //   };
  // }, [id, onVisibilityChange]);

  // Carregar stream quando streamUrl estiver disponível
  useEffect(() => {
    const video = videoRef.current;
    if (!streamUrl || !video) {
      setStatus('disconnected');
      return;
    }

    // Carregar stream imediatamente quando disponível
    if (streamUrl && !hlsInstance) {
      loadStream();
    }
  }, [streamUrl]);

  const loadStream = () => {
    const video = videoRef.current;
    if (!streamUrl || !video) return;

    let hls: Hls | null = null;
    let retryCount = 0;
    const maxRetries = 3;
    let retryTimeout: NodeJS.Timeout;

    const setupHls = () => {
      if (Hls.isSupported()) {
        hls = new Hls({
          maxBufferLength: 20, // Buffer reduzido para menor latência
          maxMaxBufferLength: 40, // Buffer máximo reduzido
          liveSyncDurationCount: 1, // Menos segmentos para sincronia mais rápida
          liveMaxLatencyDurationCount: 2, // Latência máxima reduzida
          enableWorker: true,
          lowLatencyMode: true, // Habilitado para menor latência
          startLevel: -1, // Auto-select quality
          capLevelToPlayerSize: true,
          debug: false,
          maxBufferSize: 30 * 1000 * 1000, // 30MB buffer reduzido
          maxBufferHole: 0.1, // Tolerância reduzida para buracos no buffer
          highBufferWatchdogPeriod: 1, // Verificação mais frequente
          nudgeOffset: 0.05, // Offset reduzido para sincronização
          nudgeMaxRetry: 5, // Mais tentativas de sincronização
          maxFragLookUpTolerance: 0.1, // Tolerância reduzida para busca de fragmentos
          liveDurationInfinity: true, // Duração infinita para streams ao vivo
          liveBackBufferLength: 0, // Sem buffer de backup para streams ao vivo
          maxLoadingDelay: 4, // Delay máximo de carregamento
          maxBufferStarvationDelay: 0.5, // Delay máximo de fome de buffer
          maxSeekHole: 0.5, // Tamanho máximo de buraco de seek
          seekHoleNudgeDuration: 0.01, // Duração de nudge para buracos
          seekHoleNudgeOffset: 0.1, // Offset de nudge para buracos
          nudgeOffset: 0.1, // Offset para sincronização
          nudgeMaxRetry: 3, // Tentativas de sincronização
          maxFragLookUpTolerance: 0.25, // Tolerância para busca de fragmentos
          liveDurationInfinity: true, // Duração infinita para streams ao vivo
          liveBackBufferLength: 0, // Sem buffer de backup para streams ao vivo
        });

        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        setHlsInstance(hls);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log(`Manifesto carregado com sucesso para câmera ${id}`);
          setStatus('playing');
          setLastError('');
          retryCount = 0; // Reset retry count on success
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error(`Erro HLS na câmera ${id}:`, data);
          
          // Handle specific buffer errors
          if (data.details === 'bufferAppendError' || data.details === 'bufferStalledError') {
            console.warn(`Erro de buffer na câmera ${id}, tentando recuperar...`);
            try {
              // Try to recover from buffer errors
              if (hls) {
                hls.startLoad();
              }
            } catch (e) {
              console.error(`Falha na recuperação do buffer para câmera ${id}:`, e);
            }
            return; // Don't treat as fatal
          }
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log(`Erro de rede na câmera ${id}, tentando reconectar...`);
                if (retryCount < maxRetries) {
                  retryCount++;
                  retryTimeout = setTimeout(() => {
                    console.log(`Tentativa ${retryCount} de reconexão para câmera ${id}`);
                    hls?.startLoad();
                  }, 1000 * retryCount); // Delay reduzido
                } else {
                  setStatus('error');
                  setLastError('Erro de conexão - câmera indisponível');
                  onError?.(id, 'Erro de conexão - câmera indisponível');
                }
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log(`Erro de mídia na câmera ${id}, tentando recuperar...`);
                try {
                  hls?.recoverMediaError();
                } catch (e) {
                  setStatus('error');
                  setLastError('Erro de mídia');
                  onError?.(id, 'Erro de mídia');
                }
                break;
              default:
                setStatus('error');
                setLastError(data.details || 'Erro desconhecido');
                onError?.(id, data.details || 'Erro desconhecido');
                break;
            }
          } else {
            // Non-fatal error, just log it
            console.warn(`Erro não fatal na câmera ${id}:`, data);
          }
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          // Only log occasionally to avoid spam
          if (Math.random() < 0.1) {
            console.log(`Fragmento carregado na câmera ${id}`);
          }
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
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      if (hls) {
        hls.destroy();
        setHlsInstance(null);
      }
    };
  };

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (hlsInstance) {
        hlsInstance.destroy();
        setHlsInstance(null);
      }
    };
  }, [hlsInstance]);

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
        return 'Offline';
      default:
        return 'Desconhecido';
    }
  };

  return (
    <div ref={containerRef} className="border rounded-lg shadow-md p-3 bg-white hover:shadow-lg transition-shadow">
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
        
        {status === 'disconnected' && (
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
            onClick={() => window.open(`/camera/${id}`, '_blank')}
            className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
            title="Abrir em nova aba"
          >
            🔗
          </button>
          
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
    </div>
  );
}
