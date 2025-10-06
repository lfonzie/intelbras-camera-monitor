'use client';

import { useState } from 'react';
import axios from 'axios';

interface CameraDiscoveryResult {
  ip: string;
  rtspUrl: string;
  status: 'found' | 'error';
  error?: string;
}

interface DiscoveryResponse {
  success: boolean;
  cameras: CameraDiscoveryResult[];
  total: number;
}

export default function CameraDiscovery() {
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredCameras, setDiscoveredCameras] = useState<CameraDiscoveryResult[]>([]);
  const [networkRange, setNetworkRange] = useState('172.16.0.2-172.16.15.254');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [scanProgress, setScanProgress] = useState(0);
  const [error, setError] = useState('');

  const startDiscovery = async () => {
    try {
      setIsScanning(true);
      setError('');
      setDiscoveredCameras([]);
      setScanProgress(0);

      // Simular progresso
      const progressInterval = setInterval(() => {
        setScanProgress(prev => Math.min(prev + 2, 90));
      }, 100);

      const response = await axios.post<DiscoveryResponse>('/api/discover', {
        networkRange,
        username,
        password
      });

      clearInterval(progressInterval);
      setScanProgress(100);

      if (response.data.success) {
        setDiscoveredCameras(response.data.cameras);
      } else {
        setError('Erro na descoberta de câmeras');
      }
    } catch (error) {
      setError('Erro ao conectar com o servidor de descoberta');
      console.error('Erro na descoberta:', error);
    } finally {
      setIsScanning(false);
    }
  };

  const generateEnvConfig = () => {
    if (discoveredCameras.length === 0) return '';
    
    const cameraIPs = discoveredCameras.map(camera => `${camera.ip}:554`);
    return `CAMERAS=${cameraIPs.join(',')}\nUSERNAME=${username}\nPASSWORD=${password}`;
  };

  const copyToClipboard = async () => {
    const config = generateEnvConfig();
    try {
      await navigator.clipboard.writeText(config);
      alert('Configuração copiada para a área de transferência!');
    } catch (error) {
      console.error('Erro ao copiar:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🔍 Descoberta Automática de Câmeras
      </h2>

      <div className="space-y-6">
        {/* Configurações */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rede para Escanear
            </label>
            <input
              type="text"
              value={networkRange}
              onChange={(e) => setNetworkRange(e.target.value)}
              placeholder="172.16.0.2-172.16.15.254"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isScanning}
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: 172.16.0.2-172.16.15.254 (IP inicial - IP final)
            </p>
            <p className="text-xs text-blue-600 mt-1">
              💡 Para câmeras Intelbras Mibo Cam (IM3, IM4, IM5): use a chave de acesso como senha
            </p>
            <p className="text-xs text-green-600 mt-1">
              💡 Para câmeras TP-Link Tapo: credenciais padrão são admin/tapooo888
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isScanning}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isScanning}
            />
          </div>
        </div>

        {/* Botão de Scan */}
        <div className="flex justify-center">
          <button
            onClick={startDiscovery}
            disabled={isScanning}
            className={`px-8 py-3 rounded-lg font-medium ${
              isScanning
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700'
            } text-white transition-colors`}
          >
            {isScanning ? (
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Escaneando... {scanProgress}%</span>
              </div>
            ) : (
              '🔍 Iniciar Descoberta'
            )}
          </button>
        </div>

        {/* Barra de Progresso */}
        {isScanning && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            ></div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
            {error}
          </div>
        )}

        {/* Resultados */}
        {discoveredCameras.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-4 text-green-600">
              ✅ {discoveredCameras.length} Câmera(s) Encontrada(s)
            </h3>
            
            <div className="space-y-2 mb-4">
              {discoveredCameras.map((camera, index) => (
                <div key={index} className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium text-green-800">
                        Câmera {index + 1}: {camera.ip}
                      </span>
                      <p className="text-sm text-green-600 mt-1">
                        {camera.rtspUrl}
                      </p>
                    </div>
                    <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                      ✓ Conectada
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Configuração Gerada */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-800 mb-2">
                📋 Configuração para .env.local:
              </h4>
              <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
                {generateEnvConfig()}
              </pre>
              <button
                onClick={copyToClipboard}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                📋 Copiar Configuração
              </button>
            </div>
          </div>
        )}

        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-800 mb-2">💡 Como usar:</h4>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Conecte-se à rede onde estão as câmeras</li>
            <li>2. Configure a faixa de IPs correta (ex: 172.16.0.2-172.16.15.254)</li>
            <li>3. Para câmeras Intelbras Mibo Cam: use a chave de acesso como senha</li>
            <li>4. Clique em "Iniciar Descoberta"</li>
            <li>5. Copie a configuração gerada para o arquivo .env.local</li>
            <li>6. Reinicie o servidor para aplicar as mudanças</li>
          </ol>
        </div>

        {/* Instruções específicas para Intelbras Mibo Cam */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h4 className="font-medium text-green-800 mb-2">📹 Configuração Intelbras Mibo Cam:</h4>
          <div className="text-sm text-green-700 space-y-2">
            <p><strong>Para obter a chave de acesso:</strong></p>
            <ol className="ml-4 space-y-1">
              <li>1. Abra o app Mibo Cam</li>
              <li>2. Acesse as configurações da câmera (ícone engrenagem)</li>
              <li>3. Clique em "Avançado" → "Redes"</li>
              <li>4. Anote o IP da câmera</li>
              <li>5. Volte nas configurações e clique no nome da câmera</li>
              <li>6. Acesse "Etiqueta do dispositivo" e anote a chave de acesso</li>
            </ol>
            <p className="mt-2"><strong>Formato RTSP:</strong> <code>rtsp://admin:CHAVE_ACESSO@IP:554/cam/realmonitor?channel=1&subtype=0</code></p>
          </div>
        </div>

        {/* Instruções específicas para TP-Link Tapo */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h4 className="font-medium text-purple-800 mb-2">📹 Configuração TP-Link Tapo:</h4>
          <div className="text-sm text-purple-700 space-y-2">
            <p><strong>Credenciais padrão:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• <strong>Usuário:</strong> admin</li>
              <li>• <strong>Senha:</strong> tapooo888</li>
            </ul>
            <p className="mt-2"><strong>Para encontrar o IP:</strong></p>
            <ol className="ml-4 space-y-1">
              <li>1. Abra o app Tapo</li>
              <li>2. Acesse as configurações da câmera</li>
              <li>3. Vá em "Configurações" → "Rede" → "Status da Rede"</li>
              <li>4. Anote o endereço IP da câmera</li>
            </ol>
            <p className="mt-2"><strong>Formatos RTSP disponíveis:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• <strong>Stream1 (1080P):</strong> <code>rtsp://username:password@IP:554/stream1</code></li>
              <li>• <strong>Stream2 (360P):</strong> <code>rtsp://username:password@IP:554/stream2</code></li>
            </ul>
            <p className="mt-2 text-xs"><strong>Nota:</strong> Para o Tapo C310, a resolução do stream1 é determinada pela qualidade definida no app Tapo.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
