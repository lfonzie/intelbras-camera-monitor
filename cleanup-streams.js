#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Script para limpar arquivos de stream antigos e otimizar o sistema
 */

const STREAMS_DIR = path.join(__dirname, 'public', 'streams');
const MAX_AGE_HOURS = 2; // Remover arquivos mais antigos que 2 horas
const MAX_FILES_PER_CAMERA = 20; // Manter no máximo 20 arquivos por câmera

function cleanupStreams() {
  console.log('🧹 Iniciando limpeza de streams...');
  
  if (!fs.existsSync(STREAMS_DIR)) {
    console.log('📁 Diretório de streams não existe, criando...');
    fs.mkdirSync(STREAMS_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(STREAMS_DIR);
  const now = Date.now();
  const maxAge = MAX_AGE_HOURS * 60 * 60 * 1000; // Converter para milissegundos
  
  let deletedCount = 0;
  let totalSize = 0;
  
  // Agrupar arquivos por câmera
  const cameraFiles = {};
  
  files.forEach(file => {
    const filePath = path.join(STREAMS_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      // Extrair ID da câmera do nome do arquivo
      const match = file.match(/stream_(\d+)/);
      if (match) {
        const cameraId = match[1];
        if (!cameraFiles[cameraId]) {
          cameraFiles[cameraId] = [];
        }
        cameraFiles[cameraId].push({
          name: file,
          path: filePath,
          stats: stats
        });
      }
    }
  });
  
  // Processar cada câmera
  Object.keys(cameraFiles).forEach(cameraId => {
    const cameraFileList = cameraFiles[cameraId];
    
    // Ordenar por data de modificação (mais recente primeiro)
    cameraFileList.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
    
    let cameraDeletedCount = 0;
    let cameraSize = 0;
    
    cameraFileList.forEach((file, index) => {
      const fileAge = now - file.stats.mtime.getTime();
      const shouldDelete = 
        index >= MAX_FILES_PER_CAMERA || // Manter apenas os N arquivos mais recentes
        fileAge > maxAge; // Ou arquivos muito antigos
      
      if (shouldDelete) {
        try {
          const fileSize = file.stats.size;
          fs.unlinkSync(file.path);
          deletedCount++;
          cameraDeletedCount++;
          totalSize += fileSize;
          cameraSize += fileSize;
          console.log(`🗑️  Removido: ${file.name} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`);
        } catch (error) {
          console.error(`❌ Erro ao remover ${file.name}:`, error.message);
        }
      }
    });
    
    if (cameraDeletedCount > 0) {
      console.log(`📹 Câmera ${cameraId}: ${cameraDeletedCount} arquivos removidos (${(cameraSize / 1024 / 1024).toFixed(2)} MB)`);
    }
  });
  
  console.log(`✅ Limpeza concluída:`);
  console.log(`   - ${deletedCount} arquivos removidos`);
  console.log(`   - ${(totalSize / 1024 / 1024).toFixed(2)} MB liberados`);
  console.log(`   - ${Object.keys(cameraFiles).length} câmeras processadas`);
}

function showDiskUsage() {
  console.log('\n📊 Uso de disco dos streams:');
  
  if (!fs.existsSync(STREAMS_DIR)) {
    console.log('   Diretório não existe');
    return;
  }
  
  const files = fs.readdirSync(STREAMS_DIR);
  let totalSize = 0;
  let fileCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(STREAMS_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (stats.isFile()) {
      totalSize += stats.size;
      fileCount++;
    }
  });
  
  console.log(`   - ${fileCount} arquivos`);
  console.log(`   - ${(totalSize / 1024 / 1024).toFixed(2)} MB total`);
  console.log(`   - ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB total`);
}

// Executar limpeza
if (require.main === module) {
  const command = process.argv[2];
  
  switch (command) {
    case 'clean':
      cleanupStreams();
      break;
    case 'status':
      showDiskUsage();
      break;
    case 'help':
      console.log('Uso: node cleanup-streams.js [comando]');
      console.log('Comandos:');
      console.log('  clean   - Limpar arquivos antigos');
      console.log('  status  - Mostrar uso de disco');
      console.log('  help    - Mostrar esta ajuda');
      break;
    default:
      console.log('Comando não reconhecido. Use "help" para ver os comandos disponíveis.');
      process.exit(1);
  }
}

module.exports = { cleanupStreams, showDiskUsage };






