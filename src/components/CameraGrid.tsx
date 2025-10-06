'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import Camera from '@/components/Camera';
import axios from 'axios';

export default function CameraGrid() {
  const { data: session, status } = useSession();
  const [streams, setStreams] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [, setRecordingCameras] = useState<Set<number>>(new Set());
  const [gridSize, setGridSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [availableCameras, setAvailableCameras] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const camerasPerPage = 4;
  const [visibleCameras, setVisibleCameras] = useState<Set<number>>(new Set());
  const [loadedStreams, setLoadedStreams] = useState<Set<number>>(new Set());

  // Get available cameras from environment or use default
  const getAvailableCameras = async () => {
    try {
      // Try to get camera count from a simple API endpoint
      const response = await axios.get('/api/cameras/count');
      const count = response.data.count || 0;
      return Array.from({ length: count }, (_, i) => i + 1);
    } catch (error) {
      console.warn('Could not get camera count, using default of 5 cameras');
      // Default to 5 cameras if no configuration is found
      return Array.from({ length: 5 }, (_, i) => i + 1);
    }
  };

  const cameras = availableCameras;
  
  // Calcular câmeras da página atual
  const totalPages = Math.ceil(cameras.length / camerasPerPage);
  const startIndex = (currentPage - 1) * camerasPerPage;
  const endIndex = startIndex + camerasPerPage;
  const currentPageCameras = cameras.slice(startIndex, endIndex);

  // Load available cameras first
  useEffect(() => {
    const loadCameras = async () => {
      const cameras = await getAvailableCameras();
      setAvailableCameras(cameras);
    };
    loadCameras();
  }, []);

  // Carregar streams das câmeras
  useEffect(() => {
    if (status === 'loading' || availableCameras.length === 0) return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchStreams = async () => {
      try {
        setLoading(true);
        setError('');
        
        // Carregar apenas a primeira câmera da página para evitar sobrecarga
        const camerasToLoad = currentPageCameras.slice(0, 1).filter(id => !loadedStreams.has(id));
        
        if (camerasToLoad.length === 0) {
          console.log('Nenhuma câmera nova para carregar');
          setLoading(false);
          return;
        }

        const batchSize = 1; // Carregar uma câmera por vez para evitar sobrecarga
        const streamMap: Record<number, string> = {};
        const offlineCameras: number[] = [];
        
        for (let i = 0; i < camerasToLoad.length; i += batchSize) {
          const batch = camerasToLoad.slice(i, i + batchSize);
          
          const promises = batch.map(async (id) => {
            try {
              const response = await axios.get(`/api/streams/${id}`, {
                timeout: 10000, // Aumentado para 10 segundos
                headers: {
                  'Cache-Control': 'no-cache'
                },
                validateStatus: (status) => status === 200 || status === 503 // Aceitar 503 como resposta válida
              });
              
              if (response.data.url) {
                console.log(`Stream obtido para câmera ${id}: ${response.data.url}`);
                return { id, url: response.data.url, status: 'online' };
              } else {
                console.warn(`Câmera ${id} não retornou URL de stream`);
                return { id, url: '', status: 'offline' };
              }
            } catch (error: any) {
              console.warn(`Câmera ${id} indisponível:`, error.response?.status, error.message);
              
              // Se for erro 503 (câmera não acessível), marcar como offline
              if (error.response?.status === 503) {
                const errorData = error.response?.data;
                console.warn(`Câmera ${id} offline: ${errorData?.ip}:${errorData?.port} - ${errorData?.error || 'Câmera não acessível'}`);
                if (errorData?.details) {
                  console.warn(`Detalhes: ${errorData.details}`);
                }
                offlineCameras.push(id);
                return { id, url: '', status: 'offline' };
              }
              
              // Se for erro 500 (erro interno), também marcar como offline
              if (error.response?.status === 500) {
                console.error(`Erro interno na câmera ${id}:`, error.response?.data?.error || 'Erro desconhecido');
                offlineCameras.push(id);
                return { id, url: '', status: 'offline' };
              }
              
              // Se for erro 404 (câmera não encontrada)
              if (error.response?.status === 404) {
                console.warn(`Câmera ${id} não encontrada na configuração`);
                return { id, url: '', status: 'not_found' };
              }
              
              return { id, url: '', status: 'error' };
            }
          });

          const results = await Promise.all(promises);
          results.forEach(({ id, url }) => {
            streamMap[id] = url;
          });
          
          // Pausa entre lotes para evitar sobrecarga
          if (i + batchSize < camerasToLoad.length) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Aumentado para 2 segundos
          }
        }

        const activeStreams = Object.values(streamMap).filter(url => url).length;
        console.log(`Streams carregados: ${activeStreams} de ${camerasToLoad.length} câmeras (página ${currentPage})`);
        console.log(`Câmeras offline: ${offlineCameras.length}`);
        
        setStreams(prev => ({ ...prev, ...streamMap }));
        
        // Marcar câmeras como carregadas
        setLoadedStreams(prev => {
          const newSet = new Set(prev);
          camerasToLoad.forEach(id => newSet.add(id));
          return newSet;
        });
        
        // Mostrar aviso se muitas câmeras estão offline
        if (offlineCameras.length > camerasToLoad.length * 0.5) {
          setError(`Muitas câmeras estão offline (${offlineCameras.length}/${camerasToLoad.length}). Verifique a conectividade e credenciais. Possíveis causas: credenciais incorretas, RTSP desabilitado, ou formato de URL incorreto.`);
        } else if (offlineCameras.length > 0) {
          setError(`Algumas câmeras estão offline (${offlineCameras.length}/${camerasToLoad.length}). Câmeras offline: ${offlineCameras.join(', ')}. Verifique credenciais e configurações RTSP.`);
        }
      } catch (error) {
        console.error('Erro ao carregar streams:', error);
        setError('Erro ao carregar streams das câmeras');
      } finally {
        setLoading(false);
      }
    };

    fetchStreams();
  }, [session, status, availableCameras, currentPage, loadedStreams]);

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
    // Para 4 câmeras por página, usar grid 2x2
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2';
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      setStreams({}); // Limpar streams ao mudar de página
      setLoadedStreams(new Set()); // Limpar cache de streams carregados
    }
  };

  // Função de visibilidade desabilitada temporariamente
  const handleVisibilityChange = (cameraId: number, visible: boolean) => {
    // Desabilitado para evitar loops
    return;
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
              {/* Menu de Câmeras */}
              <Link
                href="/cameras"
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
              >
                📹 Menu de Câmeras
              </Link>
              
              {/* Botão de Descoberta */}
              <Link
                href="/discover"
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
              >
                🔍 Descobrir Câmeras
              </Link>
              
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
                Página {currentPage} de {totalPages} - {Object.values(streams).filter(url => url).length} de {currentPageCameras.length} câmeras
              </div>
              
              {/* Config Link */}
              <Link
                href="/config"
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                Configuração
              </Link>
              
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
          <>
            <div className={`grid ${getGridClasses()} gap-4`}>
              {currentPageCameras.map((id) => (
                <Camera
                  key={id}
                  id={id}
                  streamUrl={streams[id]}
                  onRecord={handleRecord}
                  onError={handleCameraError}
                  isVisible={true}
                  onVisibilityChange={handleVisibilityChange}
                />
              ))}
            </div>

            {/* Controles de paginação */}
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
