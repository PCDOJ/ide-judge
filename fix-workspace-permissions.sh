#!/bin/bash

# Script để fix workspace permissions issue
# Vấn đề: User không thể compile code do permission denied

echo "========================================="
echo "  Fix Workspace Permissions"
echo "========================================="
echo ""

# Stop code-server container
echo "Step 1: Stopping code-server container..."
docker-compose stop code-server

# Rebuild code-server image với entrypoint mới
echo ""
echo "Step 2: Rebuilding code-server image..."
docker-compose build --no-cache code-server

# Start code-server container
echo ""
echo "Step 3: Starting code-server container..."
docker-compose up -d code-server

# Wait for container to be ready
echo ""
echo "Step 4: Waiting for code-server to be ready..."
sleep 5

# Fix permissions for existing workspace directories
echo ""
echo "Step 5: Fixing permissions for existing workspace directories..."
docker exec ide-judge-code-server bash -c "sudo find /workspace -type d -exec chmod 775 {} \; 2>/dev/null || true"
docker exec ide-judge-code-server bash -c "sudo find /workspace -type f -exec chmod 664 {} \; 2>/dev/null || true"
docker exec ide-judge-code-server bash -c "sudo chown -R coder:coder /workspace 2>/dev/null || true"

# Verify permissions
echo ""
echo "Step 6: Verifying permissions..."
docker exec ide-judge-code-server bash -c "ls -la /workspace/ 2>/dev/null || echo 'Workspace is empty'"

echo ""
echo "========================================="
echo "  ✅ Fix completed!"
echo "========================================="
echo ""
echo "Bây giờ user có thể compile code trong terminal:"
echo "  g++ file.cpp -o file"
echo ""
echo "Nếu vẫn gặp lỗi, restart lại web container:"
echo "  docker-compose restart web"
echo ""

