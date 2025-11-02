#!/bin/bash
#
# Workspace Permissions Watcher using inotify
# Chỉ fix permissions khi có file/folder mới được tạo
# Tiết kiệm CPU hơn nhiều so với scan liên tục
#

echo "[Workspace Permissions Watcher] Starting inotify-based permission fixer..."
echo "[Workspace Permissions Watcher] Watching /workspace for new files/directories..."

# Check if inotify-tools is installed
if ! command -v inotifywait &> /dev/null; then
    echo "[Workspace Permissions Watcher] ERROR: inotify-tools not installed!"
    echo "[Workspace Permissions Watcher] Please install: apt-get install inotify-tools"
    exit 1
fi

# Monitor /workspace for file/directory creation events
# -m: monitor continuously
# -r: recursive
# -e create: file/directory created
# -e moved_to: file/directory moved into watched directory
inotifywait -m -r -e create -e moved_to --format '%w%f' /workspace 2>/dev/null |
while read -r filepath; do
    # Skip if path doesn't exist (race condition)
    if [ ! -e "$filepath" ]; then
        continue
    fi
    
    # Fix permissions based on type
    if [ -d "$filepath" ]; then
        # Directory: 775 (rwxrwxr-x)
        chmod 775 "$filepath" 2>/dev/null || true
        echo "[Workspace Permissions Watcher] Fixed directory: $filepath"
    else
        # File: 664 (rw-rw-r--)
        chmod 664 "$filepath" 2>/dev/null || true
        
        # Make .sh files executable
        if [[ "$filepath" == *.sh ]]; then
            chmod 775 "$filepath" 2>/dev/null || true
            echo "[Workspace Permissions Watcher] Fixed executable: $filepath"
        else
            echo "[Workspace Permissions Watcher] Fixed file: $filepath"
        fi
    fi
    
    # Ensure ownership is correct
    chown coder:coder "$filepath" 2>/dev/null || true
done

