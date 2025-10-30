/**
 * Command Validator - Kiểm tra và chặn các lệnh nguy hiểm
 * Đảm bảo user chỉ được thao tác trong folder hiện tại
 */

class CommandValidator {
    constructor() {
        // Các lệnh bị cấm hoàn toàn
        this.blacklistedCommands = [
            'cd',           // Chặn di chuyển thư mục
            'pushd',        // Chặn di chuyển thư mục
            'popd',         // Chặn di chuyển thư mục
            'sudo',         // Chặn quyền root
            'su',           // Chặn switch user
            'chmod',        // Chặn thay đổi permissions
            'chown',        // Chặn thay đổi ownership
            'chgrp',        // Chặn thay đổi group
            'mount',        // Chặn mount filesystem
            'umount',       // Chặn unmount
            'reboot',       // Chặn reboot
            'shutdown',     // Chặn shutdown
            'init',         // Chặn init
            'systemctl',    // Chặn systemctl
            'service',      // Chặn service management
            'docker',       // Chặn docker commands
            'kubectl',      // Chặn kubernetes
            'ssh',          // Chặn SSH
            'scp',          // Chặn SCP
            'wget',         // Chặn download (có thể tải malware)
            'curl',         // Chặn download (ngoại trừ localhost)
            'nc',           // Chặn netcat
            'netcat',       // Chặn netcat
            'telnet',       // Chặn telnet
            'ftp',          // Chặn FTP
            'sftp',         // Chặn SFTP
        ];

        // Các pattern nguy hiểm
        this.dangerousPatterns = [
            /\.\./,                     // Chặn .. (parent directory)
            /\/workspace\/[^\/]+\//,    // Chặn truy cập workspace của user khác
            /\/etc\//,                  // Chặn truy cập /etc
            /\/root\//,                 // Chặn truy cập /root
            /\/home\//,                 // Chặn truy cập /home
            /\/var\//,                  // Chặn truy cập /var
            /\/usr\//,                  // Chặn truy cập /usr
            /\/bin\//,                  // Chặn truy cập /bin
            /\/sbin\//,                 // Chặn truy cập /sbin
            /\/tmp\//,                  // Chặn truy cập /tmp
            /rm\s+-rf\s+\//,            // Chặn rm -rf /
            /rm\s+-rf\s+\*/,            // Chặn rm -rf *
            />\s*\/dev\//,              // Chặn ghi vào /dev
            /&gt;\s*\/dev\//,           // Chặn ghi vào /dev (HTML encoded)
            /;\s*rm\s+-rf/,             // Chặn command injection với rm -rf
            /\|\s*rm\s+-rf/,            // Chặn pipe với rm -rf
            /&&\s*rm\s+-rf/,            // Chặn && với rm -rf
            /`.*`/,                     // Chặn command substitution
            /\$\(.*\)/,                 // Chặn command substitution
            />\s*\/etc\//,              // Chặn ghi vào /etc
            />\s*\/root\//,             // Chặn ghi vào /root
        ];

        // Các lệnh được phép (whitelist)
        this.allowedCommands = [
            // Compilers
            'g++', 'gcc', 'clang', 'clang++',
            'javac', 'java',
            'python', 'python3',
            'node', 'npm',
            'go', 'rustc', 'cargo',
            
            // File operations (trong thư mục hiện tại)
            'ls', 'cat', 'echo', 'pwd', 'touch', 'mkdir',
            'cp', 'mv', 'rm',  // Cho phép nhưng sẽ validate path
            
            // Text editors
            'vim', 'nano', 'vi',
            
            // Utilities
            'grep', 'find', 'wc', 'head', 'tail', 'sort', 'uniq',
            'diff', 'cmp',
            
            // Build tools
            'make', 'cmake',
            
            // Version control (local only)
            'git',
            
            // Process management (local only)
            'ps', 'top', 'htop', 'kill', 'killall',
            
            // Execution
            './solution', './a.out', './main',
        ];
    }

