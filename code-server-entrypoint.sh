#!/bin/bash
set -e

echo "========================================="
echo "  Code-Server Entrypoint"
echo "========================================="

# Start workspace permissions daemon in background
# This daemon will continuously fix permissions every 1 second
echo "[Code-Server Entrypoint] Starting workspace permissions daemon..."
sudo /usr/local/bin/workspace-permissions-daemon.sh &
DAEMON_PID=$!
echo "[Code-Server Entrypoint] Permissions daemon started with PID: $DAEMON_PID"

# Initial fix permissions for workspace directory
echo "[Code-Server Entrypoint] Initial workspace permissions fix..."

# Set ownership to coder user
sudo chown -R coder:coder /workspace 2>/dev/null || true

# Set directory permissions to 775 (rwxrwxr-x)
# This allows coder user and group to read, write, and execute
echo "[Code-Server Entrypoint] Setting directory permissions to 775..."
sudo find /workspace -type d -exec chmod 775 {} \; 2>/dev/null || true

# Set file permissions to 664 (rw-rw-r--)
# This allows coder user and group to read and write
echo "[Code-Server Entrypoint] Setting file permissions to 664..."
sudo find /workspace -type f -exec chmod 664 {} \; 2>/dev/null || true

# Make .sh files executable
echo "[Code-Server Entrypoint] Making shell scripts executable..."
sudo find /workspace -type f -name "*.sh" -exec chmod 775 {} \; 2>/dev/null || true

echo "[Code-Server Entrypoint] ✅ Initial permissions fixed!"
echo "[Code-Server Entrypoint] ✅ Daemon will continue fixing permissions every 1 second"

# List workspace structure for debugging
echo "[Code-Server Entrypoint] Workspace structure:"
ls -la /workspace/ 2>/dev/null || echo "Workspace is empty"

# Get proxy domain from environment variable or use default
PROXY_DOMAIN="${PROXY_DOMAIN:-localhost:2308}"

echo "========================================="
echo "[Code-Server Entrypoint] Starting code-server on 0.0.0.0:8080..."
echo "[Code-Server Entrypoint] Auth: none"
echo "[Code-Server Entrypoint] Proxy domain: ${PROXY_DOMAIN}"
echo "[Code-Server Entrypoint] Note: Specific folders can be opened via ?folder= query parameter"
echo "========================================="

# Start code-server with proxy domain configuration to allow requests from proxy
# --proxy-domain allows code-server to accept requests from the specified domain
# Accept both the exact domain and without port for flexibility
exec code-server \
    --bind-addr "0.0.0.0:8080" \
    --auth "none" \
    --proxy-domain "${PROXY_DOMAIN}" \
    --proxy-domain "${PROXY_DOMAIN%:*}" \
    --verbose

