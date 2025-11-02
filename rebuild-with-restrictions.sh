#!/bin/bash
#
# Script để rebuild Docker image với workspace restrictions
#

set -e

echo "========================================="
echo "  Rebuilding Code-Server with Restrictions"
echo "========================================="
echo ""

# Stop running containers
echo "[1/4] Stopping running containers..."
docker-compose down || true
echo ""

# Remove old image to force rebuild
echo "[2/4] Removing old code-server image..."
docker rmi ide-judge-code-server || true
echo ""

# Rebuild image
echo "[3/4] Building new code-server image with restrictions..."
docker-compose build code-server
echo ""

# Start services
echo "[4/4] Starting services..."
docker-compose up -d
echo ""

echo "========================================="
echo "  Build Complete!"
echo "========================================="
echo ""
echo "Workspace restrictions have been applied:"
echo "  ✅ Folder opening is blocked"
echo "  ✅ Terminal always runs in restricted mode"
echo "  ✅ Shell commands (bash/zsh/sh) are blocked"
echo "  ✅ Directory traversal (..) is blocked"
echo ""
echo "Check logs with: docker-compose logs -f code-server"
echo "========================================="

