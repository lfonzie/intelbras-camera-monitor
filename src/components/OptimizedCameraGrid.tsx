'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import Camera from '@/components/Camera';
import axios from 'axios';

export default function OptimizedCameraGrid() {
  const { data: session, status } = useSession();
  const [streams, setStreams] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [optimized, setOptimized] = useState(false);
  const [activeCameras, setActiveCameras] = useState<Set<number>>(new Set());

  // Câmeras descobertas (limitadas para performance)
  const availableCameras = [1, 2, 3, 4]; // Máximo 4 câmeras
  const maxConcurrentStreams = 2; // Máximo 2 streams simultâneos

  // Otimizar sistema
  const optimizeSystem = async () => {
    try {
      setLoading(true);
      const response = await axios.post('/api/cameras/optimize');
      
      if (response.data.success) {
        setOptimized(true);
        setError('');
        console.log('Sistema otimizado:', response.data.optimizations);
      }
    } catch (error) {
      console.error('Erro na otimização:', error);
      setError('Erro ao otimizar sistema');
    } finally {
      setLoading(false);
    }
  };

  // Carregar stream de uma câmera específica
  const loadCameraStream = async (cameraId: number) => {
    if (activeCameras.size >= maxConcurrentStreams) {
      console.log(`Máximo de ${maxConcurrentStreams} streams atingido`);
      return;
    }

    try {
      console.log(`Carregando stream da câmera ${cameraId}...`);
      
      const response = await axios.get(`/api/streams/${cameraId}`, {
        timeout: 15000,
        headers: { 'Cache-Control': 'no-cache' }
      });
      
      if (response.data.url) {
        setStreams(prev => ({ ...prev, [cameraId]: response.data.url }));
        setActiveCameras(prev => new Set([...prev, cameraId]));
        console.log(`✅ Stream da câmera ${cameraId} carregado`);
      }
    } catch (error: any) {
      console.error(`❌ Erro ao carregar câmera ${cameraId}:`, error);
      
      if (error.response?.status === 503) {
        setError(`Câmera ${cameraId} offline - ${error.response.data.error}`);
      } else {
        setError(`Erro ao carregar câmera ${cameraId}`);
      }
    }
  };

  // Parar stream de uma câmera
  const stopCameraStream = async (cameraId: number) => {
    try {
      await axios.delete(`/api/streams/${cameraId}`);
      setStreams(prev => {
        const newStreams = { ...prev };
        delete newStreams[cameraId];
        return newStreams;
      });
      setActiveCameras(prev => {
        const newSet = new Set(prev);
        newSet.delete(cameraId);
        return newSet;
      });
      console.log(`✅ Stream da câmera ${cameraId} parado`);
    } catch (error) {
      console.error(`Erro ao parar câmera ${cameraId}:`, error);
    }
  };

  // Parar todos os streams
  const stopAllStreams = async () => {
    for (const cameraId of activeCameras) {
      await stopCameraStream(cameraId);
    }
  };

  // Carregar câmeras sequencialmente (uma por vez)
  const loadCamerasSequentially = async () => {
    setLoading(true);
    setError('');

    for (let i = 0; i < Math.min(availableCameras.length, maxConcurrentStreams); i++) {
      const cameraId = availableCameras[i];
      await loadCameraStream(cameraId);
      
      // Pequena pausa entre carregamentos
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    setLoading(false);
  };

  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    // Otimizar sistema primeiro
    optimizeSystem();
  }, [session, status]);

  if (status === 'loading') {
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
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🎥 Sistema de Câmeras Otimizado
        </h1>
        <p className="text-gray-600">
          Visualização otimizada para melhor performance
        </p>
      </div>

      {/* Status e Controles */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-800">Status do Sistema</h3>
            <p className="text-sm text-gray-600">
              {activeCameras.size} de {maxConcurrentStreams} câmeras ativas
            </p>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={loadCamerasSequentially}
              disabled={loading || activeCameras.size >= maxConcurrentStreams}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? 'Carregando...' : '▶️ Iniciar Câmeras'}
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
              disabled={loading}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              🔧 Otimizar
            </button>
          </div>
        </div>

        {optimized && (
          <div className="p-3 bg-green-100 border border-green-400 text-green-700 rounded">
            ✅ Sistema otimizado com sucesso
          </div>
        )}

        {error && (
          <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            ❌ {error}
          </div>
        )}
      </div>

      {/* Grid de Câmeras */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {availableCameras.map((cameraId) => (
          <div key={cameraId} className="relative">
            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              {/* Header da Câmera */}
              <div className="p-4 bg-gray-800 text-white flex items-center justify-between">
                <h3 className="font-semibold">Câmera {cameraId}</h3>
                <div className="flex items-center space-x-2">
                  {activeCameras.has(cameraId) ? (
                    <span className="px-2 py-1 bg-green-600 text-xs rounded">ATIVA</span>
                  ) : (
                    <span className="px-2 py-1 bg-gray-600 text-xs rounded">INATIVA</span>
                  )}
                  <button
                    onClick={() => 
                      activeCameras.has(cameraId) 
                        ? stopCameraStream(cameraId)
                        : loadCameraStream(cameraId)
                    }
                    disabled={loading || (!activeCameras.has(cameraId) && activeCameras.size >= maxConcurrentStreams)}
                    className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {activeCameras.has(cameraId) ? '⏹️' : '▶️'}
                  </button>
                </div>
              </div>

              {/* Vídeo */}
              <div className="aspect-video bg-black">
                {streams[cameraId] ? (
                  <Camera
                    id={cameraId}
                    streamUrl={streams[cameraId]}
                    onError={(error) => {
                      console.error(`Erro na câmera ${cameraId}:`, error);
                      setError(`Erro na câmera ${cameraId}: ${error}`);
                    }}
                    isVisible={true}
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
        ))}
      </div>

      {/* Informações de Performance */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Otimizações Aplicadas:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Máximo de {maxConcurrentStreams} câmeras simultâneas para melhor performance</li>
          <li>• Carregamento sequencial para evitar sobrecarga</li>
          <li>• Limpeza automática de arquivos de stream antigos</li>
          <li>• Configurações otimizadas de FFmpeg para menor latência</li>
          <li>• Reconexão automática em caso de perda de conexão</li>
        </ul>
      </div>
    </div>
  );
}





