# Correções de Bugs - Sistema de Monitoramento de Câmeras

## Problemas Identificados e Corrigidos

### 1. Problemas de FFmpeg
- **Packets RTP perdidos**: `RTP: missed X packets`
- **Timestamps não monotônicos**: `Non-monotonic DTS`
- **Frames corrompidos**: `corrupt decoded frame`
- **Buffer de áudio**: `Queue input is backward in time`

### 2. Soluções Implementadas

#### Configuração FFmpeg Otimizada
```bash
# Novas configurações para estabilidade:
-fflags +genpts+igndts          # Gerar PTS e ignorar DTS problemáticos
-avoid_negative_ts make_zero    # Evitar timestamps negativos
-copytb 1                       # Copiar timebase
-start_at_zero                  # Começar timestamps em zero
-stimeout 5000000               # Timeout de socket (5 segundos)
-rw_timeout 5000000             # Timeout de leitura/escrita (5 segundos)
```

#### Filtros de Log Melhorados
- Removido spam de logs desnecessários (frame=, fps=, etc.)
- Mantidos apenas logs de erros críticos
- Reduzido nível de log para `warning`

#### Cache Inteligente de Câmeras
- Sistema de retry com contador de tentativas
- Cache estendido para câmeras inacessíveis (90 segundos)
- Evita tentativas excessivas em câmeras offline

#### Configuração HLS Otimizada
- Segmentos reduzidos para 2 segundos
- Buffer reduzido para menor latência
- Modo de baixa latência habilitado
- Mais tentativas de sincronização

## Como Usar as Melhorias

### 1. Limpeza Automática de Streams
```bash
# Limpar arquivos antigos
npm run cleanup

# Verificar uso de disco
npm run cleanup:status
```

### 2. Monitoramento de Logs
Os logs agora são mais limpos e focados em problemas reais:
- Erros de conexão
- Problemas de autenticação
- Timeouts de rede
- Dados inválidos

### 3. Recuperação Automática
- Reconexão automática em caso de falhas
- Recuperação de erros de mídia
- Retry inteligente com backoff

## Configurações Recomendadas

### Para Câmeras com Problemas de Rede
```env
# Aumentar timeouts
RTSP_TIMEOUT=10000000
RECONNECT_DELAY_MAX=5
```

### Para Câmeras com Baixa Qualidade
```env
# Usar stream de baixa qualidade
CAMERA_X_STREAM=stream2
```

### Para Sistemas com Pouco Espaço
```bash
# Executar limpeza regularmente
npm run cleanup
```

## Monitoramento

### Verificar Status das Câmeras
```bash
# Ver logs em tempo real
tail -f logs/streams.log

# Verificar uso de disco
npm run cleanup:status
```

### Logs Importantes
- `streams.log`: Logs de streams e FFmpeg
- `error.log`: Erros críticos do sistema
- `app.log`: Logs gerais da aplicação

## Troubleshooting

### Se uma câmera não conectar:
1. Verificar se o IP está correto
2. Testar conectividade: `ping IP_CAMERA`
3. Verificar credenciais no `.env`
4. Testar RTSP manualmente com VLC

### Se o stream estiver instável:
1. Verificar qualidade da rede
2. Reduzir qualidade do stream
3. Aumentar timeouts
4. Verificar logs de erro

### Se houver muitos arquivos de stream:
1. Executar `npm run cleanup`
2. Configurar limpeza automática
3. Verificar uso de disco

## Próximos Passos

1. **Monitorar logs** após as correções
2. **Ajustar configurações** conforme necessário
3. **Configurar limpeza automática** se necessário
4. **Testar com diferentes câmeras** para validar melhorias

## Contato

Para problemas persistentes, verificar:
- Logs do sistema
- Configurações de rede
- Status das câmeras
- Uso de recursos do servidor






