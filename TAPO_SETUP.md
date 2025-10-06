# Configuração de Câmeras TP-Link Tapo

Este documento explica como configurar câmeras TP-Link Tapo no sistema de monitoramento.

## Formatos RTSP Suportados

As câmeras TP-Link Tapo suportam dois streams RTSP:

### Stream1 (Alta Qualidade - 1080P)
- **Resolução:** 1920x1080
- **URL:** `rtsp://username:password@IP:554/stream1`
- **Uso:** Para visualização em alta qualidade

### Stream2 (Baixa Qualidade - 360P)
- **Resolução:** 640x360
- **URL:** `rtsp://username:password@IP:554/stream2`
- **Uso:** Para visualização em baixa qualidade ou quando há limitações de banda

## Configuração

### 1. Credenciais da Câmera

**Credenciais padrão para câmeras TP-Link Tapo:**
- **Usuário:** `admin`
- **Senha:** `tapooo888`

**Para encontrar o IP da câmera:**
1. Abra o app Tapo no seu dispositivo móvel
2. Acesse as configurações da câmera
3. Vá em "Configurações" → "Rede" → "Status da Rede"
4. Anote o endereço IP da câmera

### 2. Configuração no Sistema

#### Opção A: Via Interface Web
1. Acesse a página de configuração (`/config`)
2. Selecione "TP-Link Tapo" como tipo de câmera
3. Escolha o tipo de stream (Stream1 para 1080P ou Stream2 para 360P)
4. Adicione os IPs das câmeras no formato `IP:554`
5. Use as credenciais padrão: `admin` / `tapooo888`
6. Clique em "Gerar Configuração" e copie para o arquivo `.env`

#### Opção B: Configuração Manual no .env

```env
# Configuração para câmeras TP-Link Tapo
CAMERA_TYPE=tapo
CAMERAS=192.168.1.100:554,192.168.1.101:554,192.168.1.102:554
USERNAME=admin
PASSWORD=tapooo888

# Configuração específica por câmera (opcional)
CAMERA_1_STREAM=stream1  # 1080P
CAMERA_2_STREAM=stream2  # 360P
CAMERA_3_STREAM=stream1  # 1080P
```

### 3. Configuração de Rede

Para acesso remoto às câmeras Tapo:

1. **Abrir Porta 554 no Roteador:**
   - Acesse as configurações do roteador
   - Configure port forwarding para a porta 554
   - Redirecione para o IP da câmera

2. **Verificar Conectividade:**
   - Certifique-se de que o computador/NAS/NVR e a câmera estão na mesma rede
   - Ou configure acesso via IP público da câmera

## Modelos Suportados

- **Tapo C310:** A resolução do stream1 é determinada pela qualidade definida no app Tapo
- **Tapo C200:** Suporta ambos os streams
- **Tapo C100:** Suporta ambos os streams
- **Outros modelos Tapo:** Consulte a documentação específica do modelo

## Solução de Problemas

### Erro 401 Unauthorized
- Verifique se as credenciais estão corretas
- Confirme se a conta do dispositivo está ativa no app Tapo

### Erro 404 Not Found
- Verifique se o RTSP está habilitado na câmera
- Tente alternar entre `/stream1` e `/stream2`

### Erro Connection Refused
- Verifique se o IP e porta estão corretos
- Confirme se a câmera está online e acessível na rede

### Erro Connection Timeout
- Verifique a conectividade de rede
- Confirme se a porta 554 não está bloqueada por firewall

## Descoberta Automática

O sistema inclui descoberta automática de câmeras Tapo:

1. Acesse a página de descoberta (`/discover`)
2. Configure a faixa de rede onde estão as câmeras
3. Use as credenciais padrão: `admin` / `tapooo888`
4. Clique em "Iniciar Descoberta"
5. O sistema irá testar automaticamente os formatos `/stream1` e `/stream2`

## Notas Importantes

1. **Credenciais:** Use as credenciais padrão `admin` / `tapooo888` para câmeras TP-Link Tapo
2. **Qualidade:** Para o Tapo C310, a resolução do stream1 depende da qualidade configurada no app
3. **Rede:** Certifique-se de que todos os dispositivos estão na mesma rede ou configurados para acesso remoto
4. **Porta:** A porta 554 deve estar acessível para funcionamento do RTSP
5. **ONVIF:** As câmeras Tapo também suportam ONVIF para integração com sistemas NVR/NAS

## Exemplo de Configuração Completa

```env
# Configuração para 3 câmeras Tapo
CAMERA_TYPE=tapo
CAMERAS=192.168.1.100:554,192.168.1.101:554,192.168.1.102:554
USERNAME=admin
PASSWORD=tapooo888

# Configuração específica de streams
CAMERA_1_STREAM=stream1  # Câmera 1: 1080P
CAMERA_2_STREAM=stream2  # Câmera 2: 360P (para economizar banda)
CAMERA_3_STREAM=stream1  # Câmera 3: 1080P
```

Após configurar, reinicie o servidor para aplicar as mudanças.
