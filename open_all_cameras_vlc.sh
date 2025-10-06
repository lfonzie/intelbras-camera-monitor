#!/bin/bash

# =============================================================================
# Script Avançado para Abrir Todas as Câmeras no VLC
# Sistema de Monitoramento Intelbras - Versão 2.0
# =============================================================================

set -e  # Exit on any error

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Configurações padrão
DEFAULT_USERNAME="admin"
DEFAULT_PASSWORD="tapooo888"
DEFAULT_PORT="554"
DEFAULT_NETWORK_RANGE="172.16.0.2-172.16.15.254"

# Arrays para armazenar câmeras
DISCOVERED_CAMERAS=()
ONLINE_CAMERAS=()

# Função para mostrar banner
show_banner() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                🎥 SISTEMA DE CÂMERAS VLC 2.0                ║"
    echo "║              Monitoramento Intelbras Avançado               ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Função para mostrar ajuda
show_help() {
    echo -e "${WHITE}Uso: $0 [OPÇÕES]${NC}"
    echo ""
    echo -e "${YELLOW}Opções:${NC}"
    echo "  -h, --help              Mostra esta ajuda"
    echo "  -d, --discover          Descobrir câmeras automaticamente"
    echo "  -u, --username USER     Username para autenticação (padrão: admin)"
    echo "  -p, --password PASS     Password para autenticação (padrão: tapooo888)"
    echo "  -n, --network RANGE     Range de rede para scan (padrão: 172.16.0.2-172.16.15.254)"
    echo "  -l, --layout LAYOUT     Layout: grid, fullscreen, window (padrão: grid)"
    echo "  -c, --close             Fechar todas as instâncias do VLC"
    echo "  -s, --status            Mostrar status das câmeras"
    echo "  -t, --test              Testar conectividade das câmeras"
    echo "  --no-discovery          Usar câmeras hardcoded (não descobrir)"
    echo ""
    echo -e "${YELLOW}Exemplos:${NC}"
    echo "  $0                               # Descobrir e abrir em grid automático (padrão)"
    echo "  $0 -d                            # Descobrir e abrir em grid automático"
    echo "  $0 -d -l fullscreen              # Descobrir e abrir em tela cheia"
    echo "  $0 --no-discovery                # Usar câmeras hardcoded em grid automático"
    echo "  $0 -c                            # Fechar todas as câmeras"
    echo "  $0 -s                            # Mostrar status"
    echo ""
}