    /**
     * Validate command trước khi execute
     * @param {string} command - Command cần validate
     * @param {string} workspacePath - Workspace path của user
     * @returns {Object} - { valid: boolean, reason: string }
     */
    validate(command, workspacePath) {
        if (!command || typeof command !== 'string') {
            return {
                valid: false,
                reason: 'Command không hợp lệ'
            };
        }

        const trimmedCommand = command.trim();
        
        if (trimmedCommand.length === 0) {
            return {
                valid: false,
                reason: 'Command rỗng'
            };
        }

        // Kiểm tra độ dài command (chống command injection dài)
        if (trimmedCommand.length > 1000) {
            return {
                valid: false,
                reason: 'Command quá dài (tối đa 1000 ký tự)'
            };
        }

        // Tách command thành các phần
        const commandParts = this.parseCommand(trimmedCommand);
        const baseCommand = commandParts[0];

        // Kiểm tra blacklist
        if (this.blacklistedCommands.includes(baseCommand)) {
            return {
                valid: false,
                reason: `Lệnh "${baseCommand}" không được phép sử dụng`
            };
        }

        // Kiểm tra dangerous patterns
        for (const pattern of this.dangerousPatterns) {
            if (pattern.test(trimmedCommand)) {
                return {
                    valid: false,
                    reason: `Command chứa pattern nguy hiểm: ${pattern.toString()}`
                };
            }
        }

        // Kiểm tra path traversal
        if (this.hasPathTraversal(trimmedCommand, workspacePath)) {
            return {
                valid: false,
                reason: 'Không được phép truy cập thư mục bên ngoài workspace'
            };
        }

        // Kiểm tra command injection
        if (this.hasCommandInjection(trimmedCommand)) {
            return {
                valid: false,
                reason: 'Phát hiện command injection'
            };
        }

        // Kiểm tra file operations nguy hiểm
        if (this.hasDangerousFileOperation(trimmedCommand)) {
            return {
                valid: false,
                reason: 'File operation nguy hiểm không được phép'
            };
        }

        return {
            valid: true,
            reason: 'Command hợp lệ'
        };
    }

    /**
     * Parse command thành các phần
     */
    parseCommand(command) {
        // Xử lý pipes, redirects, và command chaining
        const cleanCommand = command
            .split('|')[0]      // Lấy phần trước pipe
            .split('>')[0]      // Lấy phần trước redirect
            .split('>>')[0]     // Lấy phần trước append
            .split('<')[0]      // Lấy phần trước input redirect
            .split(';')[0]      // Lấy phần trước semicolon
            .split('&&')[0]     // Lấy phần trước &&
            .split('||')[0]     // Lấy phần trước ||
            .trim();

        return cleanCommand.split(/\s+/);
    }

    /**
     * Kiểm tra path traversal
     */
    hasPathTraversal(command, workspacePath) {
        // Kiểm tra .. trong command
        if (command.includes('..')) {
            return true;
        }

        // Kiểm tra absolute paths ngoài workspace
        const absolutePathRegex = /\/[a-zA-Z0-9_\-\/]+/g;
        const matches = command.match(absolutePathRegex);
        
        if (matches) {
            for (const match of matches) {
                // Cho phép paths trong workspace
                if (!match.startsWith(workspacePath)) {
                    // Ngoại trừ một số paths an toàn
                    const safePaths = ['/dev/null', '/dev/stdin', '/dev/stdout', '/dev/stderr'];
                    if (!safePaths.includes(match)) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    /**
     * Kiểm tra command injection
     */
    hasCommandInjection(command) {
        const injectionPatterns = [
            /;\s*\w+/,          // Semicolon command chaining
            /\|\s*\w+/,         // Pipe to another command (cho phép pipe đơn giản)
            /&&\s*\w+/,         // AND command chaining
            /\|\|\s*\w+/,       // OR command chaining
            /`[^`]+`/,          // Backtick command substitution
            /\$\([^)]+\)/,      // $() command substitution
        ];

        // Cho phép một số patterns an toàn
        const safePatterns = [
            /\|\s*grep/,        // Pipe to grep
            /\|\s*wc/,          // Pipe to wc
            /\|\s*head/,        // Pipe to head
            /\|\s*tail/,        // Pipe to tail
            /\|\s*sort/,        // Pipe to sort
            />\s*\w+\.\w+/,     // Redirect to file
            />\s*output\.txt/,  // Redirect to output.txt
            /<\s*input\.txt/,   // Input from input.txt
        ];

        for (const pattern of injectionPatterns) {
            if (pattern.test(command)) {
                // Kiểm tra xem có phải safe pattern không
                let isSafe = false;
                for (const safePattern of safePatterns) {
                    if (safePattern.test(command)) {
                        isSafe = true;
                        break;
                    }
                }
                
                if (!isSafe) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * Kiểm tra file operations nguy hiểm
     */
    hasDangerousFileOperation(command) {
        const dangerousOps = [
            /rm\s+-rf\s+\*/,        // rm -rf *
            /rm\s+-rf\s+\//,        // rm -rf /
            /rm\s+-rf\s+~\//,       // rm -rf ~/
            /rm\s+-rf\s+\.\*/,      // rm -rf .*
            />\s*\/dev\/sd[a-z]/,   // Write to disk device
            /dd\s+if=/,             // dd command
            /mkfs/,                 // Format filesystem
            /fdisk/,                // Partition management
        ];

        for (const pattern of dangerousOps) {
            if (pattern.test(command)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Sanitize command để an toàn hơn
     */
    sanitize(command) {
        // Remove các ký tự đặc biệt nguy hiểm
        return command
            .replace(/[;&|`$()]/g, '')  // Remove command injection chars
            .trim();
    }
}

module.exports = new CommandValidator();

