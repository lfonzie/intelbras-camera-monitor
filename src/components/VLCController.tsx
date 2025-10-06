'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';

interface VLCStatus {
  vlcInstalled: boolean;
  activeProcesses: number;
  processes: Array<{
    pid: string;
    command: string;
  }>;
}

interface Camera {
  ip: string;
  name: string;
}

export default function VLCController() {
  const [vlcStatus, setVlcStatus] = useState<VLCStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Câmeras descobertas
  const cameras: Camera[] = [
    { ip: '172.16.8.0', name: 'Câmera 1' },
    { ip: '172.16.8.206', name: 'Câmera 2' },
    { ip: '172.16.9.238', name: 'Câmera 3' },
    { ip: '172.16.15.17', name: 'Câmera 4' }
  ];

  const checkVLCStatus = async () => {
    try {
      const response = await axios.get('/api/vlc/status');
      setVlcStatus(response.data);
    } catch (error) {
      console.error('Erro ao verificar status VLC:', error);
    }
  };

  const openCameras = async (mode: 'grid' | 'fullscreen') => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const cameraIPs = cameras.map(cam => cam.ip);
      const response = await axios.post('/api/vlc/open', {
        cameras: cameraIPs,
        mode: mode
      });

      if (response.data.success) {
        setSuccess(response.data.message);
        await checkVLCStatus();
      } else {
        setError('Erro ao abrir câmeras');
      }
    } catch (error) {
      setError('Erro ao conectar com o servidor');
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const closeAllCameras = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.delete('/api/vlc/open');
      
      if (response.data.success) {
        setSuccess(response.data.message);
        await checkVLCStatus();
      } else {
        setError('Erro ao fechar câmeras');
      }
    } catch (error) {
      setError('Erro ao conectar com o servidor');
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const openSingleCamera = async (cameraIP: string, mode: 'grid' | 'fullscreen') => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await axios.post('/api/vlc/open', {
        cameras: [cameraIP],
        mode: mode
      });

      if (response.data.success) {
        setSuccess(`Câmera ${cameraIP} aberta com sucesso`);
        await checkVLCStatus();
      } else {
        setError('Erro ao abrir câmera');
      }
    } catch (error) {
      setError('Erro ao conectar com o servidor');
      console.error('Erro:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkVLCStatus();
  }, []);

  if (!vlcStatus) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando status do VLC...</p>
        </div>
      </div>
    );
  }

  if (!vlcStatus.vlcInstalled) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-4">VLC não encontrado</h2>
          <p className="text-gray-600 mb-6">
            O VLC Media Player não está instalado no seu Mac.
          </p>
          <a
            href="https://www.videolan.org/vlc/download-macos.html"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            📥 Baixar VLC para Mac
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">🎥 Controle VLC</h2>
        <p className="text-gray-600">
          Abra suas câmeras diretamente no VLC Media Player
        </p>
      </div>

      {/* Status */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800">Status do VLC</h3>
            <p className="text-sm text-gray-600">
              {vlcStatus.activeProcesses} câmera(s) ativa(s)
            </p>
          </div>
          <button
            onClick={checkVLCStatus}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
          >
            🔄 Atualizar
          </button>
        </div>
      </div>

      {/* Mensagens */}
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          ❌ {error}
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          ✅ {success}
        </div>
      )}

      {/* Controles principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => openCameras('grid')}
          disabled={isLoading}
          className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <span className="mr-2">📱</span>
          )}
          Abrir em Grid (4 janelas)
        </button>

        <button
          onClick={() => openCameras('fullscreen')}
          disabled={isLoading}
          className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
          ) : (
            <span className="mr-2">🖥️</span>
          )}
          Abrir em Tela Cheia
        </button>
      </div>

      {/* Câmeras individuais */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Câmeras Individuais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {cameras.map((camera, index) => (
            <div key={camera.ip} className="p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-800">{camera.name}</h4>
                  <p className="text-sm text-gray-600">{camera.ip}</p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => openSingleCamera(camera.ip, 'grid')}
                    disabled={isLoading}
                    className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 disabled:opacity-50 transition-colors"
                  >
                    📱
                  </button>
                  <button
                    onClick={() => openSingleCamera(camera.ip, 'fullscreen')}
                    disabled={isLoading}
                    className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200 disabled:opacity-50 transition-colors"
                  >
                    🖥️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fechar todas */}
      <div className="text-center">
        <button
          onClick={closeAllCameras}
          disabled={isLoading || vlcStatus.activeProcesses === 0}
          className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2 inline-block"></div>
          ) : (
            <span className="mr-2">❌</span>
          )}
          Fechar Todas as Câmeras
        </button>
      </div>

      {/* Dicas */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-semibold text-blue-800 mb-2">💡 Dicas de Uso:</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Use <kbd className="px-1 py-0.5 bg-blue-200 rounded text-xs">Cmd+Tab</kbd> para alternar entre as janelas do VLC</li>
          <li>• Modo Grid: 4 janelas pequenas para monitoramento simultâneo</li>
          <li>• Modo Tela Cheia: Uma câmera por vez em tela cheia</li>
          <li>• Use <kbd className="px-1 py-0.5 bg-blue-200 rounded text-xs">Cmd+Q</kbd> para fechar uma janela específica do VLC</li>
        </ul>
      </div>
    </div>
  );
}