# Função para verificar dependências
check_dependencies() {
    local missing_deps=()
    
    # Verificar VLC
    if [ ! -d "/Applications/VLC.app" ]; then
        missing_deps+=("VLC")
    fi
    
    # Verificar ffprobe (para teste de conectividade)
    if ! command -v ffprobe &> /dev/null; then
        missing_deps+=("ffprobe (ffmpeg)")
    fi
    
    # Verificar Python3 (para descoberta)
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("python3")
    fi
    
    if [ ${#missing_deps[@]} -gt 0 ]; then
        echo -e "${RED}❌ Dependências faltando:${NC}"
        for dep in "${missing_deps[@]}"; do
            echo -e "   • ${dep}"
        done
        echo ""
        echo -e "${YELLOW}💡 Instale as dependências:${NC}"
        echo "   • VLC: https://www.videolan.org/vlc/download-macos.html"
        echo "   • ffmpeg: brew install ffmpeg"
        echo "   • Python3: brew install python3"
        exit 1
    fi
}

# Função para descobrir câmeras
discover_cameras() {
    local username="$1"
    local password="$2"
    local network_range="$3"
    
    echo -e "${BLUE}🔍 Descobrindo câmeras na rede...${NC}"
    echo -e "${CYAN}   Rede: ${network_range}${NC}"
    echo -e "${CYAN}   Usuário: ${username}${NC}"
    echo ""
    
    # Executar script Python de descoberta
    local script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    local python_script="${script_dir}/discover_cameras.py"
    
    if [ ! -f "$python_script" ]; then
        echo -e "${RED}❌ Script de descoberta não encontrado: $python_script${NC}"
        return 1
    fi
    
    # Parse do range de rede
    local start_ip=$(echo "$network_range" | cut -d'-' -f1)
    local end_ip=$(echo "$network_range" | cut -d'-' -f2)
    
    local start_parts=($(echo "$start_ip" | tr '.' ' '))
    local end_parts=($(echo "$end_ip" | tr '.' ' '))
    
    local network_base="${start_parts[0]}.${start_parts[1]}.${start_parts[2]}"
    local start_range="${start_parts[3]}"
    local end_range="${end_parts[3]}"
    
    # Executar descoberta
    local output
    if output=$(NETWORK_BASE="$network_base" START_RANGE="$start_range" END_RANGE="$end_range" USERNAME="$username" PASSWORD="$password" python3 "$python_script" 2>&1); then
        # Parse da saída para extrair IPs das câmeras
        while IFS= read -r line; do
            if [[ $line == *"CÂMERA ENCONTRADA:"* ]] || [[ $line == *"✓ Câmera encontrada:"* ]]; then
                local ip=$(echo "$line" | grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' | head -1)
                if [ -n "$ip" ]; then
                    DISCOVERED_CAMERAS+=("$ip")
                fi
            fi
        done <<< "$output"
        
        if [ ${#DISCOVERED_CAMERAS[@]} -gt 0 ]; then
            echo -e "${GREEN}✅ ${#DISCOVERED_CAMERAS[@]} câmera(s) descoberta(s):${NC}"
            for i in "${!DISCOVERED_CAMERAS[@]}"; do
                echo -e "   ${GREEN}•${NC} Câmera $((i+1)): ${DISCOVERED_CAMERAS[$i]}"
            done
            return 0
        else
            echo -e "${YELLOW}⚠️  Nenhuma câmera descoberta automaticamente${NC}"
            return 1
        fi
    else
        echo -e "${RED}❌ Erro na descoberta de câmeras${NC}"
        echo "$output"
        return 1
    fi
}

# Função para usar câmeras hardcoded
use_hardcoded_cameras() {
    echo -e "${BLUE}📋 Usando câmeras configuradas...${NC}"
    
    # Câmeras descobertas anteriormente
    DISCOVERED_CAMERAS=(
        "172.16.8.0"
        "172.16.8.206"
        "172.16.9.238"
        "172.16.15.17"
    )
    
    echo -e "${GREEN}✅ ${#DISCOVERED_CAMERAS[@]} câmera(s) configurada(s):${NC}"
    for i in "${!DISCOVERED_CAMERAS[@]}"; do
        echo -e "   ${GREEN}•${NC} Câmera $((i+1)): ${DISCOVERED_CAMERAS[$i]}"
    done
}

# Função para testar conectividade de uma câmera
test_camera_connectivity() {
    local ip="$1"
    local username="$2"
    local password="$3"
    local port="$4"
    
    # Usar stream SD (subtype=1) para janelas menores
    local rtsp_url="rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=1&subtype=1"
    
    if ffprobe -v quiet -rtsp_transport tcp -timeout 5000000 -i "$rtsp_url" 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Função para testar todas as câmeras
test_all_cameras() {
    local username="$1"
    local password="$2"
    local port="$3"
    
    echo -e "${BLUE}🔍 Testando conectividade das câmeras...${NC}"
    echo ""
    
    ONLINE_CAMERAS=()
    
    for i in "${!DISCOVERED_CAMERAS[@]}"; do
        local ip="${DISCOVERED_CAMERAS[$i]}"
        local camera_num=$((i+1))
        
        echo -n -e "${CYAN}   Testando Câmera ${camera_num} (${ip})...${NC} "
        
        if test_camera_connectivity "$ip" "$username" "$password" "$port"; then
            echo -e "${GREEN}✅ Online${NC}"
            ONLINE_CAMERAS+=("$ip")
        else
            echo -e "${RED}❌ Offline${NC}"
        fi
    done
    
    echo ""
    if [ ${#ONLINE_CAMERAS[@]} -gt 0 ]; then
        echo -e "${GREEN}✅ ${#ONLINE_CAMERAS[@]} câmera(s) online${NC}"
        return 0
    else
        echo -e "${RED}❌ Nenhuma câmera online${NC}"
        return 1
    fi
}

# Função para calcular posições do grid
calculate_grid_positions() {
    local total_cameras="$1"
    local screen_width="$2"
    local screen_height="$3"
    local window_width="$4"
    local window_height="$5"
    
    # Calcular número de colunas e linhas para formar um grid
    local cols
    local rows
    
    if [ "$total_cameras" -le 1 ]; then
        cols=1
        rows=1
    elif [ "$total_cameras" -le 4 ]; then
        cols=2
        rows=2
    elif [ "$total_cameras" -le 6 ]; then
        cols=3
        rows=2
    elif [ "$total_cameras" -le 9 ]; then
        cols=3
        rows=3
    elif [ "$total_cameras" -le 12 ]; then
        cols=4
        rows=3
    elif [ "$total_cameras" -le 16 ]; then
        cols=4
        rows=4
    elif [ "$total_cameras" -le 20 ]; then
        cols=5
        rows=4
    elif [ "$total_cameras" -le 25 ]; then
        cols=5
        rows=5
    else
        cols=6
        rows=$(( (total_cameras + 5) / 6 ))
    fi
    
    # Calcular espaçamento (menor para caber mais câmeras)
    local horizontal_spacing=5
    local vertical_spacing=5
    
    # Calcular posição centralizada
    local total_width=$((cols * window_width + (cols - 1) * horizontal_spacing))
    local total_height=$((rows * window_height + (rows - 1) * vertical_spacing))
    
    local start_x=$(( (screen_width - total_width) / 2 ))
    local start_y=$(( (screen_height - total_height) / 2 ))
    
    # Garantir que não saia da tela
    if [ "$start_x" -lt 0 ]; then start_x=0; fi
    if [ "$start_y" -lt 0 ]; then start_y=0; fi
    
    echo "$cols $rows $start_x $start_y $horizontal_spacing $vertical_spacing"
}

# Função para obter dimensões da tela
get_screen_dimensions() {
    # Usar system_profiler para obter resolução da tela principal
    local resolution=$(system_profiler SPDisplaysDataType | grep Resolution | head -1 | awk '{print $2, $4}')
    local width=$(echo "$resolution" | awk '{print $1}')
    local height=$(echo "$resolution" | awk '{print $2}')
    
    # Valores padrão se não conseguir detectar
    if [ -z "$width" ] || [ -z "$height" ]; then
        width=1920
        height=1080
    fi
    
    echo "$width $height"
}

# Função para abrir uma câmera no VLC com posição específica
open_camera_vlc() {
    local ip="$1"
    local camera_name="$2"
    local layout="$3"
    local username="$4"
    local password="$5"
    local port="$6"
    local x_pos="$7"
    local y_pos="$8"
    local width="$9"
    local height="${10}"
    
    # Usar stream SD (subtype=1) para janelas menores
    local rtsp_url="rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=1&subtype=1"
    
    case "$layout" in
        "fullscreen")
            /Applications/VLC.app/Contents/MacOS/VLC "$rtsp_url" \
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
            ;;
        "grid")
            /Applications/VLC.app/Contents/MacOS/VLC "$rtsp_url" \
                --intf=macosx \
                --video-title="Câmera ${camera_name} - ${ip}" \
                --no-video-title-show \
                --quiet \
                --no-osd \
                --no-sout-audio \
                --rtsp-tcp \
                --network-caching=1000 \
                --width="$width" \
                --height="$height" \
                --video-x="$x_pos" \
                --video-y="$y_pos" \
                --no-embedded-video \
                --no-video-deco &
            ;;
        "window")
            /Applications/VLC.app/Contents/MacOS/VLC "$rtsp_url" \
                --intf=macosx \
                --video-title="Câmera ${camera_name} - ${ip}" \
                --no-video-title-show \
                --quiet \
                --no-osd \
                --no-sout-audio \
                --rtsp-tcp \
                --network-caching=1000 \
                --width="$width" \
                --height="$height" \
                --video-x="$x_pos" \
                --video-y="$y_pos" &
            ;;
    esac
}

# Função para abrir todas as câmeras
open_all_cameras() {
    local layout="$1"
    local username="$2"
    local password="$3"
    local port="$4"
    
    local cameras_to_open=()
    
    # Usar câmeras online se disponíveis, senão usar todas descobertas
    if [ ${#ONLINE_CAMERAS[@]} -gt 0 ]; then
        cameras_to_open=("${ONLINE_CAMERAS[@]}")
        echo -e "${GREEN}🎥 Abrindo ${#ONLINE_CAMERAS[@]} câmera(s) online em modo ${layout}...${NC}"
    else
        cameras_to_open=("${DISCOVERED_CAMERAS[@]}")
        echo -e "${YELLOW}🎥 Abrindo ${#DISCOVERED_CAMERAS[@]} câmera(s) em modo ${layout} (sem teste de conectividade)...${NC}"
    fi
    
    echo ""
    
    # Configurações de janela para grid (menores para caber mais câmeras)
    local window_width=400
    local window_height=300
    
    if [ "$layout" = "grid" ] || [ "$layout" = "window" ]; then
        # Obter dimensões da tela
        local screen_dims
        screen_dims=$(get_screen_dimensions)
        local screen_width=$(echo "$screen_dims" | awk '{print $1}')
        local screen_height=$(echo "$screen_dims" | awk '{print $2}')
        
        echo -e "${BLUE}📐 Configurando grid para ${#cameras_to_open[@]} câmera(s)...${NC}"
        echo -e "${CYAN}   Resolução da tela: ${screen_width}x${screen_height}${NC}"
        echo -e "${CYAN}   Tamanho das janelas: ${window_width}x${window_height}${NC}"
        
        # Calcular posições do grid
        local grid_info
        grid_info=$(calculate_grid_positions "${#cameras_to_open[@]}" "$screen_width" "$screen_height" "$window_width" "$window_height")
        local cols=$(echo "$grid_info" | awk '{print $1}')
        local rows=$(echo "$grid_info" | awk '{print $2}')
        local start_x=$(echo "$grid_info" | awk '{print $3}')
        local start_y=$(echo "$grid_info" | awk '{print $4}')
        local h_spacing=$(echo "$grid_info" | awk '{print $5}')
        local v_spacing=$(echo "$grid_info" | awk '{print $6}')
        
        echo -e "${CYAN}   Grid: ${cols}x${rows} (${cols} colunas, ${rows} linhas)${NC}"
        echo -e "${CYAN}   Posição inicial: (${start_x}, ${start_y})${NC}"
        echo ""
        
        # Abrir câmeras em posições calculadas
        for i in "${!cameras_to_open[@]}"; do
            local ip="${cameras_to_open[$i]}"
            local camera_num=$((i+1))
            
            # Calcular posição no grid
            local col=$((i % cols))
            local row=$((i / cols))
            local x_pos=$((start_x + col * (window_width + h_spacing)))
            local y_pos=$((start_y + row * (window_height + v_spacing)))
            
            echo -e "${CYAN}📹 Abrindo Câmera ${camera_num} (${ip}) em posição (${x_pos}, ${y_pos})...${NC}"
            open_camera_vlc "$ip" "$camera_num" "$layout" "$username" "$password" "$port" "$x_pos" "$y_pos" "$window_width" "$window_height"
            
            # Pequena pausa entre aberturas
            sleep 0.5
        done
    else
        # Para fullscreen, abrir normalmente
        for i in "${!cameras_to_open[@]}"; do
            local ip="${cameras_to_open[$i]}"
            local camera_num=$((i+1))
            
            echo -e "${CYAN}📹 Abrindo Câmera ${camera_num} (${ip})...${NC}"
            open_camera_vlc "$ip" "$camera_num" "$layout" "$username" "$password" "$port" "0" "0" "$window_width" "$window_height"
            
            # Pequena pausa entre aberturas
            sleep 0.5
        done
    fi
    
    echo ""
    echo -e "${GREEN}✅ ${#cameras_to_open[@]} câmera(s) aberta(s) no VLC!${NC}"
    
    # Dicas de uso
    case "$layout" in
        "fullscreen")
            echo -e "${YELLOW}💡 Dicas:${NC}"
            echo -e "   • Use ${WHITE}Cmd+Tab${NC} para alternar entre as janelas do VLC"
            echo -e "   • Use ${WHITE}Esc${NC} para sair do modo tela cheia"
            echo -e "   • Use ${WHITE}Cmd+Q${NC} para fechar cada janela"
            ;;
        "grid")
            echo -e "${YELLOW}💡 Dicas:${NC}"
            echo -e "   • Grid automático formado com ${#cameras_to_open[@]} câmera(s)"
            echo -e "   • Use ${WHITE}Cmd+M${NC} para minimizar/maximizar janelas"
            echo -e "   • Use ${WHITE}Cmd+Tab${NC} para alternar entre as janelas"
            echo -e "   • Arraste as janelas para reorganizar se necessário"
            ;;
        "window")
            echo -e "${YELLOW}💡 Dicas:${NC}"
            echo -e "   • Janelas posicionadas automaticamente"
            echo -e "   • Redimensione as janelas conforme necessário"
            echo -e "   • Use ${WHITE}Cmd+Tab${NC} para alternar entre as janelas"
            echo -e "   • Arraste as janelas para organizar o layout"
            ;;
    esac
}

# Função para fechar todas as câmeras
close_all_cameras() {
    echo -e "${BLUE}🔄 Fechando todas as instâncias do VLC...${NC}"
    
    # Tentar fechar graciosamente primeiro
    pkill -f "VLC" 2>/dev/null || true
    sleep 2
    
    # Forçar fechamento se ainda estiver rodando
    pkill -9 -f "VLC" 2>/dev/null || true
    sleep 1
    
    echo -e "${GREEN}✅ Todas as câmeras fechadas!${NC}"
}

# Função para mostrar status
show_status() {
    echo -e "${BLUE}📊 Status das Câmeras${NC}"
    echo -e "${CYAN}=====================${NC}"
    echo ""
    
    if [ ${#DISCOVERED_CAMERAS[@]} -eq 0 ]; then
        echo -e "${YELLOW}⚠️  Nenhuma câmera descoberta${NC}"
        return
    fi
    
    for i in "${!DISCOVERED_CAMERAS[@]}"; do
        local ip="${DISCOVERED_CAMERAS[$i]}"
        local camera_num=$((i+1))
        
        echo -n -e "${CYAN}Câmera ${camera_num} (${ip}):${NC} "
        
        if test_camera_connectivity "$ip" "$DEFAULT_USERNAME" "$DEFAULT_PASSWORD" "$DEFAULT_PORT"; then
            echo -e "${GREEN}✅ Online${NC}"
        else
            echo -e "${RED}❌ Offline${NC}"
        fi
    done
    
    echo ""
    echo -e "${CYAN}Total: ${#DISCOVERED_CAMERAS[@]} câmera(s)${NC}"
}

# Função principal
main() {
    local discover=false
    local username="$DEFAULT_USERNAME"
    local password="$DEFAULT_PASSWORD"
    local network_range="$DEFAULT_NETWORK_RANGE"
    local layout="grid"  # Default to grid for automatic formation
    local close_only=false
    local status_only=false
    local test_only=false
    local no_discovery=false
    
    # Parse argumentos
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -d|--discover)
                discover=true
                shift
                ;;
            -u|--username)
                username="$2"
                shift 2
                ;;
            -p|--password)
                password="$2"
                shift 2
                ;;
            -n|--network)
                network_range="$2"
                shift 2
                ;;
            -l|--layout)
                layout="$2"
                if [[ ! "$layout" =~ ^(grid|fullscreen|window)$ ]]; then
                    echo -e "${RED}❌ Layout inválido: $layout${NC}"
                    echo -e "${YELLOW}   Layouts válidos: grid, fullscreen, window${NC}"
                    exit 1
                fi
                shift 2
                ;;
            -c|--close)
                close_only=true
                shift
                ;;
            -s|--status)
                status_only=true
                shift
                ;;
            -t|--test)
                test_only=true
                shift
                ;;
            --no-discovery)
                no_discovery=true
                shift
                ;;
            *)
                echo -e "${RED}❌ Opção desconhecida: $1${NC}"
                show_help
                exit 1
                ;;
        esac
    done
    
    # Verificar dependências
    check_dependencies
    
    # Mostrar banner
    show_banner
    
    # Fechar câmeras se solicitado
    if [ "$close_only" = true ]; then
        close_all_cameras
        exit 0
    fi
    
    # Mostrar status se solicitado
    if [ "$status_only" = true ]; then
        if [ "$no_discovery" = true ]; then
            use_hardcoded_cameras
        else
            if ! discover_cameras "$username" "$password" "$network_range"; then
                use_hardcoded_cameras
            fi
        fi
        show_status
        exit 0
    fi
    
    # Descobrir ou usar câmeras hardcoded
    if [ "$no_discovery" = true ]; then
        use_hardcoded_cameras
    elif [ "$discover" = true ]; then
        if ! discover_cameras "$username" "$password" "$network_range"; then
            echo -e "${YELLOW}⚠️  Usando câmeras configuradas como fallback...${NC}"
            use_hardcoded_cameras
        fi
    else
        use_hardcoded_cameras
    fi
    
    # Testar conectividade se solicitado
    if [ "$test_only" = true ]; then
        test_all_cameras "$username" "$password" "$DEFAULT_PORT"
        exit 0
    fi
    
    # Testar conectividade antes de abrir
    if [ ${#DISCOVERED_CAMERAS[@]} -gt 0 ]; then
        test_all_cameras "$username" "$password" "$DEFAULT_PORT"
    fi
    
    # Fechar câmeras existentes
    close_all_cameras
    
    # Abrir todas as câmeras
    if [ ${#DISCOVERED_CAMERAS[@]} -gt 0 ]; then
        open_all_cameras "$layout" "$username" "$password" "$DEFAULT_PORT"
    else
        echo -e "${RED}❌ Nenhuma câmera disponível para abrir${NC}"
        exit 1
    fi
    
    echo ""
    echo -e "${GREEN}🎉 Script concluído com sucesso!${NC}"
}

# Executar função principal
main "$@"
