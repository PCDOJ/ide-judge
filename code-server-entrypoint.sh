#!/bin/bash
set -e

# Fix permissions for workspace directory
echo "[Code-Server Entrypoint] Fixing workspace permissions..."
sudo chown -R coder:coder /workspace 2>/dev/null || true
sudo chmod -R 755 /workspace 2>/dev/null || true

# List workspace structure for debugging
echo "[Code-Server Entrypoint] Workspace structure:"
ls -la /workspace/ 2>/dev/null || echo "Workspace is empty"

# Start code-server with verbose logging
echo "[Code-Server Entrypoint] Starting code-server on 0.0.0.0:8080..."
echo "[Code-Server Entrypoint] Auth: none"
echo "[Code-Server Entrypoint] Proxy domain: localhost:2308"
echo "[Code-Server Entrypoint] Note: Specific folders can be opened via ?folder= query parameter"

# Start code-server with proxy domain configuration to allow requests from proxy
# --proxy-domain allows code-server to accept requests from the specified domain
exec code-server \
    --bind-addr "0.0.0.0:8080" \
    --auth "none" \
    --proxy-domain "localhost:2308" \
    --verbose

