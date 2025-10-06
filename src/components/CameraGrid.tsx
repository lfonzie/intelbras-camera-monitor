'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import axios from 'axios';

import Camera from '@/components/Camera';

interface CameraMetadata {
  id: number;
  name: string;
  type: string;
}

interface CamerasApiResponse {
  cameras: CameraMetadata[];
}

type GridSize = 'small' | 'medium' | 'large';

type CameraStatus = 'idle' | 'loading' | 'online' | 'offline' | 'error';

export default function CameraGrid() {
  const { data: session, status } = useSession();
  const [cameraMetadata, setCameraMetadata] = useState<CameraMetadata[]>([]);
  const [streams, setStreams] = useState<Record<number, string>>({});
  const [loadingCameras, setLoadingCameras] = useState(true);
  const [streamError, setStreamError] = useState<string>('');
  const [cameraStatuses, setCameraStatuses] = useState<Record<number, CameraStatus>>({});
  const [gridSize, setGridSize] = useState<GridSize>('medium');
  const [currentPage, setCurrentPage] = useState(1);
  const [isFetchingStreams, setIsFetchingStreams] = useState(false);
  const loadedStreams = useRef<Set<number>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const loadCameras = async () => {
      try {
        setLoadingCameras(true);
        const response = await axios.get<CamerasApiResponse>('/api/cameras', {
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (cancelled) return;

        const metadata = response.data?.cameras ?? [];

        setCameraMetadata(metadata);
        setCameraStatuses((prev) => {
          const next: Record<number, CameraStatus> = { ...prev };
          metadata.forEach((camera) => {
            if (!next[camera.id]) {
              next[camera.id] = 'idle';
            }
          });
          return next;
        });
      } catch {
        if (!cancelled) {
          setStreamError('Não foi possível carregar a configuração das câmeras. Verifique o arquivo .env.');
        }
      } finally {
        if (!cancelled) {
          setLoadingCameras(false);
        }
      }
    };

    loadCameras();
    return () => {
      cancelled = true;
    };
  }, []);

  const camerasPerPage = useMemo(() => {
    switch (gridSize) {
      case 'small':
        return 9;
      case 'large':
        return 1;
      default:
        return 4;
    }
  }, [gridSize]);

  const totalPages = useMemo(() => {
    if (cameraMetadata.length === 0) return 1;
    return Math.ceil(cameraMetadata.length / camerasPerPage);
  }, [cameraMetadata.length, camerasPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const currentPageCameras = useMemo(() => {
    const startIndex = (currentPage - 1) * camerasPerPage;
    return cameraMetadata.slice(startIndex, startIndex + camerasPerPage);
  }, [cameraMetadata, currentPage, camerasPerPage]);

  const updateStatus = useCallback((cameraId: number, status: CameraStatus) => {
    setCameraStatuses((prev) => ({
      ...prev,
      [cameraId]: status,
    }));
  }, []);

  const handleRecordStart = useCallback((cameraId: number) => {
    console.info(`Gravação iniciada para câmera ${cameraId}`);
  }, []);

  const fetchStreamForCamera = useCallback(async (cameraId: number) => {
    updateStatus(cameraId, 'loading');
    try {
      const response = await axios.get(`/api/streams/${cameraId}`, {
        timeout: 15000,
        headers: { 'Cache-Control': 'no-cache' },
      });

      if (response.data?.url) {
        setStreams((prev) => ({ ...prev, [cameraId]: response.data.url }));
        loadedStreams.current.add(cameraId);
        updateStatus(cameraId, 'online');
        return true;
      }

      updateStatus(cameraId, 'offline');
      return false;
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 429) {
        setStreamError(error.response.data?.error || 'Limite de streams simultâneos atingido.');
      }
      updateStatus(cameraId, 'offline');
      return false;
    }
  }, [updateStatus]);

  useEffect(() => {
    const abortController = new AbortController();

    if (status !== 'authenticated' || currentPageCameras.length === 0) {
      return () => abortController.abort();
    }

    const loadStreamsForPage = async () => {
      setIsFetchingStreams(true);
      setStreamError('');

      const pendingIds = currentPageCameras
        .map((camera) => camera.id)
        .filter((id) => !loadedStreams.current.has(id));

      if (pendingIds.length === 0) {
        setIsFetchingStreams(false);
        return;
      }

      const offlineIds: number[] = [];

      for (const id of pendingIds) {
        if (abortController.signal.aborted) {
          break;
        }

        const success = await fetchStreamForCamera(id);
        if (!success) {
          offlineIds.push(id);
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (offlineIds.length > 0) {
        setStreamError(`Algumas câmeras estão offline: ${offlineIds.join(', ')}`);
      }

      setIsFetchingStreams(false);
    };

    loadStreamsForPage();

    return () => {
      abortController.abort();
    };
  }, [status, currentPageCameras, fetchStreamForCamera]);

  useEffect(() => {
    const currentIds = new Set(currentPageCameras.map((camera) => camera.id));
    const toStop = Array.from(loadedStreams.current).filter((id) => !currentIds.has(id));

    if (toStop.length === 0) {
      return;
    }

    toStop.forEach((id) => {
      axios.delete(`/api/streams/${id}`).catch(() => undefined);
      loadedStreams.current.delete(id);
      setStreams((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      updateStatus(id, 'idle');
    });
  }, [currentPageCameras, updateStatus]);

  useEffect(() => {
    const streamSet = loadedStreams.current;
    return () => {
      const ids = Array.from(streamSet);
      ids.forEach((id) => {
        axios.delete(`/api/streams/${id}`).catch(() => undefined);
      });
      streamSet.clear();
    };
  }, []);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const getGridClasses = () => {
    switch (gridSize) {
      case 'small':
        return 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3';
      case 'large':
        return 'grid-cols-1';
      default:
        return 'grid-cols-1 sm:grid-cols-2';
    }
  };

  if (status === 'loading' || loadingCameras) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando configuração...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4 text-gray-900">Acesso Restrito</h1>
          <p className="text-gray-600 mb-6">Faça login para acessar o sistema de monitoramento</p>
          <a
            href="/auth/signin"
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Fazer Login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Sistema de Monitoramento Mibo
              </h1>
              <p className="text-sm text-gray-600">
                Bem-vindo, {session.user?.name}
              </p>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/cameras"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                📹 Menu de Câmeras
              </Link>

              <Link
                href="/discover"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                🔍 Descobrir Câmeras
              </Link>

              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Tamanho:</span>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value as GridSize)}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="small">Pequeno</option>
                  <option value="medium">Médio</option>
                  <option value="large">Grande</option>
                </select>
              </div>

              <div className="text-sm text-gray-600">
                Página {currentPage} de {totalPages} - {Object.values(streams).filter(Boolean).length} de {currentPageCameras.length} câmeras ativas
              </div>

              <Link
                href="/config"
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Configuração
              </Link>

              <button
                onClick={() => signOut()}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {(isFetchingStreams || status === 'loading') && (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">Carregando streams das câmeras...</p>
          </div>
        )}

        {streamError && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="text-yellow-500">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Aviso</h3>
                <p className="text-sm text-yellow-700 mt-1">{streamError}</p>
              </div>
            </div>
          </div>
        )}

        {cameraMetadata.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-4xl mb-2">📷</div>
            <p className="text-gray-700">Nenhuma câmera configurada.</p>
            <p className="text-sm text-gray-500 mt-1">Utilize a página de configuração para adicionar câmeras.</p>
          </div>
        ) : (
          <>
            <div className={`grid ${getGridClasses()} gap-4`}>
              {currentPageCameras.map((camera) => (
                <Camera
                  key={camera.id}
                  id={camera.id}
                  name={camera.name}
                  streamUrl={streams[camera.id]}
                  onRecord={handleRecordStart}
                  onError={() => updateStatus(camera.id, 'error')}
                  isVisible
                  statusOverride={cameraStatuses[camera.id]}
                />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex justify-center items-center space-x-4">
                <button
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === 1
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  ← Anterior
                </button>

                <div className="flex space-x-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => goToPage(page)}
                      className={`px-3 py-2 rounded-lg transition-colors ${
                        page === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    currentPage === totalPages
                      ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-500 text-white hover:bg-blue-600'
                  }`}
                >
                  Próximo →
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
