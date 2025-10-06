'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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

  const loadCameraStream = useCallback(async () => {
    try {
      setLoading(true);
      setError('');

      const response = await axios.get(`/api/streams/${cameraId}`, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' },
        validateStatus: (status) => status === 200 || status === 503,
      });

      if (response.status === 200 && response.data.url) {
        setStreamUrl(response.data.url);
      } else {
        if (response.status === 503 && response.data?.message) {
          setError(response.data.message);
        } else {
          setError('Câmera offline ou não acessível');
        }
        setStreamUrl('');
      }
    } catch (error: unknown) {
      console.error(`Erro ao carregar stream da câmera ${cameraId}:`, error);

      if (axios.isAxiosError(error) && error.response?.status === 404) {
        setError('Câmera não encontrada na configuração');
      } else if (axios.isAxiosError(error) && error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Erro ao conectar com a câmera');
      }
      setStreamUrl('');
    } finally {
      setLoading(false);
    }
  }, [cameraId]);

  useEffect(() => {
    if (isOpen && cameraId) {
      loadCameraStream();
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isOpen, cameraId, loadCameraStream]);

  useEffect(() => {
    if (!streamUrl || !videoRef.current) {
      return;
    }

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }

      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
      });

      hls.loadSource(streamUrl);
      hls.attachMedia(videoRef.current);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoRef.current?.play().catch((e) => console.error('Erro ao iniciar reprodução:', e));
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setError('Erro ao reproduzir o stream - verifique se a câmera está online');
              hls.destroy();
          }
        }
      });

      hlsRef.current = hls;
    } else if (videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
      videoRef.current.src = streamUrl;
      videoRef.current.play().catch((e) => console.error('Erro ao iniciar reprodução:', e));
    } else {
      setError('Seu navegador não suporta reprodução HLS');
    }
  }, [streamUrl]);

  const handleClose = () => {
    setStreamUrl('');
    setError('');
    setIsFullscreen(false);
    onClose();
  };

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
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

              <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
                <div>Stream: {streamUrl.split('/').pop()}</div>
                <div>Status: Online</div>
              </div>

              <div className="absolute bottom-4 right-4 flex space-x-2">
                <button
                  onClick={loadCameraStream}
                  className="px-3 py-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70 transition-colors"
                  title="Recarregar stream"
                >
                  🔄
                </button>
                <button
                  onClick={() => {
                    const origin = typeof window !== 'undefined' ? window.location.origin : '';
                    window.open(`${origin}/camera/${cameraId}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="px-3 py-2 bg-black bg-opacity-50 text-white rounded hover:bg-opacity-70 transition-colors"
                  title="Abrir em nova aba"
                >
                  🔗
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div>
              <span>Pressione ESC para fechar</span>
              {!isFullscreen && <span className="ml-4">Pressione F para tela cheia</span>}
            </div>
            <div>
              <a
                href={`/camera/${cameraId}`}
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
