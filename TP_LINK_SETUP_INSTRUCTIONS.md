# Configuração para Câmeras TP-Link Tapo

## IPs das Câmeras
- **Câmera 1:** 172.16.15.36
- **Câmera 2:** 172.16.10.28  
- **Câmera 3:** 172.16.13.82

## Configuração Rápida

### Opção 1: Via Interface Web
1. Acesse `http://localhost:3000/config`
2. Selecione "TP-Link Tapo" como tipo de câmera
3. As credenciais `admin`/`tapooo888` serão preenchidas automaticamente
4. Cole os IPs no campo "Endereços das Câmeras":
   ```
   172.16.15.36:554,172.16.10.28:554,172.16.13.82:554
   ```
5. Escolha o tipo de stream (Stream1 para 1080P ou Stream2 para 360P)
6. Clique em "Gerar Configuração"
7. Copie o conteúdo para o arquivo `.env` na raiz do projeto

### Opção 2: Configuração Manual
1. Crie ou edite o arquivo `.env` na raiz do projeto
2. Cole o seguinte conteúdo:

```env
CAMERA_TYPE=tapo
CAMERAS=172.16.15.36:554,172.16.10.28:554,172.16.13.82:554
USERNAME=admin
PASSWORD=tapooo888
```

3. Reinicie o servidor para aplicar as configurações

## Teste de Conectividade

### Via Interface Web
1. Acesse `http://localhost:3000/config`
2. Configure as câmeras como descrito acima
3. Clique em "Testar Conexão" para verificar se as câmeras estão acessíveis

### Via Descoberta Automática
1. Acesse `http://localhost:3000/discover`
2. Configure a rede para escanear: `172.16.10.1-172.16.15.254`
3. Use as credenciais: `admin` / `tapooo888`
4. Clique em "Iniciar Descoberta"

## URLs RTSP das Câmeras

### Stream1 (1080P - Alta Qualidade)
- **Câmera 1:** `rtsp://admin:tapooo888@172.16.15.36:554/stream1`
- **Câmera 2:** `rtsp://admin:tapooo888@172.16.10.28:554/stream1`
- **Câmera 3:** `rtsp://admin:tapooo888@172.16.13.82:554/stream1`

### Stream2 (360P - Baixa Qualidade)
- **Câmera 1:** `rtsp://admin:tapooo888@172.16.15.36:554/stream2`
- **Câmera 2:** `rtsp://admin:tapooo888@172.16.10.28:554/stream2`
- **Câmera 3:** `rtsp://admin:tapooo888@172.16.13.82:554/stream2`

## Configuração Avançada

### Para Configurar Streams Específicos por Câmera
Adicione ao arquivo `.env`:

```env
# Configuração básica
CAMERA_TYPE=tapo
CAMERAS=172.16.15.36:554,172.16.10.28:554,172.16.13.82:554
USERNAME=admin
PASSWORD=tapooo888

# Configuração específica de streams
CAMERA_1_STREAM=stream1  # 172.16.15.36 - 1080P
CAMERA_2_STREAM=stream1  # 172.16.10.28 - 1080P
CAMERA_3_STREAM=stream2  # 172.16.13.82 - 360P
```

### Para Economizar Banda (Todos em 360P)
```env
CAMERA_TYPE=tapo
CAMERAS=172.16.15.36:554,172.16.10.28:554,172.16.13.82:554
USERNAME=admin
PASSWORD=tapooo888

# Todos os streams em baixa qualidade
CAMERA_1_STREAM=stream2
CAMERA_2_STREAM=stream2
CAMERA_3_STREAM=stream2
```

## Verificação

Após configurar:
1. Reinicie o servidor: `npm run dev` ou `yarn dev`
2. Acesse `http://localhost:3000`
3. Faça login no sistema
4. Verifique se as 3 câmeras aparecem na grade
5. Teste a reprodução de cada stream

## Solução de Problemas

### Se uma câmera não aparecer:
1. Verifique se o IP está correto
2. Teste a conectividade: `ping 172.16.15.36`
3. Verifique se a porta 554 está aberta
4. Teste o RTSP manualmente com VLC

### Se o stream não carregar:
1. Verifique as credenciais `admin`/`tapooo888`
2. Teste alternando entre `/stream1` e `/stream2`
3. Verifique se o RTSP está habilitado na câmera
4. Confirme se a câmera está online

### Para testar RTSP manualmente:
```bash
# Teste com ffprobe
ffprobe -v quiet -rtsp_transport tcp -i "rtsp://admin:tapooo888@172.16.15.36:554/stream1"

# Teste com VLC
vlc "rtsp://admin:tapooo888@172.16.15.36:554/stream1"
```

## Próximos Passos

1. Configure o arquivo `.env` com os IPs fornecidos
2. Reinicie o servidor
3. Acesse o sistema e verifique as câmeras
4. Configure gravação se necessário
5. Ajuste a qualidade dos streams conforme necessário






