#!/bin/bash

# Script de inicialização do Sistema de Monitoramento de Câmeras Mibo
# Para macOS

echo "🎥 Sistema de Monitoramento de Câmeras IP Intelbras Mibo"
echo "=================================================="

# Verificar se FFmpeg está instalado
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ FFmpeg não encontrado!"
    echo "📦 Instalando FFmpeg via Homebrew..."
    brew install ffmpeg
    if [ $? -eq 0 ]; then
        echo "✅ FFmpeg instalado com sucesso!"
    else
        echo "❌ Erro ao instalar FFmpeg. Instale manualmente: brew install ffmpeg"
        exit 1
    fi
else
    echo "✅ FFmpeg encontrado: $(ffmpeg -version | head -n1)"
fi

# Verificar se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado!"
    echo "📦 Instalando Node.js via nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
    source ~/.bashrc || source ~/.zshrc
    nvm install 18
    nvm use 18
    if [ $? -eq 0 ]; then
        echo "✅ Node.js instalado com sucesso!"
    else
        echo "❌ Erro ao instalar Node.js. Instale manualmente"
        exit 1
    fi
else
    echo "✅ Node.js encontrado: $(node --version)"
fi

# Verificar se as dependências estão instaladas
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
    if [ $? -eq 0 ]; then
        echo "✅ Dependências instaladas com sucesso!"
    else
        echo "❌ Erro ao instalar dependências"
        exit 1
    fi
else
    echo "✅ Dependências já instaladas"
fi

# Criar diretórios necessários
echo "📁 Criando diretórios necessários..."
mkdir -p public/streams public/recordings logs
echo "✅ Diretórios criados"

# Verificar arquivo de configuração
if [ ! -f ".env.local" ]; then
    echo "⚠️  Arquivo .env.local não encontrado!"
    echo "📝 Criando arquivo de configuração padrão..."
    cat > .env.local << 'EOF'
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here-generate-with-openssl-rand-base64-32
USERNAME=admin
PASSWORD=admin123
CAMERAS=192.168.1.10:554,192.168.1.11:554,192.168.1.12:554,192.168.1.13:554,192.168.1.14:554,192.168.1.15:554,192.168.1.16:554,192.168.1.17:554,192.168.1.18:554,192.168.1.19:554,192.168.1.20:554,192.168.1.21:554,192.168.1.22:554,192.168.1.23:554,192.168.1.24:554,192.168.1.25:554,192.168.1.26:554,192.168.1.27:554,192.168.1.28:554,192.168.1.29:554,192.168.1.30:554,192.168.1.31:554,192.168.1.32:554,192.168.1.33:554,192.168.1.34:554,192.168.1.35:554,192.168.1.36:554,192.168.1.37:554,192.168.1.38:554,192.168.1.39:554,192.168.1.40:554,192.168.1.41:554,192.168.1.42:554,192.168.1.43:554,192.168.1.44:554,192.168.1.45:554
STREAM_PORT=8554
EOF
    echo "✅ Arquivo .env.local criado com configurações padrão"
    echo "⚠️  IMPORTANTE: Edite o arquivo .env.local com os IPs das suas câmeras!"
else
    echo "✅ Arquivo .env.local encontrado"
fi

# Gerar chave secreta se não existir
if grep -q "your-secret-key-here" .env.local; then
    echo "🔐 Gerando chave secreta..."
    SECRET=$(openssl rand -base64 32)
    sed -i '' "s/your-secret-key-here-generate-with-openssl-rand-base64-32/$SECRET/" .env.local
    echo "✅ Chave secreta gerada"
fi

echo ""
echo "🚀 Iniciando servidor de desenvolvimento..."
echo "📱 Acesse: http://localhost:3000"
echo "🔑 Login padrão: admin / admin123"
echo ""
echo "⚠️  Certifique-se de que:"
echo "   - As câmeras estão conectadas na rede"
echo "   - Os IPs no .env.local estão corretos"
echo "   - As credenciais das câmeras estão corretas"
echo ""

# Iniciar servidor
npm run dev
