'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import CameraMenu from '@/components/CameraMenu';
import CameraModal from '@/components/CameraModal';

export default function CamerasPage() {
  const { data: session, status } = useSession();
  const [selectedCamera, setSelectedCamera] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCameraSelect = (cameraId: number) => {
    const cameraName = `Câmera ${cameraId}`;
    setSelectedCamera({ id: cameraId, name: cameraName });
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedCamera(null);
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
                📹 Menu de Câmeras
              </h1>
              <p className="text-sm text-gray-600">
                Selecione uma câmera para visualizar
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="px-4 py-2 text-sm bg-gray-500 text-white rounded hover:bg-gray-600 transition-colors"
              >
                ← Voltar ao Dashboard
              </a>
              <a
                href="/config"
                className="px-4 py-2 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
              >
                Configuração
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Menu de Câmeras */}
          <div>
            <CameraMenu onCameraSelect={handleCameraSelect} />
          </div>

          {/* Informações do Sistema */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
              ℹ️ Informações do Sistema
            </h2>
            
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-gray-900">Como usar:</h3>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>• Clique em uma câmera online para abrir o modal</li>
                  <li>• Use F para alternar tela cheia</li>
                  <li>• Pressione ESC para fechar o modal</li>
                  <li>• Clique no link para abrir em nova aba</li>
                </ul>
              </div>

              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-gray-900">Status das Câmeras:</h3>
                <ul className="text-sm text-gray-600 mt-2 space-y-1">
                  <li>🟢 <span className="text-green-700">Online</span> - Câmera funcionando</li>
                  <li>🔴 <span className="text-red-700">Offline</span> - Câmera indisponível</li>
                  <li>🟡 <span className="text-yellow-700">Carregando</span> - Verificando status</li>
                </ul>
              </div>

              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-gray-900">Configuração:</h3>
                <p className="text-sm text-gray-600 mt-2">
                  As câmeras estão configuradas no arquivo <code className="bg-gray-100 px-1 rounded">.env.local</code>
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Total: 32 câmeras configuradas
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  📹 Intelbras: 29 câmeras | 📷 Tapo: 3 câmeras
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Faixa de IPs: 172.16.5.x a 172.16.15.x
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Links rápidos */}
        <div className="mt-8 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
            🔗 Links Rápidos (Primeiras 12 Câmeras)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 12 }, (_, i) => {
              const cameraId = i + 1;
              const ips = [
                '172.16.11.179', '172.16.14.182', '172.16.9.91', '172.16.8.155',
                '172.16.11.16', '172.16.11.144', '172.16.12.176', '172.16.12.187',
                '172.16.8.194', '172.16.8.223', '172.16.13.235', '172.16.13.254'
              ];
              const types = Array(12).fill('intelbras');
              
              return (
                <a
                  key={cameraId}
                  href={`http://localhost:8000/camera/${cameraId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-center">
                    <div className="text-xl mb-1">📹</div>
                    <h3 className="font-semibold text-gray-900 text-sm">Intelbras {cameraId}</h3>
                    <p className="text-xs text-gray-600">{ips[i]}</p>
                  </div>
                </a>
              );
            })}
          </div>
          
          {/* Links para câmeras Tapo */}
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-3">📷 Câmeras Tapo</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { id: 30, name: 'Tapo 1', ip: '172.16.15.36' },
                { id: 31, name: 'Tapo 2', ip: '172.16.10.28' },
                { id: 32, name: 'Tapo 3', ip: '172.16.13.82' }
              ].map((camera) => (
                <a
                  key={camera.id}
                  href={`http://localhost:8000/camera/${camera.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="text-center">
                    <div className="text-xl mb-1">📷</div>
                    <h3 className="font-semibold text-gray-900 text-sm">{camera.name}</h3>
                    <p className="text-xs text-gray-600">{camera.ip}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
          
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600">
              Total de 32 câmeras configuradas (29 Intelbras + 3 Tapo). Use o menu acima para acessar todas.
            </p>
          </div>
        </div>
      </main>

      {/* Modal da Câmera */}
      {selectedCamera && (
        <CameraModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          cameraId={selectedCamera.id}
          cameraName={selectedCamera.name}
        />
      )}
    </div>
  );
}
