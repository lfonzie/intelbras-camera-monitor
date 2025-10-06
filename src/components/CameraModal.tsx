'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';

interface CameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  cameraId: number;
  cameraName: string;
}

export default function CameraModal({ isOpen, onClose, cameraId, cameraName }: CameraModalProps) {
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    if (isOpen && cameraId) {
      loadCameraStream();
    }
    
    return () => {
      // Limpar HLS quando o modal fechar
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, cameraId]);
  
  // Configurar HLS quando a URL do stream mudar
  useEffect(() => {
    if (streamUrl && videoRef.current) {
      if (Hls.isSupported()) {
        // Limpar instância anterior se existir
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }
        
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90
        });
        
        hls.loadSource(streamUrl);
        hls.attachMedia(videoRef.current);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest carregado com sucesso');
          videoRef.current?.play().catch(e => console.error('Erro ao iniciar reprodução:', e));
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('Erro HLS:', data);
          if (data.fatal) {
            switch(data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.error('Erro de rede fatal, tentando recuperar...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.error('Erro de mídia fatal, tentando recuperar...');
                hls.recoverMediaError();
                break;
              default:
                console.error('Erro fatal irrecuperável');
                setError('Erro ao reproduzir o stream - verifique se a câmera está online');
                hls.destroy();
                break;
            }
          }
        });
        
        hlsRef.current = hls;
      } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Suporte nativo HLS (Safari)
        videoRef.current.src = streamUrl;
        videoRef.current.play().catch(e => console.error('Erro ao iniciar reprodução:', e));
      } else {
        setError('Seu navegador não suporta reprodução HLS');
      }
    }
  }, [streamUrl]);

  const loadCameraStream = async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(`/api/streams/${cameraId}`, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' },
        validateStatus: (status) => status === 200 || status === 503 // Aceitar 503 como resposta válida
      });

      if (response.status === 200 && response.data.url) {
        setStreamUrl(response.data.url);
      } else {
        // Câmera offline (status 503 ou sem URL)
        setError('Câmera offline ou não acessível');
        setStreamUrl(''); // Limpar URL para evitar tentativas de reprodução
      }
    } catch (error: any) {
      console.error(`Erro ao carregar stream da câmera ${cameraId}:`, error);
      
      if (error.response?.status === 404) {
        setError('Câmera não encontrada na configuração');
      } else {
        setError('Erro ao conectar com a câmera');
      }
      setStreamUrl(''); // Limpar URL em caso de erro
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStreamUrl('');
    setError('');
    setIsFullscreen(false);
    onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClose();
    }
    if (e.key === 'f' || e.key === 'F') {
      toggleFullscreen();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 ${
        isFullscreen ? 'p-0' : 'p-4'
      }`}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className={`bg-white rounded-lg shadow-xl ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-6xl max-h-[90vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <h2 className="text-lg font-semibold text-gray-900">
              📹 {cameraName}
            </h2>
            <span className="text-sm text-gray-500">ID: {cameraId}</span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={toggleFullscreen}
              className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              title="Alternar tela cheia (F)"
            >
              {isFullscreen ? '⤓' : '⤢'}
            </button>
            <button
              onClick={handleClose}
              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              title="Fechar (ESC)"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className={`${isFullscreen ? 'h-[calc(100vh-60px)]' : 'h-96'} relative`}>
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">Carregando stream da câmera...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
              <div className="text-center">
                <div className="text-red-500 text-4xl mb-4">⚠️</div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Erro</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={loadCameraStream}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Tentar Novamente
                </button>
              </div>
            </div>
          )}

          {streamUrl && !loading && !error && (
            <div className="w-full h-full relative">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                controls
                muted
                playsInline
              />
              
              {/* Overlay com informações */}
              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                <div>Stream: {streamUrl.split('/').pop()}</div>
                <div>Status: Online</div>
              </div>

              {/* Controles flutuantes */}
              <div className="absolute bottom-4 right-4 flex space-x-2">
                <button
                  onClick={loadCameraStream}
                  className="px-3 py-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70 transition-colors"
                  title="Recarregar stream"
                >
                  🔄
                </button>
                <button
                  onClick={() => window.open(`http://localhost:8000/camera/${cameraId}`, '_blank')}
                  className="px-3 py-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70 transition-colors"
                  title="Abrir em nova aba"
                >
                  🔗
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span>Pressione ESC para fechar</span>
              {!isFullscreen && <span className="ml-4">Pressione F para tela cheia</span>}
            </div>
            <div>
              <a
                href={`http://localhost:8000/camera/${cameraId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Abrir em nova aba
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
