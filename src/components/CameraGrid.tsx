'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Camera from '@/components/Camera';
import axios from 'axios';

export default function CameraGrid() {
  const { data: session, status } = useSession();
  const [streams, setStreams] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [, setRecordingCameras] = useState<Set<number>>(new Set());
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');

  const cameras = Array.from({ length: 35 }, (_, i) => i + 1);

  // Carregar streams das câmeras
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchStreams = async () => {
      try {
        setLoading(true);
        setError('');
        
        const promises = cameras.map(async (id) => {
          try {
            const response = await axios.get(`/api/streams/${id}`);
            return { id, url: response.data.url };
          } catch (error) {
            console.error(`Erro ao carregar stream da câmera ${id}:`, error);
            return { id, url: '' };
          }
        });

        const results = await Promise.all(promises);
        const streamMap = results.reduce((acc, { id, url }) => {
          acc[id] = url;
          return acc;
        }, {} as Record<number, string>);

        setStreams(streamMap);
      } catch (error) {
        console.error('Erro ao carregar streams:', error);
        setError('Erro ao carregar streams das câmeras');
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
  }, [session, status, cameras]);

  const handleRecord = (cameraId: number) => {
    setRecordingCameras(prev => new Set(prev).add(cameraId));
    // Simular parada da gravação após 5 segundos
    setTimeout(() => {
      setRecordingCameras(prev => {
        const newSet = new Set(prev);
        newSet.delete(cameraId);
        return newSet;
      });
    }, 5000);
  };

  const handleCameraError = (cameraId: number, error: string) => {
    console.error(`Erro na câmera ${cameraId}:`, error);
  };

  const getGridClasses = () => {
    switch (gridSize) {
      case 'small':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      case 'medium':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
      case 'large':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
      default:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando...</p>
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
      {/* Header */}
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
              {/* Controles de grade */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Tamanho:</span>
                <select
                  value={gridSize}
                  onChange={(e) => setGridSize(e.target.value as 'small' | 'medium' | 'large')}
                  className="text-sm border border-gray-300 rounded px-2 py-1"
                >
                  <option value="small">Pequeno</option>
                  <option value="medium">Médio</option>
                  <option value="large">Grande</option>
                </select>
              </div>
              
              {/* Status */}
              <div className="text-sm text-gray-600">
                {Object.values(streams).filter(url => url).length} de {cameras.length} câmeras ativas
              </div>
              
              {/* Logout */}
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

      {/* Conteúdo principal */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600">Carregando streams das câmeras...</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex">
              <div className="text-red-400">⚠️</div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Erro</h3>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {!loading && (
          <div className={`grid ${getGridClasses()} gap-4`}>
            {cameras.map((id) => (
              <Camera
                key={id}
                id={id}
                streamUrl={streams[id]}
                onRecord={handleRecord}
                onError={handleCameraError}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
