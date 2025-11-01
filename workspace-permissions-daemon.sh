#!/bin/bash

# Daemon script để tự động fix permissions cho workspace directories
# Chạy liên tục mỗi 1 giây để đảm bảo permissions luôn đúng cho user ra vào liên tục

echo "[Workspace Permissions Daemon] Starting..."
echo "[Workspace Permissions Daemon] Will check and fix permissions every 1 second"

while true; do
    # Fix permissions for all workspace directories
    find /workspace -type d -exec chmod 775 {} \; 2>/dev/null || true
    
    # Fix permissions for all files
    find /workspace -type f -exec chmod 664 {} \; 2>/dev/null || true
    
    # Make shell scripts executable
    find /workspace -type f -name "*.sh" -exec chmod 775 {} \; 2>/dev/null || true
    
    # Ensure ownership is correct
    chown -R coder:coder /workspace 2>/dev/null || true
    
    # Sleep 1 second before next check
    sleep 1
done

