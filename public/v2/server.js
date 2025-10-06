// server.js - RTSP to HLS Streaming Server
// Install dependencies: npm install express cors node-media-server

const express = require('express');
const cors = require('cors');
const NodeMediaServer = require('node-media-server');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve index.html for root route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Configuration
const config = {
  intelbras: {
    username: 'admin',
    password: 'tapooo888',
    cameras: [
      '172.16.11.179:554', '172.16.14.182:554', '172.16.9.91:554',
      '172.16.8.155:554', '172.16.11.16:554', '172.16.11.144:554',
      '172.16.12.176:554', '172.16.12.187:554', '172.16.8.194:554',
      '172.16.8.223:554', '172.16.13.235:554', '172.16.13.254:554',
      '172.16.13.197:554', '172.16.6.128:554', '172.16.6.209:554',
      '172.16.6.239:554', '172.16.9.7:554', '172.16.5.158:554',
      '172.16.8.0:554', '172.16.14.251:554', '172.16.15.17:554',
      '172.16.7.12:554', '172.16.6.178:554', '172.16.10.37:554',
      '172.16.10.85:554', '172.16.9.236:554', '172.16.9.238:554',
      '172.16.5.161:554', '172.16.5.186:554'
    ],
    rtspTemplate: (ip) => `rtsp://admin:tapooo888@${ip}/cam/realmonitor?channel=1&subtype=0`
  },
  tapo: {
    username: 'tapooo',
    password: 'tapooo888',
    cameras: ['172.16.15.36:554', '172.16.10.28:554', '172.16.13.82:554'],
    rtspTemplate: (ip) => `rtsp://tapooo:tapooo888@${ip}/stream1`
  }
};

// Create HLS directory
const hlsDir = path.join(__dirname, 'public', 'hls');
if (!fs.existsSync(hlsDir)) {
  fs.mkdirSync(hlsDir, { recursive: true });
}

// Store active FFmpeg processes
const activeStreams = new Map();

// Generate camera list
function getCameraList() {
  const cameras = [];
  
  config.intelbras.cameras.forEach((ip, index) => {
    cameras.push({
      id: `intelbras-${index}`,
      type: 'intelbras',
      ip: ip,
      name: `Intelbras Camera ${index + 1}`,
      rtspUrl: config.intelbras.rtspTemplate(ip)
    });
  });

  config.tapo.cameras.forEach((ip, index) => {
    cameras.push({
      id: `tapo-${index}`,
      type: 'tapo',
      ip: ip,
      name: `Tapo Camera ${index + 1}`,
      rtspUrl: config.tapo.rtspTemplate(ip)
    });
  });

  return cameras;
}

// Start HLS stream for a camera
function startHLSStream(camera) {
  if (activeStreams.has(camera.id)) {
    console.log(`Stream already active for ${camera.id}`);
    return;
  }

  const outputDir = path.join(hlsDir, camera.id);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const outputPath = path.join(outputDir, 'stream.m3u8');
  
  // FFmpeg command to convert RTSP to HLS
  const ffmpegCmd = `ffmpeg -rtsp_transport tcp -i "${camera.rtspUrl}" \
    -c:v libx264 -preset ultrafast -tune zerolatency \
    -c:a aac -b:a 128k \
    -f hls \
    -hls_time 2 \
    -hls_list_size 3 \
    -hls_flags delete_segments \
    -start_number 0 \
    "${outputPath}"`;

  console.log(`Starting stream for ${camera.id}`);
  
  const process = exec(ffmpegCmd, (error, stdout, stderr) => {
    if (error) {
      console.error(`FFmpeg error for ${camera.id}:`, error);
      activeStreams.delete(camera.id);
    }
  });

  activeStreams.set(camera.id, process);

  // Handle process exit
  process.on('exit', (code) => {
    console.log(`Stream ${camera.id} exited with code ${code}`);
    activeStreams.delete(camera.id);
  });
}

// Stop HLS stream
function stopHLSStream(cameraId) {
  const process = activeStreams.get(cameraId);
  if (process) {
    process.kill('SIGTERM');
    activeStreams.delete(cameraId);
    console.log(`Stopped stream for ${cameraId}`);
  }
}

// API Routes
app.get('/api/cameras', (req, res) => {
  res.json(getCameraList());
});

app.post('/api/stream/start/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const cameras = getCameraList();
  const camera = cameras.find(c => c.id === cameraId);

  if (!camera) {
    return res.status(404).json({ error: 'Camera not found' });
  }

  startHLSStream(camera);
  res.json({ success: true, message: `Stream started for ${cameraId}` });
});

app.post('/api/stream/stop/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  stopHLSStream(cameraId);
  res.json({ success: true, message: `Stream stopped for ${cameraId}` });
});

app.get('/api/stream/status/:cameraId', (req, res) => {
  const { cameraId } = req.params;
  const isActive = activeStreams.has(cameraId);
  res.json({ active: isActive });
});

// Serve HLS streams
app.use('/hls', express.static(hlsDir));

// Cleanup on exit
process.on('SIGINT', () => {
  console.log('Stopping all streams...');
  activeStreams.forEach((_, cameraId) => {
    stopHLSStream(cameraId);
  });
  process.exit();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Streaming server running on http://localhost:${PORT}`);
  console.log(`Total cameras configured: ${getCameraList().length}`);
});