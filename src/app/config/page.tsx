'use client';

import { useEffect, useState } from 'react';
import { useSession, SessionProvider } from 'next-auth/react';
import { useRouter } from 'next/navigation';

function ConfigPageContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [cameras, setCameras] = useState('');
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [message, setMessage] = useState('');
  const [testResult, setTestResult] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [cameraType, setCameraType] = useState<'intelbras' | 'tapo'>('intelbras');
  const [streamType, setStreamType] = useState<'stream1' | 'stream2'>('stream1');

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading' || status === 'unauthenticated') {
    return <div className="flex justify-center items-center min-h-screen">Carregando...</div>;
  }

  if (!session) {
    return null;
  }

  const handleSave = () => {
    // Create environment configuration
    let config = `CAMERAS=${cameras}
USERNAME=${username}
PASSWORD=${password}`;

    // Add camera type configuration
    if (cameraType === 'tapo') {
      config += `\nCAMERA_TYPE=tapo`;
      config += `\n# Para câmeras Tapo: stream1 (1080P) ou stream2 (360P)`;
      config += `\n# CAMERA_1_STREAM=${streamType}`;
      config += `\n# CAMERA_2_STREAM=${streamType}`;
    }

    // Copy to clipboard
    if (!navigator.clipboard) {
      setMessage('Recurso de área de transferência não disponível neste navegador. Copie manualmente.');
      return;
    }

    navigator.clipboard.writeText(config)
      .then(() => {
        setMessage('Configuração copiada para a área de transferência! Cole no arquivo .env na raiz do projeto.');
      })
      .catch(() => {
        setMessage('Erro ao copiar para a área de transferência.');
      });
  };

  const handleTest = async () => {
    if (!cameras.trim()) {
      setTestResult('Por favor, adicione pelo menos uma câmera para testar.');
      return;
    }

    setIsTesting(true);
    setTestResult('');

    try {
      const cameraList = cameras.split(',').map(c => c.trim());
      const firstCamera = cameraList[0];
      const [ip, port] = firstCamera.split(':');

      const response = await fetch('/api/cameras/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ip,
          port: port || '554',
          username,
          password,
          path: cameraType === 'tapo' ? `/${streamType}` : '/live/mpeg4',
          cameraType
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        setTestResult('✅ Conexão bem-sucedida! A câmera está funcionando.');
      } else {
        setTestResult(`❌ Erro: ${result.error}`);
      }
    } catch {
      setTestResult('❌ Erro ao testar conexão com a câmera.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-lg p-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Configuração de Câmeras</h1>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Tipo de Câmera
            </label>
            <select
              value={cameraType}
              onChange={(e) => {
                const newType = e.target.value as 'intelbras' | 'tapo';
                setCameraType(newType);
                // Atualizar credenciais padrão baseado no tipo de câmera
                if (newType === 'tapo') {
                  setUsername('admin');
                  setPassword('tapooo888');
                } else {
                  setUsername('admin');
                  setPassword('admin123');
                }
              }}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="intelbras">Intelbras Mibo Cam</option>
              <option value="tapo">TP-Link Tapo</option>
            </select>
            <p className="text-sm text-gray-500 mt-1">
              Selecione o tipo de câmera para usar o formato RTSP correto
            </p>
          </div>

          {cameraType === 'tapo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tipo de Stream (Tapo)
              </label>
              <select
                value={streamType}
                onChange={(e) => setStreamType(e.target.value as 'stream1' | 'stream2')}
                className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="stream1">Stream1 (1080P - 1920x1080)</option>
                <option value="stream2">Stream2 (360P - 640x360)</option>
              </select>
              <p className="text-sm text-gray-500 mt-1">
                Stream1: Alta qualidade (1080P) | Stream2: Baixa qualidade (360P)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endereços das Câmeras (separados por vírgula)
            </label>
            <textarea
              value={cameras}
              onChange={(e) => setCameras(e.target.value)}
              placeholder="Exemplo: 192.168.1.100:554,192.168.1.101:554,192.168.1.102:554"
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
            <p className="text-sm text-gray-500 mt-1">
              Formato: IP:PORTA (ex: 192.168.1.100:554)
            </p>
            {cameraType === 'tapo' && (
              <p className="text-sm text-purple-600 mt-1">
                💡 Para câmeras Tapo: credenciais padrão são admin/tapooo888
              </p>
            )}
            {cameraType === 'intelbras' && (
              <p className="text-sm text-blue-600 mt-1">
                💡 Para câmeras Intelbras: use a chave de acesso como senha
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Usuário
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              className="w-full p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleTest}
              disabled={isTesting}
              className="flex-1 bg-green-600 text-white py-3 px-4 rounded-md hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors disabled:opacity-50"
            >
              {isTesting ? 'Testando...' : 'Testar Conexão'}
            </button>
            
            <button
              onClick={handleSave}
              className="flex-1 bg-blue-600 text-white py-3 px-4 rounded-md hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
            >
              Gerar Configuração
            </button>
          </div>

          {message && (
            <div className="p-4 bg-green-100 border border-green-400 text-green-700 rounded-md">
              {message}
            </div>
          )}

          {testResult && (
            <div className={`p-4 border rounded-md ${
              testResult.includes('✅') 
                ? 'bg-green-100 border-green-400 text-green-700' 
                : 'bg-red-100 border-red-400 text-red-700'
            }`}>
              {testResult}
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-100 border border-yellow-400 text-yellow-700 rounded-md">
            <h3 className="font-semibold mb-2">Instruções:</h3>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Selecione o tipo de câmera (Intelbras ou TP-Link Tapo)</li>
              <li>Para câmeras Tapo, escolha o tipo de stream (1080P ou 360P)</li>
              <li>Preencha os dados das suas câmeras acima</li>
              <li>Clique em &quot;Gerar Configuração&quot;</li>
              <li>Cole o conteúdo copiado em um arquivo chamado <code>.env</code> na raiz do projeto</li>
              <li>Reinicie o servidor para aplicar as configurações</li>
            </ol>
          </div>

          {cameraType === 'tapo' && (
            <div className="mt-4 p-4 bg-purple-100 border border-purple-400 text-purple-700 rounded-md">
              <h3 className="font-semibold mb-2">📹 Informações sobre câmeras TP-Link Tapo:</h3>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li><strong>Stream1:</strong> Resolução 1080P (1920x1080) - Alta qualidade</li>
                <li><strong>Stream2:</strong> Resolução 360P (640x360) - Baixa qualidade</li>
                <li><strong>Credenciais padrão:</strong> admin / tapooo888</li>
                <li>Para Tapo C310, a resolução do stream1 depende da qualidade definida no app</li>
                <li>Certifique-se de que a porta 554 está aberta no roteador para acesso remoto</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfigPage() {
  return (
    <SessionProvider>
      <ConfigPageContent />
    </SessionProvider>
  );
}
