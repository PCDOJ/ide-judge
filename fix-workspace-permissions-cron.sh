#!/bin/bash

# Cron script để tự động fix permissions cho workspace directories
# Chạy định kỳ mỗi 5 phút để đảm bảo permissions luôn đúng

# Fix permissions for all workspace directories
find /workspace -type d -exec chmod 775 {} \; 2>/dev/null || true

# Fix permissions for all files
find /workspace -type f -exec chmod 664 {} \; 2>/dev/null || true

# Make shell scripts executable
find /workspace -type f -name "*.sh" -exec chmod 775 {} \; 2>/dev/null || true

# Ensure ownership is correct
chown -R coder:coder /workspace 2>/dev/null || true

