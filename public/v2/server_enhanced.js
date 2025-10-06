// server-enhanced.js - Production-ready RTSP to HLS Streaming Server
// npm install express cors dotenv winston

const express = require('express');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve index.html for root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Logger setup (optional - comment out if you don't want to install winston)
// const winston = require('winston');
// const logger = winston.createLogger({
//     level: 'info',
//     format: winston.format.combine(
//         winston.format.timestamp(),
//         winston.format.json()
//     ),
//     transports: [
//         new winston.transports.File({ filename: 'error.log', level: 'error' }),
//         new winston.transports.File({ filename: 'combined.log' }),
//         new winston.transports.Console({ format: winston.format.simple() })
//     ]
// });

// Simple console logger if winston not installed
const logger = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

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

// Stream settings
const STREAM_SETTINGS = {
    // Lower quality - good for many streams
    low: {
        video: '-c:v libx264 -preset ultrafast -tune zerolatency -crf 28 -maxrate 500k -bufsize 1000k',
        resolution: '-s 640x360',
        fps: '-r 15'
    },
    // Medium quality - balanced
    medium: {
        video: '-c:v libx264 -preset veryfast -tune zerolatency -crf 25 -maxrate 1000k -bufsize 2000k',
        resolution: '-s 1280x720',
        fps: '-r 20'
    },
    // High quality - best quality
    high: {
        video: '-c:v libx264 -preset medium -tune zerolatency -crf 23 -maxrate 2000k -bufsize 4000k',
        resolution: '-s 1920x1080',
        fps: '-r 25'
    }
};

// Create necessary directories
const hlsDir = path.join(__dirname, 'public', 'hls');
const logsDir = path.join(__dirname, 'logs');

[hlsDir, logsDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created directory: ${dir}`);
    }
});

// Store active streams
const activeStreams = new Map();
const streamHealth = new Map();

// Health check interval
const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

// Generate camera list
function getCameraList() {
    const cameras = [];
    
    config.intelbras.cameras.forEach((ip, index) => {
        cameras.push({
            id: `intelbras-${index}`,
            type: 'intelbras',
            ip: ip,
            name: `Intelbras Camera ${index + 1}`,
            rtspUrl: config.intelbras.rtspTemplate(ip),
            status: 'offline'
        });
    });

    config.tapo.cameras.forEach((ip, index) => {
        cameras.push({
            id: `tapo-${index}`,
            type: 'tapo',
            ip: ip,
            name: `Tapo Camera ${index + 1}`,
            rtspUrl: config.tapo.rtspTemplate(ip),
            status: 'offline'
        });
    });

    return cameras;
}

// Check if FFmpeg is installed
function checkFFmpeg() {
    return new Promise((resolve) => {
        exec('ffmpeg -version', (error) => {
            if (error) {
                logger.error('FFmpeg not found! Please install FFmpeg.');
                resolve(false);
            } else {
                logger.info('FFmpeg is installed');
                resolve(true);
            }
        });
    });
}

// Start HLS stream with improved error handling
function startHLSStream(camera, quality = 'medium') {
    return new Promise((resolve, reject) => {
        if (activeStreams.has(camera.id)) {
            logger.info(`Stream already active for ${camera.id}`);
            resolve({ success: true, message: 'Stream already running' });
            return;
        }

        const outputDir = path.join(hlsDir, camera.id);
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const outputPath = path.join(outputDir, 'stream.m3u8');
        const settings = STREAM_SETTINGS[quality] || STREAM_SETTINGS.medium;

        // Build FFmpeg command
        const ffmpegArgs = [
            '-rtsp_transport', 'tcp',
            '-i', camera.rtspUrl,
            '-y', // Overwrite output files
            ...settings.video.split(' '),
            ...settings.resolution.split(' '),
            ...settings.fps.split(' '),
            '-c:a', 'aac',
            '-b:a', '128k',
            '-f', 'hls',
            '-hls_time', '2',
            '-hls_list_size', '5',
            '-hls_flags', 'delete_segments+append_list',
            '-hls_segment_type', 'mpegts',
            '-hls_segment_filename', path.join(outputDir, 'segment_%03d.ts'),
            '-start_number', '0',
            outputPath
        ];

        logger.info(`Starting stream for ${camera.id} with ${quality} quality`);
        
        const process = spawn('ffmpeg', ffmpegArgs);
        
        let streamStarted = false;
        let errorOutput = '';

        // Capture stderr for debugging
        process.stderr.on('data', (data) => {
            const output = data.toString();
            errorOutput += output;
            
            // Check if stream started successfully
            if (!streamStarted && output.includes('Opening')) {
                streamStarted = true;
                logger.info(`Stream ${camera.id} connected to camera`);
            }
            
            // Log errors
            if (output.toLowerCase().includes('error')) {
                logger.error(`FFmpeg error for ${camera.id}: ${output}`);
            }
        });

        process.on('error', (error) => {
            logger.error(`Failed to start FFmpeg for ${camera.id}:`, error);
            activeStreams.delete(camera.id);
            streamHealth.delete(camera.id);
            reject({ success: false, error: error.message });
        });

        process.on('exit', (code, signal) => {
            logger.info(`Stream ${camera.id} exited with code ${code}, signal ${signal}`);
            activeStreams.delete(camera.id);
            streamHealth.delete(camera.id);
            
            // Clean up HLS files
            setTimeout(() => {
                const files = fs.readdirSync(outputDir);
                files.forEach(file => {
                    fs.unlinkSync(path.join(outputDir, file));
                });
            }, 5000);
        });

        // Store process info
        activeStreams.set(camera.id, {
            process,
            camera,
            quality,
            startTime: Date.now()
        });

        streamHealth.set(camera.id, {
            status: 'starting',
            lastCheck: Date.now(),
            errors: 0
        });

        // Give FFmpeg time to start
        setTimeout(() => {
            if (fs.existsSync(outputPath)) {
                streamHealth.set(camera.id, {
                    status: 'running',
                    lastCheck: Date.now(),
                    errors: 0
                });
                resolve({ success: true, message: 'Stream started successfully' });
            } else {
                logger.error(`Stream ${camera.id} failed to start. Last error: ${errorOutput.slice(-200)}`);
                stopHLSStream(camera.id);
                reject({ success: false, error: 'Failed to create HLS stream' });
            }
        }, 3000);
    });
}

// Stop HLS stream
function stopHLSStream(cameraId) {
    const streamInfo = activeStreams.get(cameraId);
    if (streamInfo) {
        logger.info(`Stopping stream for ${cameraId}`);
        streamInfo.process.kill('SIGTERM');
        
        // Force kill if not stopped after 5 seconds
        setTimeout(() => {
            if (activeStreams.has(cameraId)) {
                streamInfo.process.kill('SIGKILL');
            }
        }, 5000);
        
        activeStreams.delete(cameraId);
        streamHealth.delete(cameraId);
        return true;
    }
    return false;
}

// Health check for streams
function performHealthCheck() {
    activeStreams.forEach((streamInfo, cameraId) => {
        const outputPath = path.join(hlsDir, cameraId, 'stream.m3u8');
        const health = streamHealth.get(cameraId);
        
        if (fs.existsSync(outputPath)) {
            const stats = fs.statSync(outputPath);
            const age = Date.now() - stats.mtimeMs;
            
            // If playlist hasn't been updated in 10 seconds, consider it stale
            if (age > 10000) {
                logger.warn(`Stream ${cameraId} appears stale (${age}ms old)`);
                health.errors++;
                
                // Restart if too many errors
                if (health.errors > 3) {
                    logger.error(`Restarting stale stream ${cameraId}`);
                    stopHLSStream(cameraId);
                    setTimeout(() => {
                        startHLSStream(streamInfo.camera, streamInfo.quality);
                    }, 2000);
                }
            } else {
                health.errors = 0;
                health.status = 'healthy';
            }
            
            health.lastCheck = Date.now();
        } else {
            logger.error(`Stream ${cameraId} playlist not found`);
            health.errors++;
        }
    });
}

// Start health monitoring
setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL);

// API Routes
app.get('/api/cameras', (req, res) => {
    const cameras = getCameraList().map(cam => ({
        ...cam,
        active: activeStreams.has(cam.id),
        health: streamHealth.get(cam.id)
    }));
    res.json(cameras);
});

app.post('/api/stream/start/:cameraId', async (req, res) => {
    const { cameraId } = req.params;
    const { quality = 'medium' } = req.body;
    
    const cameras = getCameraList();
    const camera = cameras.find(c => c.id === cameraId);

    if (!camera) {
        return res.status(404).json({ success: false, error: 'Camera not found' });
    }

    try {
        const result = await startHLSStream(camera, quality);
        res.json(result);
    } catch (error) {
        res.status(500).json(error);
    }
});

app.post('/api/stream/stop/:cameraId', (req, res) => {
    const { cameraId } = req.params;
    const stopped = stopHLSStream(cameraId);
    
    if (stopped) {
        res.json({ success: true, message: `Stream stopped for ${cameraId}` });
    } else {
        res.status(404).json({ success: false, error: 'Stream not found' });
    }
});

app.get('/api/stream/status/:cameraId', (req, res) => {
    const { cameraId } = req.params;
    const isActive = activeStreams.has(cameraId);
    const health = streamHealth.get(cameraId);
    
    res.json({ 
        active: isActive,
        health: health || null
    });
});

app.get('/api/stats', (req, res) => {
    const stats = {
        totalCameras: getCameraList().length,
        activeStreams: activeStreams.size,
        streams: []
    };
    
    activeStreams.forEach((info, cameraId) => {
        const uptime = Date.now() - info.startTime;
        stats.streams.push({
            id: cameraId,
            quality: info.quality,
            uptime: Math.floor(uptime / 1000),
            health: streamHealth.get(cameraId)
        });
    });
    
    res.json(stats);
});

// Serve HLS streams
app.use('/hls', express.static(hlsDir));

// Graceful shutdown
process.on('SIGINT', () => {
    logger.info('Shutting down gracefully...');
    activeStreams.forEach((_, cameraId) => {
        stopHLSStream(cameraId);
    });
    setTimeout(() => {
        process.exit(0);
    }, 2000);
});

process.on('SIGTERM', () => {
    logger.info('Received SIGTERM, shutting down...');
    activeStreams.forEach((_, cameraId) => {
        stopHLSStream(cameraId);
    });
    setTimeout(() => {
        process.exit(0);
    }, 2000);
});

// Start server
const PORT = process.env.PORT || 3000;

checkFFmpeg().then(ffmpegAvailable => {
    if (!ffmpegAvailable) {
        logger.error('Cannot start server without FFmpeg. Please install FFmpeg first.');
        process.exit(1);
    }
    
    app.listen(PORT, () => {
        logger.info('='.repeat(50));
        logger.info(`RTSP to HLS Streaming Server`);
        logger.info(`Server: http://localhost:${PORT}`);
        logger.info(`Total cameras: ${getCameraList().length}`);
        logger.info(`Health check interval: ${HEALTH_CHECK_INTERVAL/1000}s`);
        logger.info('='.repeat(50));
    });
});