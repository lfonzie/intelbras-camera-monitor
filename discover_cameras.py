#!/usr/bin/env python3
"""
Script para descobrir câmeras Intelbras Mibo na rede
"""
import subprocess
import socket
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed

def ping_host(ip):
    """Testa conectividade com um IP"""
    try:
        result = subprocess.run(['ping', '-c', '1', '-W', '1', ip], 
                              capture_output=True, text=True, timeout=3)
        return result.returncode == 0
    except:
        return False

def test_rtsp_connection(ip, username='admin', password='tapooo888'):
    """Testa conexão RTSP com diferentes formatos"""
    rtsp_paths = [
        # Formato específico para câmeras Intelbras Mibo Cam (IM3, IM3 Black, IM4, IM5)
        '/cam/realmonitor?channel=1&subtype=0',
        '/cam/realmonitor?channel=1&subtype=1',
        '/cam/realmonitor?channel=0&subtype=0',
        '/cam/realmonitor?channel=0&subtype=1',
        # Formato específico para câmeras TP-Link Tapo
        '/stream1',  # Resolução 1080P (1920*1080)
        '/stream2',  # Resolução 360P (640*360)
        # Outros formatos comuns
        '/live/mpeg4',
        '/live/h264',
        '/stream/ch0_0',
        '/live/ch0_0',
        '/live/ch1',
        '/live/ch0',
        '/live',
        '/videoMain',
        '/videoSub'
    ]
    
    for path in rtsp_paths:
        rtsp_url = f"rtsp://{username}:{password}@{ip}:554{path}"
        try:
            # Teste rápido com ffprobe
            result = subprocess.run([
                'ffprobe', '-v', 'quiet', '-rtsp_transport', 'tcp',
                '-timeout', '3000000', '-i', rtsp_url
            ], capture_output=True, text=True, timeout=5)
            
            if result.returncode == 0:
                return rtsp_url
        except:
            continue
    
    return None

def scan_network_range(network_base, start=1, end=254):
    """Escaneia uma faixa de IPs"""
    active_ips = []
    
    print(f"Escaneando rede {network_base}.{start}-{end}...")
    
    with ThreadPoolExecutor(max_workers=50) as executor:
        futures = []
        for i in range(start, end + 1):
            ip = f"{network_base}.{i}"
            future = executor.submit(ping_host, ip)
            futures.append((ip, future))
        
        for ip, future in futures:
            try:
                if future.result(timeout=2):
                    active_ips.append(ip)
                    print(f"✓ IP ativo encontrado: {ip}")
            except:
                pass
    
    return active_ips

def test_camera_rtsp(ip):
    """Testa se um IP é uma câmera RTSP"""
    rtsp_url = test_rtsp_connection(ip)
    if rtsp_url:
        print(f"🎥 CÂMERA ENCONTRADA: {ip} - {rtsp_url}")
        return (ip, rtsp_url)
    return None

def test_camera_rtsp_with_creds(ip, username, password):
    """Testa se um IP é uma câmera RTSP com credenciais específicas"""
    rtsp_url = test_rtsp_connection(ip, username, password)
    if rtsp_url:
        return (ip, rtsp_url)
    return None

def main():
    import os
    
    # Verificar se foi chamado via API (com parâmetros de ambiente)
    network_base = os.getenv('NETWORK_BASE')
    start_range = int(os.getenv('START_RANGE', '1'))
    end_range = int(os.getenv('END_RANGE', '254'))
    username = os.getenv('USERNAME', 'admin')
    password = os.getenv('PASSWORD', 'tapooo888')
    
    if network_base:
        # Modo API - escanear rede específica
        print(f"🔍 Escaneando rede {network_base}.{start_range}-{end_range}...")
        active_ips = scan_network_range(network_base, start_range, end_range)
        
        if active_ips:
            print(f"🔍 Testando {len(active_ips)} IPs ativos para RTSP...")
            
            with ThreadPoolExecutor(max_workers=10) as executor:
                futures = [executor.submit(test_camera_rtsp_with_creds, ip, username, password) for ip in active_ips]
                
                for future in as_completed(futures):
                    try:
                        result = future.result(timeout=10)
                        if result:
                            ip, rtsp_url = result
                            print(f"✓ Câmera encontrada: {ip} - {rtsp_url}")
                    except:
                        pass
    else:
        # Modo standalone - escanear múltiplas redes
        print("🔍 Descobrindo câmeras Intelbras Mibo na rede...")
        print("=" * 60)
        
        networks_to_scan = [
            "172.16.0",  # Rede informada pelo usuário
            "192.168.1", # Rede comum
            "192.168.0", # Rede comum
            "10.0.0"     # Rede corporativa
        ]
        
        all_cameras = []
        
        for network in networks_to_scan:
            print(f"\n📡 Escaneando rede {network}.x...")
            active_ips = scan_network_range(network)
            
            if active_ips:
                print(f"\n🔍 Testando {len(active_ips)} IPs ativos para RTSP...")
                
                with ThreadPoolExecutor(max_workers=10) as executor:
                    futures = [executor.submit(test_camera_rtsp, ip) for ip in active_ips]
                    
                    for future in as_completed(futures):
                        try:
                            result = future.result(timeout=10)
                            if result:
                                all_cameras.append(result)
                        except:
                            pass
        
        print("\n" + "=" * 60)
        print("📋 RESULTADO FINAL:")
        
        if all_cameras:
            print(f"✅ {len(all_cameras)} câmera(s) encontrada(s):")
            for ip, rtsp_url in all_cameras:
                print(f"   • {ip} - {rtsp_url}")
            
            # Gerar configuração para .env.local
            print(f"\n📝 Configuração sugerida para .env.local:")
            print("CAMERAS=" + ",".join([f"{ip}:554" for ip, _ in all_cameras]))
            
        else:
            print("❌ Nenhuma câmera RTSP encontrada.")
            print("\n💡 Sugestões:")
            print("   • Verifique se as câmeras estão ligadas e conectadas")
            print("   • Confirme a rede correta (172.16.0.x)")
            print("   • Teste as credenciais (admin/tapooo888)")
            print("   • Verifique se o RTSP está habilitado nas câmeras")

if __name__ == "__main__":
    main()
