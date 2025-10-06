#!/usr/bin/env node

const axios = require('axios');

// Configuração das câmeras do .env.local
const intelbrasCameras = [
  '172.16.11.179:554', '172.16.14.182:554', '172.16.9.91:554', '172.16.8.155:554',
  '172.16.11.16:554', '172.16.11.144:554', '172.16.12.176:554', '172.16.12.187:554',
  '172.16.8.194:554', '172.16.8.223:554', '172.16.13.235:554', '172.16.13.254:554',
  '172.16.13.197:554', '172.16.6.128:554', '172.16.6.209:554', '172.16.6.239:554',
  '172.16.9.7:554', '172.16.5.158:554', '172.16.8.0:554', '172.16.14.251:554',
  '172.16.15.17:554', '172.16.7.12:554', '172.16.6.178:554', '172.16.10.37:554',
  '172.16.10.85:554', '172.16.9.236:554', '172.16.9.238:554', '172.16.5.161:554',
  '172.16.5.186:554'
];

const tapoCameras = [
  '172.16.15.36:554', '172.16.10.28:554', '172.16.13.82:554'
];

const allCameras = [...intelbrasCameras, ...tapoCameras];

async function checkCamera(cameraId) {
  try {
    const response = await axios.get(`http://localhost:8000/api/streams/${cameraId}`, {
      timeout: 10000,
      validateStatus: (status) => status === 200 || status === 503
    });
    
    if (response.status === 200) {
      return { id: cameraId, status: 'online', url: response.data.url };
    } else {
      return { id: cameraId, status: 'offline', error: response.data.error };
    }
  } catch (error) {
    return { id: cameraId, status: 'offline', error: error.message };
  }
}

async function checkAllCameras() {
  console.log('🔍 Verificando todas as câmeras...\n');
  
  const results = [];
  const batchSize = 5; // Verificar 5 câmeras por vez
  
  for (let i = 0; i < allCameras.length; i += batchSize) {
    const batch = [];
    for (let j = i; j < Math.min(i + batchSize, allCameras.length); j++) {
      batch.push(checkCamera(j + 1));
    }
    
    const batchResults = await Promise.all(batch);
    results.push(...batchResults);
    
    // Mostrar progresso
    const progress = Math.min(i + batchSize, allCameras.length);
    console.log(`📊 Progresso: ${progress}/${allCameras.length} câmeras verificadas`);
  }
  
  // Separar resultados
  const onlineCameras = results.filter(r => r.status === 'online');
  const offlineCameras = results.filter(r => r.status === 'offline');
  
  console.log('\n📈 RESULTADOS:');
  console.log(`✅ Online: ${onlineCameras.length} câmeras`);
  console.log(`❌ Offline: ${offlineCameras.length} câmeras`);
  
  console.log('\n🟢 CÂMERAS ONLINE:');
  onlineCameras.forEach(camera => {
    const cameraIndex = camera.id - 1;
    const address = allCameras[cameraIndex];
    const type = cameraIndex < intelbrasCameras.length ? 'Intelbras' : 'Tapo';
    console.log(`  ${camera.id}: ${type} ${address} - ${camera.url}`);
  });
  
  console.log('\n🔴 CÂMERAS OFFLINE:');
  offlineCameras.forEach(camera => {
    const cameraIndex = camera.id - 1;
    const address = allCameras[cameraIndex];
    const type = cameraIndex < intelbrasCameras.length ? 'Intelbras' : 'Tapo';
    console.log(`  ${camera.id}: ${type} ${address} - ${camera.error}`);
  });
  
  return results;
}

// Executar verificação
checkAllCameras().catch(console.error);
