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
        '/live/mpeg4',
        '/live/h264',
        '/stream1',
        '/stream/ch0_0',
        '/cam/realmonitor?channel=1&subtype=0',
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

def main():
    print("🔍 Descobrindo câmeras Intelbras Mibo na rede...")
    print("=" * 60)
    
    # Escanear diferentes redes possíveis
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
