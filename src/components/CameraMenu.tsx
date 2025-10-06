'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import axios from 'axios';

interface Camera {
  id: number;
  name: string;
  ip: string;
  port: number;
  status: 'online' | 'offline' | 'loading';
  streamUrl?: string;
  type: 'intelbras' | 'tapo';
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

  // Função para verificar todas as câmeras em lotes
  const checkAllCamerasInBatches = async (camerasList: Camera[]) => {
    const batchSize = 5;
    
    for (let i = 0; i < camerasList.length; i += batchSize) {
      const batch = camerasList.slice(i, i + batchSize);
      
      const promises = batch.map(async (camera) => {
        try {
          const response = await axios.get(`/api/streams/${camera.id}`, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache' },
            validateStatus: (status) => status === 200 || status === 503
          });
          
          if (response.status === 200 && response.data.url) {
            return { id: camera.id, status: 'online' as const, streamUrl: response.data.url };
          } else {
            return { id: camera.id, status: 'offline' as const, streamUrl: '' };
          }
        } catch (error) {
          console.warn(`Câmera ${camera.id} indisponível:`, error);
          return { id: camera.id, status: 'offline' as const, streamUrl: '' };
        }
      });
      
      const batchResults = await Promise.all(promises);
      
      // Atualizar status das câmeras do lote
      setCameras(prev => prev.map(camera => {
        const result = batchResults.find(r => r.id === camera.id);
        if (result) {
          return { ...camera, status: result.status, streamUrl: result.streamUrl };
        }
        return camera;
      }));
      
      // Pequena pausa entre lotes para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log('✅ Verificação de todas as câmeras concluída');
  };

  // Configuração das câmeras baseada no .env.local
  const cameraConfigs = [
    // Câmeras Intelbras (29 câmeras)
    { id: 1, name: 'Intelbras 1', ip: '172.16.11.179', port: 554, type: 'intelbras' as const },
    { id: 2, name: 'Intelbras 2', ip: '172.16.14.182', port: 554, type: 'intelbras' as const },
    { id: 3, name: 'Intelbras 3', ip: '172.16.9.91', port: 554, type: 'intelbras' as const },
    { id: 4, name: 'Intelbras 4', ip: '172.16.8.155', port: 554, type: 'intelbras' as const },
    { id: 5, name: 'Intelbras 5', ip: '172.16.11.16', port: 554, type: 'intelbras' as const },
    { id: 6, name: 'Intelbras 6', ip: '172.16.11.144', port: 554, type: 'intelbras' as const },
    { id: 7, name: 'Intelbras 7', ip: '172.16.12.176', port: 554, type: 'intelbras' as const },
    { id: 8, name: 'Intelbras 8', ip: '172.16.12.187', port: 554, type: 'intelbras' as const },
    { id: 9, name: 'Intelbras 9', ip: '172.16.8.194', port: 554, type: 'intelbras' as const },
    { id: 10, name: 'Intelbras 10', ip: '172.16.8.223', port: 554, type: 'intelbras' as const },
    { id: 11, name: 'Intelbras 11', ip: '172.16.13.235', port: 554, type: 'intelbras' as const },
    { id: 12, name: 'Intelbras 12', ip: '172.16.13.254', port: 554, type: 'intelbras' as const },
    { id: 13, name: 'Intelbras 13', ip: '172.16.13.197', port: 554, type: 'intelbras' as const },
    { id: 14, name: 'Intelbras 14', ip: '172.16.6.128', port: 554, type: 'intelbras' as const },
    { id: 15, name: 'Intelbras 15', ip: '172.16.6.209', port: 554, type: 'intelbras' as const },
    { id: 16, name: 'Intelbras 16', ip: '172.16.6.239', port: 554, type: 'intelbras' as const },
    { id: 17, name: 'Intelbras 17', ip: '172.16.9.7', port: 554, type: 'intelbras' as const },
    { id: 18, name: 'Intelbras 18', ip: '172.16.5.158', port: 554, type: 'intelbras' as const },
    { id: 19, name: 'Intelbras 19', ip: '172.16.8.0', port: 554, type: 'intelbras' as const },
    { id: 20, name: 'Intelbras 20', ip: '172.16.14.251', port: 554, type: 'intelbras' as const },
    { id: 21, name: 'Intelbras 21', ip: '172.16.15.17', port: 554, type: 'intelbras' as const },
    { id: 22, name: 'Intelbras 22', ip: '172.16.7.12', port: 554, type: 'intelbras' as const },
    { id: 23, name: 'Intelbras 23', ip: '172.16.6.178', port: 554, type: 'intelbras' as const },
    { id: 24, name: 'Intelbras 24', ip: '172.16.10.37', port: 554, type: 'intelbras' as const },
    { id: 25, name: 'Intelbras 25', ip: '172.16.10.85', port: 554, type: 'intelbras' as const },
    { id: 26, name: 'Intelbras 26', ip: '172.16.9.236', port: 554, type: 'intelbras' as const },
    { id: 27, name: 'Intelbras 27', ip: '172.16.9.238', port: 554, type: 'intelbras' as const },
    { id: 28, name: 'Intelbras 28', ip: '172.16.5.161', port: 554, type: 'intelbras' as const },
    { id: 29, name: 'Intelbras 29', ip: '172.16.5.186', port: 554, type: 'intelbras' as const },
    
    // Câmeras Tapo (3 câmeras)
    { id: 30, name: 'Tapo 1', ip: '172.16.15.36', port: 554, type: 'tapo' as const },
    { id: 31, name: 'Tapo 2', ip: '172.16.10.28', port: 554, type: 'tapo' as const },
    { id: 32, name: 'Tapo 3', ip: '172.16.13.82', port: 554, type: 'tapo' as const },
  ];

