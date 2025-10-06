'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

import Camera from '@/components/Camera';

interface CameraMetadata {
  id: number;
  name: string;
  type: string;
}

interface CamerasApiResponse {
  cameras: CameraMetadata[];
  limits?: {
    maxConcurrentStreams?: number;
  };
}

interface OptimizationResponse {
  success: boolean;
  optimizations: {
    cleanedStreams: number;
    removedFiles: number;
    active: {
      active: number;
      cameras: number[];
    };
  };
}

export default function OptimizedCameraGrid() {
  const { data: session, status } = useSession();
  const [availableCameras, setAvailableCameras] = useState<CameraMetadata[]>([]);
  const [streams, setStreams] = useState<Record<number, string>>({});
  const [activeCameras, setActiveCameras] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [optimizedMessage, setOptimizedMessage] = useState<string>('');
  const [maxConcurrent, setMaxConcurrent] = useState(2);
  const activeCamerasRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const loadMetadata = async () => {
      try {
        setLoading(true);
        const response = await axios.get<CamerasApiResponse>('/api/cameras');
        if (cancelled) return;

        const cameras = (response.data?.cameras ?? []).slice(0, 4);

        setAvailableCameras(cameras);
        if (response.data?.limits?.maxConcurrentStreams) {
          setMaxConcurrent(Math.max(1, Number(response.data.limits.maxConcurrentStreams)));
        }
      } catch {
        if (!cancelled) {
          setError('Erro ao carregar configuração das câmeras');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadMetadata();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const optimizeSystem = useCallback(async () => {
    try {
      const response = await axios.post<OptimizationResponse>('/api/cameras/optimize');
      if (response.data?.success) {
        setOptimizedMessage(`Streams encerrados: ${response.data.optimizations.cleanedStreams} • Arquivos removidos: ${response.data.optimizations.removedFiles}`);
        setError('');
      }
    } catch {
      setError('Erro ao otimizar sistema');
    }
  }, []);

  const loadCameraStream = useCallback(async (cameraId: number) => {
    if (activeCamerasRef.current.size >= maxConcurrent && !activeCamerasRef.current.has(cameraId)) {
      setError(`Limite de ${maxConcurrent} streams simultâneos atingido.`);
      return;
    }

    try {
      setError('');
      const response = await axios.get(`/api/streams/${cameraId}`, {
        timeout: 15000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.data?.url) {
        setStreams((prev) => ({ ...prev, [cameraId]: response.data.url }));
        setActiveCameras((prev) => {
          const next = new Set(prev);
          next.add(cameraId);
          return next;
        });
      }
    } catch {
      setError(`Erro ao carregar câmera ${cameraId}`);
    }
  }, [maxConcurrent]);

  const stopCameraStream = useCallback(async (cameraId: number) => {
    try {
      await axios.delete(`/api/streams/${cameraId}`);
    } catch {
      // ignore
    } finally {
      setStreams((prev) => {
        const next = { ...prev };
        delete next[cameraId];
        return next;
      });
      setActiveCameras((prev) => {
        const next = new Set(prev);
        next.delete(cameraId);
        return next;
      });
    }
  }, []);

  const stopAllStreams = useCallback(async () => {
    const ids = Array.from(activeCamerasRef.current);
    await Promise.all(ids.map((id) => axios.delete(`/api/streams/${id}`).catch(() => undefined)));
    setStreams({});
    setActiveCameras(new Set());
  }, []);

  useEffect(() => {
    activeCamerasRef.current = activeCameras;
  }, [activeCameras]);

  useEffect(() => {
    return () => {
      activeCamerasRef.current.forEach((id) => {
        axios.delete(`/api/streams/${id}`).catch(() => undefined);
      });
    };
  }, []);

  const gridCameras = useMemo(() => availableCameras.slice(0, maxConcurrent), [availableCameras, maxConcurrent]);

  if (status === 'loading' || loading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando sistema de câmeras...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">Acesso Negado</h2>
          <p className="text-gray-600">Faça login para acessar as câmeras.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🎥 Sistema de Câmeras Otimizado
        </h1>
        <p className="text-gray-600">
          Visualização otimizada para melhor performance
        </p>
      </div>

      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Status do Sistema</h3>
            <p className="text-sm text-gray-600">
              {activeCameras.size} de {maxConcurrent} câmeras ativas
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={async () => {
                for (const camera of gridCameras) {
                  await loadCameraStream(camera.id);
                  await new Promise((resolve) => setTimeout(resolve, 1000));
                }
              }}
              disabled={activeCameras.size >= maxConcurrent}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ▶️ Iniciar Câmeras
            </button>
            <button
              onClick={stopAllStreams}
              disabled={activeCameras.size === 0}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ⏹️ Parar Todas
            </button>
            <button
              onClick={optimizeSystem}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
            >
              🔧 Otimizar
            </button>
          </div>
        </div>

        {optimizedMessage && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            {optimizedMessage}
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {gridCameras.map((camera) => {
          const isActive = activeCameras.has(camera.id);
          return (
            <div key={camera.id} className="relative">
              <div className="bg-white rounded-lg shadow-lg overflow-hidden">
                <div className="p-4 bg-gray-800 text-white flex items-center justify-between">
                  <h3 className="font-semibold">{camera.name}</h3>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded ${isActive ? 'bg-green-600' : 'bg-gray-600'}`}>
                      {isActive ? 'ATIVA' : 'INATIVA'}
                    </span>
                    <button
                      onClick={() => (isActive ? stopCameraStream(camera.id) : loadCameraStream(camera.id))}
                      className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      {isActive ? '⏹️' : '▶️'}
                    </button>
                  </div>
                </div>

                <div className="aspect-video bg-black">
                  {streams[camera.id] ? (
                    <Camera
                      id={camera.id}
                      name={camera.name}
                      streamUrl={streams[camera.id]}
                      onError={() => setError(`Erro na câmera ${camera.id}`)}
                      onRecord={() => undefined}
                      isVisible
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full text-gray-400">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📹</div>
                        <p>Câmera não carregada</p>
                        <p className="text-sm">Clique em ▶️ para iniciar</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Otimizações Aplicadas:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Máximo de {maxConcurrent} câmeras simultâneas para melhor performance</li>
          <li>• Carregamento sequencial para evitar sobrecarga</li>
          <li>• Limpeza automática de streams inativos</li>
          <li>• Integração com otimização do servidor via API</li>
        </ul>
      </div>
    </div>
  );
}
