#!/bin/bash
#
# Restricted Bash Wrapper for Code-Server Terminal
# This script wraps bash to prevent directory traversal and dangerous commands
# Used as default shell in code-server terminal
#

# Get the current working directory when shell starts
INITIAL_DIR="$(pwd)"

# Determine allowed directory based on workspace structure
# Format: /workspace/{username}/contest_{id}/problem_{id}
if [[ "$INITIAL_DIR" =~ ^/workspace/([^/]+)/contest_([0-9]+)/problem_([0-9]+)$ ]]; then
    ALLOWED_DIR="$INITIAL_DIR"
    USERNAME="${BASH_REMATCH[1]}"
    CONTEST_ID="${BASH_REMATCH[2]}"
    PROBLEM_ID="${BASH_REMATCH[3]}"
elif [[ "$INITIAL_DIR" =~ ^/workspace/([^/]+)/contest_([0-9]+)/problem_([0-9]+)/ ]]; then
    # If in subdirectory, get the problem directory
    ALLOWED_DIR="/workspace/${BASH_REMATCH[1]}/contest_${BASH_REMATCH[2]}/problem_${BASH_REMATCH[3]}"
    USERNAME="${BASH_REMATCH[1]}"
    CONTEST_ID="${BASH_REMATCH[2]}"
    PROBLEM_ID="${BASH_REMATCH[3]}"
else
    # Fallback: allow current directory only
    ALLOWED_DIR="$INITIAL_DIR"
    USERNAME=""
    CONTEST_ID=""
    PROBLEM_ID=""
fi

# Export for use in functions
export ALLOWED_DIR
export INITIAL_DIR

# Set restricted mode flag to prevent opening new shells
export RESTRICTED_MODE=1

