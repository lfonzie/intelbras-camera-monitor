#!/bin/bash

# Intelbras Camera Monitor V2 - Startup Script
# This script sets up and starts the RTSP to HLS streaming server

echo "🎥 Intelbras Camera Monitor V2 - Starting Setup"
echo "=============================================="

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found. Please run this script from the v2 directory."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Error: Node.js is not installed. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ Error: npm is not installed. Please install npm first."
    exit 1
fi

# Check if FFmpeg is installed
echo "🔍 Checking for FFmpeg..."
if ! command -v ffmpeg &> /dev/null; then
    echo "❌ Error: FFmpeg is not installed!"
    echo ""
    echo "Please install FFmpeg:"
    echo "  • Windows: choco install ffmpeg"
    echo "  • Linux: sudo apt install ffmpeg"
    echo "  • macOS: brew install ffmpeg"
    echo ""
    echo "FFmpeg is REQUIRED for video streaming."
    exit 1
else
    echo "✅ FFmpeg is installed"
    ffmpeg -version | head -1
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create necessary directories
echo ""
echo "📁 Creating directories..."
mkdir -p public/hls logs

# Check if directories were created
if [ -d "public/hls" ] && [ -d "logs" ]; then
    echo "✅ Directories created successfully"
else
    echo "❌ Error: Failed to create directories"
    exit 1
fi

# Display configuration info
echo ""
echo "📋 Configuration:"
echo "  • Server: Enhanced version with health monitoring"
echo "  • Port: 8000 (default)"
echo "  • Cameras: Intelbras + Tapo"
echo "  • Streaming: RTSP to HLS conversion"
echo "  • Quality: Low/Medium/High options"

# Start the server
echo ""
echo "🚀 Starting streaming server..."
echo "   Open your browser to: http://localhost:8000"
echo "   Press Ctrl+C to stop the server"
echo ""

# Start the enhanced server
PORT=8000 node server_enhanced.js
