# Sistema de Monitoramento de Câmeras IP Intelbras Mibo

## 🎥 Descrição
Sistema web completo para monitoramento de 35 câmeras IP Intelbras Mibo, desenvolvido em Next.js com TypeScript. O sistema converte streams RTSP para HLS para reprodução no navegador, inclui autenticação, gravação e monitoramento em tempo real.

## ✨ Funcionalidades Implementadas

### ✅ Core Features
- **Autenticação Segura**: Login com NextAuth.js e JWT
- **Streaming RTSP → HLS**: Conversão em tempo real com FFmpeg
- **Interface Responsiva**: Grade adaptável para 35 câmeras
- **Sistema de Gravação**: Gravação de vídeos das câmeras
- **Logs Estruturados**: Sistema completo de logging com Winston
- **Monitoramento**: Status em tempo real das câmeras
- **Controles**: Tamanhos de grade configuráveis

### 🔄 Funcionalidades Avançadas (Para Expansão)
- **Detecção de Movimento**: Integração com OpenCV.js
- **Notificações**: WebSockets para alertas em tempo real
- **Dashboard Administrativo**: Métricas e estatísticas
- **Backup Automático**: Rotação de logs e arquivos
- **Integração LDAP**: Autenticação corporativa

## 🚀 Início Rápido

### Pré-requisitos macOS
```bash
# Instalar Xcode Command Line Tools
xcode-select --install

# Instalar Homebrew (se não tiver)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Instalar FFmpeg
brew install ffmpeg

# Instalar Node.js 18+ (recomendado usar nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### Instalação e Execução
```bash
# 1. Navegar para o diretório do projeto
cd /Users/lf/Documents/CAM/camera-viewer

# 2. Executar script de inicialização automática
./start.sh

# OU executar manualmente:
npm install
npm run dev
```

### Acesso
- **URL**: http://localhost:3000
- **Login**: admin
- **Senha**: admin123

## ⚙️ Configuração

### Arquivo .env.local
```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=sua_chave_secreta_aqui
USERNAME=admin
PASSWORD=sua_senha_das_cameras
CAMERAS=192.168.1.10:554,192.168.1.11:554,192.168.1.12:554,...
STREAM_PORT=8554
```

### Configuração das Câmeras Intelbras Mibo
- **Protocolo**: RTSP
- **URL Padrão**: `rtsp://admin:SENHA@IP:554/live/mpeg4`
- **Resolução**: 1920x1080 (Full HD)
- **Codec**: H.264

## 📁 Estrutura do Projeto

```
camera-viewer/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts    # Autenticação
│   │   │   ├── streams/[id]/route.ts          # API de streams
│   │   │   └── record/[id]/route.ts           # API de gravação
│   │   ├── auth/signin/page.tsx               # Página de login
│   │   ├── layout.tsx                         # Layout principal
│   │   └── page.tsx                           # Página inicial
│   ├── components/
│   │   ├── Camera.tsx                         # Componente de câmera
│   │   └── CameraGrid.tsx                     # Grade de câmeras
│   └── lib/
│       └── logger.ts                          # Configuração de logs
├── public/
│   ├── streams/                               # Arquivos HLS
│   └── recordings/                            # Vídeos gravados
├── logs/                                      # Arquivos de log
├── start.sh                                  # Script de inicialização
└── .env.local                                # Variáveis de ambiente
```

## 🔌 APIs Disponíveis

### Streams
- `GET /api/streams/[id]` - Iniciar stream da câmera
- `DELETE /api/streams/[id]` - Parar stream da câmera

### Gravação
- `POST /api/record/[id]` - Iniciar/parar gravação
- `GET /api/record/[id]` - Status da gravação

### Autenticação
- `POST /api/auth/signin` - Login
- `POST /api/auth/signout` - Logout

## 📊 Monitoramento

### Status das Câmeras
- 🟢 **Verde**: Stream ativo e funcionando
- 🟡 **Amarelo**: Conectando
- 🔴 **Vermelho**: Erro de conexão
- ⚪ **Cinza**: Desconectado

### Logs
Os logs são salvos em:
- `logs/app.log` - Log geral da aplicação
- `logs/error.log` - Logs de erro
- `logs/streams.log` - Logs de streaming
- `logs/auth.log` - Logs de autenticação
- `logs/recording.log` - Logs de gravação

## 🔧 Troubleshooting

### Problemas Comuns

1. **FFmpeg não encontrado**:
```bash
brew install ffmpeg
which ffmpeg
```

2. **Erro de permissão nos logs**:
```bash
chmod 755 logs/
```

3. **Câmera não conecta**:
- Verificar IP e porta
- Testar com VLC: `vlc rtsp://admin:SENHA@IP:554/live/mpeg4`
- Verificar credenciais

4. **Alto uso de CPU**:
- Reduzir qualidade do stream
- Ajustar configurações FFmpeg
- Usar preset mais rápido

### Comandos Úteis

```bash
# Verificar processos FFmpeg
ps aux | grep ffmpeg

# Monitorar logs em tempo real
tail -f logs/streams.log

# Testar conexão RTSP
ffmpeg -i rtsp://admin:SENHA@IP:554/live/mpeg4 -t 10 -f null -

# Verificar portas em uso
lsof -i :3000
```

## 🔒 Segurança

### Recomendações
- Use HTTPS em produção
- Configure firewall adequadamente
- Implemente rate limiting
- Use senhas fortes
- Mantenha logs de auditoria

### Variáveis Sensíveis
- `NEXTAUTH_SECRET`: Gere com `openssl rand -base64 32`
- `PASSWORD`: Use senha forte para as câmeras
- `USERNAME`: Evite usar 'admin' padrão

## ⚡ Performance

### Otimizações Implementadas
- Buffer HLS reduzido (2 segundos)
- Preset FFmpeg 'ultrafast'
- Segmentos HLS pequenos (3 segmentos)
- Limpeza automática de arquivos antigos

### Monitoramento de Recursos
```bash
# CPU e memória
htop

# Disco
df -h

# Rede
netstat -i
```

## 🆘 Suporte

Para problemas ou dúvidas:
1. Verifique os logs em `logs/`
2. Consulte a documentação das câmeras Intelbras
3. Teste conectividade RTSP com VLC
4. Verifique configurações de rede

## 📄 Licença

Este projeto é para uso interno do colégio. Não redistribuir sem autorização.

---

## 🎯 Próximos Passos

1. **Configurar as câmeras**: Edite o arquivo `.env.local` com os IPs reais
2. **Testar conectividade**: Use VLC para testar cada câmera
3. **Personalizar**: Ajuste configurações conforme necessário
4. **Monitorar**: Acompanhe os logs para identificar problemas
5. **Expandir**: Implemente funcionalidades avançadas conforme necessário

**Sistema pronto para uso! 🚀**