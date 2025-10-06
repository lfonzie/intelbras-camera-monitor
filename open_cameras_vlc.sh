#!/bin/bash

# Script para abrir todas as câmeras via VLC no Mac
# Autor: Sistema de Monitoramento Intelbras

echo "🎥 Abrindo câmeras via VLC..."
echo "=================================="

# Array com as câmeras descobertas
CAMERAS=(
    "172.16.8.0"
    "172.16.8.206" 
    "172.16.9.238"
    "172.16.15.17"
)

# Credenciais
USERNAME="admin"
PASSWORD="tapooo888"
PORT="554"

# Função para abrir câmera no VLC
open_camera_vlc() {
    local ip=$1
    local camera_name=$2
    local rtsp_url="rtsp://${USERNAME}:${PASSWORD}@${ip}:${PORT}/cam/realmonitor?channel=1&subtype=0"
    
    echo "📹 Abrindo Câmera ${camera_name} (${ip})..."
    
    # Abre VLC com a stream RTSP
    /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
        --intf=macosx \
        --video-title="Câmera ${camera_name} - ${ip}" \
        --no-video-title-show \
        --fullscreen \
        --quiet \
        --no-osd \
        --no-sout-audio \
        --rtsp-tcp \
        --network-caching=1000 \
        --clock-jitter=0 \
        --clock-synchro=0 &
    
    # Pequena pausa entre aberturas
    sleep 2
}

# Verifica se VLC está instalado
if [ ! -d "/Applications/VLC.app" ]; then
    echo "❌ VLC não encontrado em /Applications/VLC.app"
    echo "💡 Instale o VLC: https://www.videolan.org/vlc/download-macos.html"
    exit 1
fi

# Contador de câmeras
camera_count=1

# Abre cada câmera
for ip in "${CAMERAS[@]}"; do
    open_camera_vlc "$ip" "$camera_count"
    camera_count=$((camera_count + 1))
done

echo ""
echo "✅ ${#CAMERAS[@]} câmeras abertas no VLC!"
echo "💡 Dica: Use Cmd+Tab para alternar entre as janelas do VLC"
echo "🔄 Para fechar todas: Cmd+Q em cada janela do VLC"

# Opção para abrir em modo grid (janelas menores)
echo ""
read -p "🎛️  Deseja abrir em modo grid (janelas menores)? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔄 Fechando janelas atuais e abrindo em modo grid..."
    
    # Fecha todas as instâncias do VLC
    pkill -f "VLC"
    sleep 3
    
    # Abre em modo grid (janelas menores)
    camera_count=1
    for ip in "${CAMERAS[@]}"; do
        rtsp_url="rtsp://${USERNAME}:${PASSWORD}@${ip}:${PORT}/cam/realmonitor?channel=1&subtype=0"
        
        echo "📹 Abrindo Câmera ${camera_count} em modo grid..."
        
        /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
            --intf=macosx \
            --video-title="Câmera ${camera_count} - ${ip}" \
            --no-video-title-show \
            --quiet \
            --no-osd \
            --no-sout-audio \
            --rtsp-tcp \
            --network-caching=1000 \
            --width=640 \
            --height=360 &
        
        camera_count=$((camera_count + 1))
        sleep 1
    done
    
    echo "✅ Modo grid ativado! Use Cmd+M para minimizar/maximizar janelas"
fi

echo ""
echo "🎉 Script concluído!"





