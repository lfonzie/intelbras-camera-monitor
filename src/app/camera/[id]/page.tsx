'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Camera from '@/components/Camera';
import axios from 'axios';

export default function IndividualCameraPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const cameraId = parseInt(params.id as string);
  
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [isRecording, setIsRecording] = useState(false);

  // Carregar stream da câmera específica
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session) {
      setLoading(false);
      return;
    }

    const fetchStream = async () => {
      try {
        setLoading(true);
        setError('');
        
        const response = await axios.get(`/api/streams/${cameraId}`, {
          timeout: 10000,
          headers: {
            'Cache-Control': 'no-cache'
          }
        });
        
        if (response.data.url) {
          console.log(`Stream obtido para câmera ${cameraId}: ${response.data.url}`);
          setStreamUrl(response.data.url);
        } else {
          console.warn(`Câmera ${cameraId} não retornou URL de stream`);
          setError('Câmera não retornou URL de stream');
        }
      } catch (error: any) {
        console.error(`Erro ao carregar stream da câmera ${cameraId}:`, error);
        
        if (error.response?.status === 503) {
          const errorData = error.response?.data;
          setError(`Câmera offline: ${errorData?.ip}:${errorData?.port} - ${errorData?.error || 'Câmera não acessível'}`);
        } else if (error.response?.status === 500) {
          setError(`Erro interno na câmera: ${error.response?.data?.error || 'Erro desconhecido'}`);
        } else if (error.response?.status === 404) {
          setError(`Câmera ${cameraId} não encontrada na configuração`);
        } else {
          setError('Erro ao carregar stream da câmera');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchStream();
  }, [session, status, cameraId]);

  const handleRecord = async (id: number) => {
    try {
      setIsRecording(true);
      
      const response = await fetch(`/api/record/${id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('Gravação iniciada:', data);
      } else {
        console.error('Erro ao iniciar gravação');
      }
    } catch (error) {
      console.error('Erro na gravação:', error);
    } finally {
      setIsRecording(false);
    }
  };

  const handleCameraError = (id: number, error: string) => {
    console.error(`Erro na câmera ${id}:`, error);
    setError(error);
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
                Câmera {cameraId} - Sistema de Monitoramento Mibo
              </h1>
              <p className="text-sm text-gray-600">
                Bem-vindo, {session.user?.name}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Botão Voltar */}
              <button
                onClick={() => router.back()}
                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                ← Voltar
              </button>
              
              {/* Botão Dashboard */}
              <Link
                href="/"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                📊 Dashboard
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
            <p className="text-gray-600">Carregando stream da câmera...</p>
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
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-gray-800 mb-2">
                  Câmera {cameraId} - Visualização Individual
                </h2>
                <p className="text-sm text-gray-600">
                  Esta câmera está sendo exibida em tela cheia para melhor visualização
                </p>
              </div>
              
              <div className="relative">
                <Camera
                  id={cameraId}
                  streamUrl={streamUrl}
                  onRecord={handleRecord}
                  onError={handleCameraError}
                />
              </div>
              
              <div className="mt-4 flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {streamUrl ? 'Stream ativo' : 'Sem stream'}
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={() => window.open(`/camera/${cameraId}`, '_blank')}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                  >
                    🔗 Abrir em Nova Aba
                  </button>
                  
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
                  >
                    🔄 Recarregar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}






