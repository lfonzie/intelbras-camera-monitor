#!/bin/bash

# Intelbras Camera Monitor V2 - Run Script
# This script runs the v2 app from the project root directory

echo "🎥 Intelbras Camera Monitor V2 - Starting from project root"
echo "=========================================================="

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
V2_DIR="$SCRIPT_DIR/public/v2"

# Check if v2 directory exists
if [ ! -d "$V2_DIR" ]; then
    echo "❌ Error: v2 directory not found at $V2_DIR"
    exit 1
fi

# Check if package.json exists in v2 directory
if [ ! -f "$V2_DIR/package.json" ]; then
    echo "❌ Error: package.json not found in v2 directory"
    exit 1
fi

echo "📁 V2 directory: $V2_DIR"
echo ""

# Change to v2 directory and run the startup script
cd "$V2_DIR"

# Check if start.sh exists and is executable
if [ -f "start.sh" ] && [ -x "start.sh" ]; then
    echo "🚀 Running v2 startup script..."
    ./start.sh
else
    echo "⚠️  start.sh not found or not executable, running manual setup..."
    
    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        echo "❌ Error: Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    # Check if FFmpeg is installed
    if ! command -v ffmpeg &> /dev/null; then
        echo "❌ Error: FFmpeg is not installed!"
        echo "Please install FFmpeg:"
        echo "  • Windows: choco install ffmpeg"
        echo "  • Linux: sudo apt install ffmpeg"
        echo "  • macOS: brew install ffmpeg"
        exit 1
    fi

    # Install dependencies
    echo "📦 Installing dependencies..."
    npm install

    # Create directories
    mkdir -p public/hls logs

    # Start the server
    echo "🚀 Starting streaming server..."
    echo "   Open your browser to: http://localhost:8000"
    echo "   Press Ctrl+C to stop the server"
    echo ""
    
    PORT=8000 node server_enhanced.js
fi
