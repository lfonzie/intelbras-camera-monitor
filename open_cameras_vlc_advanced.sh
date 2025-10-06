#!/bin/bash

# Script Avançado para abrir câmeras via VLC no Mac
# Inclui opções de layout, qualidade e controle

echo "🎥 Sistema Avançado de Câmeras VLC"
echo "=================================="

# Configurações das câmeras
CAMERAS=(
    "172.16.8.0:Câmera 1"
    "172.16.8.206:Câmera 2" 
    "172.16.9.238:Câmera 3"
    "172.16.15.17:Câmera 4"
)

USERNAME="admin"
PASSWORD="tapooo888"
PORT="554"

# Função para mostrar menu
show_menu() {
    echo ""
    echo "📋 Opções disponíveis:"
    echo "1) 🖥️  Abrir todas em tela cheia"
    echo "2) 📱 Abrir em modo grid (4 janelas)"
    echo "3) 🎯 Abrir câmera específica"
    echo "4) 🔄 Reiniciar todas as câmeras"
    echo "5) ❌ Fechar todas as câmeras"
    echo "6) 📊 Status das câmeras"
    echo "7) 🚪 Sair"
    echo ""
}

# Função para testar conectividade
test_camera() {
    local ip=$1
    local rtsp_url="rtsp://${USERNAME}:${PASSWORD}@${ip}:${PORT}/cam/realmonitor?channel=1&subtype=0"
    
    echo "🔍 Testando ${ip}..."
    
    # Teste rápido com ffprobe
    if ffprobe -v quiet -rtsp_transport tcp -timeout 5000000 -i "${rtsp_url}" 2>/dev/null; then
        echo "✅ ${ip} - Online"
        return 0
    else
        echo "❌ ${ip} - Offline"
        return 1
    fi
}

# Função para abrir câmera específica
open_single_camera() {
    local ip=$1
    local name=$2
    local mode=$3  # fullscreen, grid, window
    
    local rtsp_url="rtsp://${USERNAME}:${PASSWORD}@${ip}:${PORT}/cam/realmonitor?channel=1&subtype=0"
    
    echo "📹 Abrindo ${name} (${ip})..."
    
    case $mode in
        "fullscreen")
            /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
                --intf=macosx \
                --video-title="${name} - ${ip}" \
                --no-video-title-show \
                --fullscreen \
                --quiet \
                --no-osd \
                --no-sout-audio \
                --rtsp-tcp \
                --network-caching=1000 &
            ;;
        "grid")
            /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
                --intf=macosx \
                --video-title="${name} - ${ip}" \
                --no-video-title-show \
                --quiet \
                --no-osd \
                --no-sout-audio \
                --rtsp-tcp \
                --network-caching=1000 \
                --width=640 \
                --height=360 &
            ;;
        "window")
            /Applications/VLC.app/Contents/MacOS/VLC "${rtsp_url}" \
                --intf=macosx \
                --video-title="${name} - ${ip}" \
                --no-video-title-show \
                --quiet \
                --no-osd \
                --no-sout-audio \
                --rtsp-tcp \
                --network-caching=1000 &
            ;;
    esac
}

# Função para abrir todas as câmeras
open_all_cameras() {
    local mode=$1
    
    echo "🔍 Testando conectividade das câmeras..."
    local online_cameras=()
    
    for camera in "${CAMERAS[@]}"; do
        IFS=':' read -r ip name <<< "$camera"
        if test_camera "$ip"; then
            online_cameras+=("$camera")
        fi
    done
    
    if [ ${#online_cameras[@]} -eq 0 ]; then
        echo "❌ Nenhuma câmera online encontrada!"
        return 1
    fi
    
    echo "✅ ${#online_cameras[@]} câmeras online. Abrindo..."
    
    for camera in "${online_cameras[@]}"; do
        IFS=':' read -r ip name <<< "$camera"
        open_single_camera "$ip" "$name" "$mode"
        sleep 1
    done
    
    echo "✅ ${#online_cameras[@]} câmeras abertas!"
}

# Função para fechar todas as câmeras
close_all_cameras() {
    echo "🔄 Fechando todas as instâncias do VLC..."
    pkill -f "VLC"
    sleep 2
    echo "✅ Todas as câmeras fechadas!"
}

# Função para mostrar status
show_status() {
    echo "📊 Status das Câmeras:"
    echo "====================="
    
    for camera in "${CAMERAS[@]}"; do
        IFS=':' read -r ip name <<< "$camera"
        if test_camera "$ip"; then
            echo "✅ ${name} (${ip}) - Online"
        else
            echo "❌ ${name} (${ip}) - Offline"
        fi
    done
}

# Verifica se VLC está instalado
if [ ! -d "/Applications/VLC.app" ]; then
    echo "❌ VLC não encontrado em /Applications/VLC.app"
    echo "💡 Instale o VLC: https://www.videolan.org/vlc/download-macos.html"
    exit 1
fi

# Loop principal
while true; do
    show_menu
    read -p "Escolha uma opção (1-7): " choice
    
    case $choice in
        1)
            close_all_cameras
            open_all_cameras "fullscreen"
            ;;
        2)
            close_all_cameras
            open_all_cameras "grid"
            ;;
        3)
            echo ""
            echo "📋 Câmeras disponíveis:"
            for i in "${!CAMERAS[@]}"; do
                IFS=':' read -r ip name <<< "${CAMERAS[$i]}"
                echo "$((i+1))) ${name} (${ip})"
            done
            echo ""
            read -p "Escolha uma câmera (1-${#CAMERAS[@]}): " cam_choice
            
            if [[ $cam_choice -ge 1 && $cam_choice -le ${#CAMERAS[@]} ]]; then
                IFS=':' read -r ip name <<< "${CAMERAS[$((cam_choice-1))]}"
                if test_camera "$ip"; then
                    open_single_camera "$ip" "$name" "window"
                else
                    echo "❌ Câmera offline!"
                fi
            else
                echo "❌ Opção inválida!"
            fi
            ;;
        4)
            close_all_cameras
            sleep 2
            open_all_cameras "grid"
            ;;
        5)
            close_all_cameras
            ;;
        6)
            show_status
            ;;
        7)
            echo "👋 Saindo..."
            close_all_cameras
            exit 0
            ;;
        *)
            echo "❌ Opção inválida!"
            ;;
    esac
    
    echo ""
    read -p "Pressione Enter para continuar..."
done