# Function to check if path is within allowed directory
is_path_allowed() {
    local target_path="$1"
    
    # Convert to absolute path
    if [[ "$target_path" != /* ]]; then
        target_path="$(pwd)/$target_path"
    fi
    
    # Resolve .. and .
    target_path="$(readlink -f "$target_path" 2>/dev/null || echo "$target_path")"
    
    # Check if path starts with allowed directory
    if [[ "$target_path" == "$ALLOWED_DIR"* ]]; then
        return 0
    else
        return 1
    fi
}

# Override cd command
cd() {
    if [ $# -eq 0 ]; then
        # cd without arguments - block it
        echo "❌ Error: cd to home directory is not allowed" >&2
        echo "You can only operate within: $ALLOWED_DIR" >&2
        return 1
    fi
    
    local target="$1"
    
    # Block absolute paths outside workspace
    if [[ "$target" == /* ]] && [[ "$target" != "$ALLOWED_DIR"* ]]; then
        echo "❌ Error: Cannot access directory outside workspace" >&2
        echo "Allowed directory: $ALLOWED_DIR" >&2
        return 1
    fi
    
    # Block .. (parent directory)
    if [[ "$target" == *".."* ]]; then
        echo "❌ Error: Parent directory access (..) is not allowed" >&2
        echo "You can only operate within: $ALLOWED_DIR" >&2
        return 1
    fi
    
    # Block ~ (home directory)
    if [[ "$target" == "~"* ]]; then
        echo "❌ Error: Home directory access is not allowed" >&2
        echo "You can only operate within: $ALLOWED_DIR" >&2
        return 1
    fi
    
    # Try to change directory
    builtin cd "$target" 2>/dev/null
    local result=$?
    
    if [ $result -eq 0 ]; then
        # Check if new directory is within allowed path
        local new_dir="$(pwd)"
        if [[ "$new_dir" != "$ALLOWED_DIR"* ]]; then
            echo "❌ Error: Directory outside workspace detected" >&2
            echo "Reverting to: $ALLOWED_DIR" >&2
            builtin cd "$ALLOWED_DIR"
            return 1
        fi
    fi
    
    return $result
}

# Override pushd
pushd() {
    echo "❌ Error: pushd is disabled in restricted mode" >&2
    echo "Use 'cd' to navigate within: $ALLOWED_DIR" >&2
    return 1
}

# Override popd
popd() {
    echo "❌ Error: popd is disabled in restricted mode" >&2
    return 1
}

# Override sudo
sudo() {
    echo "❌ Error: sudo is not allowed" >&2
    echo "You do not have root privileges in this environment" >&2
    return 1
}

# Override su
su() {
    echo "❌ Error: su is not allowed" >&2
    echo "You cannot switch users in this environment" >&2
    return 1
}

# Override chmod (only allow in current directory)
chmod() {
    local has_dangerous_path=false
    
    for arg in "$@"; do
        # Skip flags
        if [[ "$arg" == -* ]]; then
            continue
        fi
        
        # Check if path contains ..
        if [[ "$arg" == *".."* ]]; then
            has_dangerous_path=true
            break
        fi
        
        # Check if absolute path outside workspace
        if [[ "$arg" == /* ]] && [[ "$arg" != "$ALLOWED_DIR"* ]]; then
            has_dangerous_path=true
            break
        fi
    done
    
    if [ "$has_dangerous_path" = true ]; then
        echo "❌ Error: chmod outside workspace is not allowed" >&2
        return 1
    fi
    
    # Execute chmod with original arguments
    command chmod "$@"
}

# Override chown
chown() {
    echo "❌ Error: chown is not allowed" >&2
    echo "You cannot change file ownership in this environment" >&2
    return 1
}

# Override chgrp
chgrp() {
    echo "❌ Error: chgrp is not allowed" >&2
    echo "You cannot change file group in this environment" >&2
    return 1
}

# Override bash command to prevent opening new shells
bash() {
    echo "❌ Error: Opening new bash shell is not allowed" >&2
    echo "You are already in a restricted shell environment" >&2
    return 1
}

# Override zsh command to prevent opening new shells
zsh() {
    echo "❌ Error: Opening zsh shell is not allowed" >&2
    echo "You are already in a restricted shell environment" >&2
    return 1
}

# Override sh command to prevent opening new shells
sh() {
    echo "❌ Error: Opening sh shell is not allowed" >&2
    echo "You are already in a restricted shell environment" >&2
    return 1
}

# Override exec to prevent shell escape (but allow it from this script)
exec() {
    # Get the caller information
    local caller_script="${BASH_SOURCE[1]}"

    # If called from this wrapper script itself, allow it
    if [[ "$caller_script" == *"restricted-bash-wrapper.sh" ]]; then
        builtin exec "$@"
        return $?
    fi

    # Check if trying to execute a shell
    if [[ "$1" =~ ^(bash|zsh|sh|/bin/bash|/bin/zsh|/bin/sh|/usr/bin/bash|/usr/bin/zsh)$ ]]; then
        echo "❌ Error: Executing new shell via exec is not allowed" >&2
        echo "You are already in a restricted shell environment" >&2
        return 1
    fi

    # Allow other exec commands
    builtin exec "$@"
}

# Export functions so they work in subshells
export -f cd pushd popd sudo su chmod chown chgrp is_path_allowed bash zsh sh exec

# Set umask to ensure new files have correct permissions
# umask 002 = directories: 775, files: 664
umask 002

# Set prompt to show restricted mode
export PS1="\[\033[01;31m\][RESTRICTED]\[\033[00m\] \[\033[01;32m\]\u@\h\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\$ "

# Display welcome message
echo "========================================="
echo "  Restricted Terminal Mode"
echo "========================================="
echo "Workspace: $ALLOWED_DIR"
echo ""
echo "⚠️  Restrictions:"
echo "  - Cannot use 'cd ..' to go to parent directory"
echo "  - Cannot access directories outside workspace"
echo "  - Cannot use sudo, su, chown, chgrp"
echo "  - Can only modify files in current workspace"
echo ""
echo "✅ Allowed:"
echo "  - Compile and run code (g++, python3, java, etc.)"
echo "  - View and edit files in workspace"
echo "  - Use programming tools and utilities"
echo "========================================="
echo ""

# Start interactive bash with restrictions
exec /bin/bash --norc --noprofile

