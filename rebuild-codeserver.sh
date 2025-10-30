#!/bin/bash

echo "========================================="
echo "Rebuilding Code-Server Container"
echo "========================================="
echo ""

# Stop and remove existing code-server container
echo "1. Stopping existing code-server container..."
docker-compose stop code-server
docker-compose rm -f code-server

echo ""
echo "2. Rebuilding code-server image with extensions..."
docker-compose build --no-cache code-server

echo ""
echo "3. Starting code-server container..."
docker-compose up -d code-server

echo ""
echo "4. Waiting for code-server to be ready..."
sleep 10

echo ""
echo "5. Checking code-server status..."
docker-compose ps code-server

echo ""
echo "6. Checking installed extensions..."
docker exec ide-judge-code-server code-server --list-extensions

echo ""
echo "========================================="
echo "✅ Code-Server rebuild completed!"
echo "========================================="
echo ""
echo "Installed extensions:"
echo "  - tomoki1207.pdf (PDF Viewer)"
echo "  - formulahendry.code-runner (Code Runner)"
echo ""
echo "Code Runner shortcuts:"
echo "  - Run Code: Ctrl+Alt+N"
echo "  - Stop Running: Ctrl+Alt+M"
echo ""
echo "Access code-server at: http://localhost:8080"
echo "Or via proxy at: http://localhost:2308/workspace"
echo ""