  useEffect(() => {
    if (!session) return;

    const loadCameras = async () => {
      try {
        setLoading(true);
        setError('');

        // Criar lista de câmeras baseada na configuração
        const camerasList: Camera[] = cameraConfigs.map(config => ({
          ...config,
          status: 'offline' as const, // Status padrão offline
        }));

        setCameras(camerasList);
        
        // Verificar todas as câmeras em lotes
        console.log('🔍 Verificando todas as câmeras na inicialização...');
        await checkAllCamerasInBatches(camerasList);

      } catch (error) {
        console.error('Erro ao carregar câmeras:', error);
        setError('Erro ao carregar lista de câmeras');
      } finally {
        setLoading(false);
      }
    };

    loadCameras();
  }, [session]);

  const getStatusIcon = (status: Camera['status'], type: Camera['type']) => {
    const baseIcon = type === 'intelbras' ? '📹' : '📷';
    switch (status) {
      case 'online':
        return '🟢';
      case 'offline':
        return '🔴';
      case 'loading':
        return '🟡';
      default:
        return '⚪';
    }
  };

  const getTypeIcon = (type: Camera['type']) => {
    return type === 'intelbras' ? '📹' : '📷';
  };

  const getStatusText = (status: Camera['status']) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Clique para verificar';
      case 'loading':
        return 'Carregando...';
      default:
        return 'Desconhecido';
    }
  };

  const handleCameraClick = async (camera: Camera) => {
    // Se a câmera já está online, abrir modal diretamente
    if (camera.status === 'online') {
      onCameraSelect(camera.id);
      return;
    }

    // Se está offline, verificar status primeiro
    try {
      // Atualizar status para loading
      setCameras(prev => prev.map(c => 
        c.id === camera.id ? { ...c, status: 'loading' as const } : c
      ));

          const response = await axios.get(`/api/streams/${camera.id}`, {
            timeout: 10000,
            headers: { 'Cache-Control': 'no-cache' },
            validateStatus: (status) => status === 200 || status === 503 // Aceitar 503 como resposta válida
          });

      if (response.status === 200 && response.data.url) {
        // Câmera online, atualizar status e abrir modal
        setCameras(prev => prev.map(c => 
          c.id === camera.id 
            ? { ...c, status: 'online' as const, streamUrl: response.data.url }
            : c
        ));
        onCameraSelect(camera.id);
      } else {
        // Câmera offline (status 503 ou sem URL)
        setCameras(prev => prev.map(c => 
          c.id === camera.id ? { ...c, status: 'offline' as const } : c
        ));
      }
    } catch (error) {
      console.warn(`Câmera ${camera.id} indisponível:`, error);
      // Manter como offline
      setCameras(prev => prev.map(c => 
        c.id === camera.id ? { ...c, status: 'offline' as const } : c
      ));
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
            {cameras
              .slice((currentPage - 1) * camerasPerPage, currentPage * camerasPerPage)
              .map((camera) => (
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
                      <span className="text-lg">{getStatusIcon(camera.status, camera.type)}</span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{camera.name}</h3>
                      <p className="text-sm text-gray-600">
                        {camera.ip}:{camera.port} • {camera.type.toUpperCase()}
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
                        <p className="text-xs text-gray-500 mt-1">
                          Clique para abrir
                        </p>
                      )}
                      {camera.status === 'offline' && (
                        <p className="text-xs text-gray-500 mt-1">
                          Verificar status
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Paginação */}
          {Math.ceil(cameras.length / camerasPerPage) > 1 && (
            <div className="mt-6 flex justify-center items-center space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                Página {currentPage} de {Math.ceil(cameras.length / camerasPerPage)}
              </span>
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(Math.ceil(cameras.length / camerasPerPage), prev + 1))}
                disabled={currentPage === Math.ceil(cameras.length / camerasPerPage)}
                className={`px-3 py-1 rounded text-sm ${
                  currentPage === Math.ceil(cameras.length / camerasPerPage)
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
            Online: {cameras.filter(c => c.status === 'online').length} | 
            Offline: {cameras.filter(c => c.status === 'offline').length}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>
            📹 Intelbras: {cameras.filter(c => c.type === 'intelbras').length} | 
            📷 Tapo: {cameras.filter(c => c.type === 'tapo').length}
          </span>
          <span>
            Online: {cameras.filter(c => c.status === 'online').length} | 
            Verificadas: {cameras.filter(c => c.status !== 'offline').length}
          </span>
        </div>
      </div>
    </div>
  );
}
