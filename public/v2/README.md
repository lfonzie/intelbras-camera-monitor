# Intelbras Camera Monitor V2

A production-ready RTSP to HLS streaming server for Intelbras and Tapo IP cameras.

## Features

- 🎥 **Multi-Camera Support**: Intelbras and Tapo cameras
- 📺 **HLS Streaming**: Real-time video streaming via HTTP Live Streaming
- 🔧 **Quality Control**: Low, Medium, High quality options
- 📊 **Health Monitoring**: Automatic stream health checks and recovery
- 🎨 **Modern UI**: Beautiful web interface with responsive design
- ⚡ **Performance**: Optimized for multiple concurrent streams

## Prerequisites

### 1. Install FFmpeg (REQUIRED)

**Windows:**
```bash
choco install ffmpeg
```

**Linux:**
```bash
sudo apt install ffmpeg
```

**macOS:**
```bash
brew install ffmpeg
```

### 2. Install Node.js

Download and install Node.js from [nodejs.org](https://nodejs.org/) (version 14+ required).

## Quick Start

### Option 1: Using the startup script (Recommended)

```bash
cd public/v2
./start.sh
```

### Option 2: Manual setup

```bash
# 1. Navigate to the v2 directory
cd public/v2

# 2. Install dependencies
npm install

# 3. Start the server
npm start

# 4. Open your browser
# http://localhost:8000
```

## Usage

1. **Start the server** using one of the methods above
2. **Open your browser** to `http://localhost:8000`
3. **Click "Start Stream"** on any camera to begin streaming
4. **Use filters** to show only Intelbras or Tapo cameras
5. **Monitor stats** in the header for system overview

## Camera Configuration

The system is pre-configured with the following cameras:

### Intelbras Cameras
- **Username**: admin
- **Password**: tapooo888
- **RTSP Template**: `rtsp://admin:tapooo888@{ip}/cam/realmonitor?channel=1&subtype=0`

### Tapo Cameras
- **Username**: tapooo
- **Password**: tapooo888
- **RTSP Template**: `rtsp://tapooo:tapooo888@{ip}/stream1`

## API Endpoints

- `GET /api/cameras` - List all cameras
- `POST /api/stream/start/:cameraId` - Start streaming
- `POST /api/stream/stop/:cameraId` - Stop streaming
- `GET /api/stream/status/:cameraId` - Get stream status
- `GET /api/stats` - Get system statistics

## Streaming Quality Options

- **Low**: 640x360, 15fps, 500k bitrate (good for many streams)
- **Medium**: 1280x720, 20fps, 1000k bitrate (balanced)
- **High**: 1920x1080, 25fps, 2000k bitrate (best quality)

## Troubleshooting

### FFmpeg not found
```bash
# Check if FFmpeg is installed
ffmpeg -version

# If not installed, install it using the commands above
```

### Port already in use
```bash
# Change the port in server_enhanced.js
const PORT = process.env.PORT || 8001;
```

### Camera connection issues
- Verify camera IP addresses are correct
- Check network connectivity to cameras
- Ensure camera credentials are correct
- Check if cameras support RTSP streaming

### Performance issues
- Reduce streaming quality to "low"
- Limit the number of concurrent streams
- Check system resources (CPU, memory, network)

## File Structure

```
v2/
├── server_enhanced.js    # Main server (production)
├── server.js            # Basic server (development)
├── index.html           # Web interface
├── package.json         # Dependencies
├── start.sh            # Startup script
├── README.md           # This file
├── public/
│   └── hls/            # HLS stream files
└── logs/               # Log files
```

## Development

### Running in development mode
```bash
npm run dev
```

### Adding new cameras
Edit the `config` object in `server_enhanced.js`:

```javascript
const config = {
    intelbras: {
        cameras: ['new.ip.address:554'],
        // ... other settings
    }
};
```

## License

MIT License - see LICENSE file for details.

## Support

For issues and questions:
1. Check the troubleshooting section above
2. Verify FFmpeg installation
3. Check camera network connectivity
4. Review server logs for error messages
