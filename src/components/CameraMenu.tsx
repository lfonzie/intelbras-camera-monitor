'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

interface Camera {
  id: number;
  name: string;
  host: string;
  port: number;
  status: 'online' | 'offline' | 'loading';
  streamUrl?: string;
  type: 'intelbras' | 'tapo' | 'generic';
}

interface CamerasApiResponse {
  cameras: Array<{
    id: number;
    name: string;
    host: string;
    port: number;
    type: 'intelbras' | 'tapo' | 'generic';
  }>;
}

interface CameraMenuProps {
  onCameraSelect: (cameraId: number) => void;
}

export default function CameraMenu({ onCameraSelect }: CameraMenuProps) {
  const { data: session } = useSession();
  const [cameras, setCameras] = useState<Camera[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const camerasPerPage = 10;
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    if (!session) return;

    let cancelled = false;

    const loadCameras = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await axios.get<CamerasApiResponse>('/api/cameras', {
          headers: { 'Cache-Control': 'no-cache' },
        });

        if (cancelled) return;

        const metadata = response.data?.cameras || [];
        const mapped: Camera[] = metadata.map((camera) => ({
          id: camera.id,
          name: camera.name,
          host: camera.host,
          port: camera.port,
          type: camera.type ?? 'intelbras',
          status: 'offline',
        }));

        setCameras(mapped);
        setHasChecked(false);
      } catch {
        if (!cancelled) {
          setError('Erro ao carregar lista de câmeras');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadCameras();

    return () => {
      cancelled = true;
    };
  }, [session]);

  useEffect(() => {
    if (!session || cameras.length === 0 || hasChecked) return;

    let cancelled = false;

    const checkInBatches = async () => {
      const batchSize = 5;
      for (let i = 0; i < cameras.length; i += batchSize) {
        const batch = cameras.slice(i, i + batchSize);
        const promises = batch.map(async (camera) => {
          try {
            const response = await axios.get(`/api/streams/${camera.id}`, {
              timeout: 10000,
              headers: { 'Cache-Control': 'no-cache' },
            });

            if (cancelled) return null;

            if (response.data?.url) {
              return { id: camera.id, status: 'online' as const, streamUrl: response.data.url };
            }
            return { id: camera.id, status: 'offline' as const, streamUrl: '' };
          } catch {
            if (cancelled) return null;
            return { id: camera.id, status: 'offline' as const, streamUrl: '' };
          }
        });

        const results = await Promise.all(promises);
        if (cancelled) break;

        setCameras((prev) => prev.map((camera) => {
          const result = results.find((item) => item?.id === camera.id);
          if (!result) return camera;
          return { ...camera, status: result.status, streamUrl: result.streamUrl };
        }));

        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    };

    checkInBatches();
    setHasChecked(true);

    return () => {
      cancelled = true;
    };
  }, [session, cameras, hasChecked]);

  const paginatedCameras = useMemo(() => {
    const startIndex = (currentPage - 1) * camerasPerPage;
    return cameras.slice(startIndex, startIndex + camerasPerPage);
  }, [cameras, currentPage]);

  const totalPages = Math.max(1, Math.ceil(cameras.length / camerasPerPage));

  const getTypeIcon = (type: Camera['type']) => (type === 'intelbras' ? '📹' : type === 'tapo' ? '📷' : '🎥');

  const getStatusIcon = (status: Camera['status']) => {
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      default:
        return '🟡';
    }
  };

  const getStatusText = (status: Camera['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      default:
        return 'Verificando...';
    }
  };

  const handleCameraClick = async (camera: Camera) => {
    if (camera.status === 'online' && camera.streamUrl) {
      onCameraSelect(camera.id);
      return;
    }

    try {
      setCameras((prev) => prev.map((item) => item.id === camera.id ? { ...item, status: 'loading' } : item));
      const response = await axios.get(`/api/streams/${camera.id}`, {
        timeout: 10000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.data?.url) {
        setCameras((prev) => prev.map((item) => item.id === camera.id
          ? { ...item, status: 'online', streamUrl: response.data.url }
          : item,
        ));
        onCameraSelect(camera.id);
      } else {
        setCameras((prev) => prev.map((item) => item.id === camera.id ? { ...item, status: 'offline' } : item));
      }
    } catch {
      setCameras((prev) => prev.map((item) => item.id === camera.id ? { ...item, status: 'offline' } : item));
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
        📹 Menu de Câmeras
      </h2>

      {loading && (
        <div className="text-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
          <p className="text-sm text-gray-600">Carregando câmeras...</p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
          <div className="flex">
            <div className="text-red-400">⚠️</div>
            <div className="ml-2">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {!loading && (
        <>
          <div className="space-y-3">
            {paginatedCameras.map((camera) => (
              <div
                key={camera.id}
                className={`border rounded-lg p-4 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  camera.status === 'online'
                    ? 'border-green-200 bg-green-50 hover:bg-green-100'
                    : camera.status === 'offline'
                    ? 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                    : 'border-yellow-200 bg-yellow-50 hover:bg-yellow-100'
                }`}
                onClick={() => handleCameraClick(camera)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{getTypeIcon(camera.type)}</span>
                      <span className="text-lg">{getStatusIcon(camera.status)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{camera.name}</h3>
                      <p className="text-sm text-gray-600">
                        {camera.host}:{camera.port} • {camera.type.toUpperCase()}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className={`text-sm font-medium ${
                      camera.status === 'online'
                        ? 'text-green-700'
                        : camera.status === 'offline'
                        ? 'text-gray-600'
                        : 'text-yellow-700'
                    }`}>
                      {getStatusText(camera.status)}
                    </p>
                    {camera.status === 'online' && (
                      <p className="text-xs text-gray-500 mt-1">Clique para abrir</p>
                    )}
                    {camera.status === 'offline' && (
                      <p className="text-xs text-gray-500 mt-1">Verificar status</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === 1
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                ←
              </button>

              <span className="text-sm text-gray-600">
                Página {currentPage} de {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === totalPages
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                →
              </button>
            </div>
          )}
        </>
      )}

      {cameras.length === 0 && !loading && (
        <div className="text-center py-8">
          <div className="text-gray-400 text-4xl mb-2">📹</div>
          <p className="text-gray-600">Nenhuma câmera configurada</p>
          <p className="text-sm text-gray-500 mt-1">
            Configure as câmeras em /config
          </p>
        </div>
      )}

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>Total: {cameras.length} câmeras</span>
          <span>
            Online: {cameras.filter((c) => c.status === 'online').length} |
            Offline: {cameras.filter((c) => c.status === 'offline').length}
          </span>
        </div>
      </div>
    </div>
  );
}
