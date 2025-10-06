#!/bin/bash

# Script Rápido - Abre todas as câmeras em grid
# Uso: ./quick_open_cameras.sh

echo "🚀 Abrindo todas as câmeras rapidamente..."

# Câmeras descobertas
CAMERAS=("172.16.8.0" "172.16.8.206" "172.16.9.238" "172.16.15.17")
USERNAME="admin"
PASSWORD="tapooo888"

# Fecha VLC existente
pkill -f "VLC" 2>/dev/null
sleep 1

# Abre cada câmera em janela pequena
for i in "${!CAMERAS[@]}"; do
    ip="${CAMERAS[$i]}"
    camera_num=$((i+1))
    rtsp_url="rtsp://${USERNAME}:${PASSWORD}@${ip}:554/cam/realmonitor?channel=1&subtype=0"
    
    echo "📹 Abrindo Câmera ${camera_num} (${ip})..."
    
    /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
        --intf=macosx \
        --video-title="Câmera ${camera_num}" \
        --no-video-title-show \
        --quiet \
        --no-osd \
        --no-sout-audio \
        --rtsp-tcp \
        --network-caching=1000 \
        --width=640 \
        --height=360 &
    
    sleep 0.5
done

echo "✅ ${#CAMERAS[@]} câmeras abertas em modo grid!"
echo "💡 Use Cmd+Tab para alternar entre as janelas"





