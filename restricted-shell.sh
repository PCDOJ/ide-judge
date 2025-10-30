#!/bin/bash
#
# Restricted Shell Wrapper
# Hạn chế user chỉ được thao tác trong thư mục hiện tại
# Không cho phép cd, .., và các lệnh nguy hiểm khác
#

set -e

# Lưu working directory ban đầu
ORIGINAL_PWD="$(pwd)"
ALLOWED_DIR="$ORIGINAL_PWD"

# Command được truyền vào
COMMAND="$1"

if [ -z "$COMMAND" ]; then
    echo "Error: No command provided" >&2
    exit 1
fi

# ===== VALIDATION LAYER 2: Shell-level validation =====

# Kiểm tra các lệnh bị cấm
FORBIDDEN_COMMANDS=(
    "cd"
    "pushd"
    "popd"
    "sudo"
    "su"
    "chmod"
    "chown"
    "chgrp"
    "mount"
    "umount"
    "reboot"
    "shutdown"
    "systemctl"
    "service"
    "docker"
    "ssh"
    "scp"
)

# Kiểm tra command có chứa lệnh bị cấm không
for forbidden in "${FORBIDDEN_COMMANDS[@]}"; do
    if echo "$COMMAND" | grep -qE "(^|[[:space:];|&])$forbidden([[:space:];|&]|$)"; then
        echo "❌ Error: Command '$forbidden' is not allowed" >&2
        echo "You can only operate within the current directory." >&2
        exit 1
    fi
done

# Kiểm tra path traversal (..)
if echo "$COMMAND" | grep -q "\.\."; then
    echo "❌ Error: Path traversal (..) is not allowed" >&2
    echo "You can only access files in the current directory." >&2
    exit 1
fi

# Kiểm tra absolute paths ngoài workspace
if echo "$COMMAND" | grep -qE "/(etc|root|home|var|usr|bin|sbin|tmp)/"; then
    echo "❌ Error: Access to system directories is not allowed" >&2
    echo "You can only access files in your workspace." >&2
    exit 1
fi

# Kiểm tra dangerous file operations
if echo "$COMMAND" | grep -qE "rm[[:space:]]+-rf[[:space:]]+(/|\*|~/)"; then
    echo "❌ Error: Dangerous file operation detected" >&2
    echo "rm -rf with wildcard or root path is not allowed." >&2
    exit 1
fi

# ===== EXECUTE COMMAND IN RESTRICTED ENVIRONMENT =====

# Tạo temporary restricted environment
# Disable cd, pushd, popd bằng cách override functions
RESTRICTED_ENV='
# Override cd to prevent directory change
cd() {
    echo "❌ Error: cd command is disabled in restricted mode" >&2
    echo "You can only operate within: '"$ALLOWED_DIR"'" >&2
    return 1
}

# Override pushd
pushd() {
    echo "❌ Error: pushd command is disabled in restricted mode" >&2
    return 1
}

# Override popd
popd() {
    echo "❌ Error: popd command is disabled in restricted mode" >&2
    return 1
}

# Export functions
export -f cd pushd popd

# Execute user command
'"$COMMAND"'
'

# Execute trong restricted environment
# Sử dụng bash -c với restricted mode
bash -c "$RESTRICTED_ENV"
EXIT_CODE=$?

# Verify working directory hasn't changed
CURRENT_PWD="$(pwd)"
if [ "$CURRENT_PWD" != "$ORIGINAL_PWD" ]; then
    echo "⚠️  Warning: Working directory changed from $ORIGINAL_PWD to $CURRENT_PWD" >&2
    echo "Restoring original directory..." >&2
    cd "$ORIGINAL_PWD" || true
fi

exit $EXIT_CODE

