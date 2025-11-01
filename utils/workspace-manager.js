/**
 * Workspace Manager
 * Quản lý workspace folders cho code-server integration
 * 
 * Cấu trúc:
 * /workspace/
 *   ├── {username}/
 *   │   ├── contest_{id}/
 *   │   │   ├── problem_{id}/
 *   │   │   │   ├── {problem_code}.cpp  (file chính)
 *   │   │   │   ├── utils.cpp
 *   │   │   │   └── utils.h
 */

const fs = require('fs').promises;
const path = require('path');
const db = require('../config/database');

class WorkspaceManager {
    constructor() {
        // Workspace root - có thể config qua env
        this.workspaceRoot = process.env.WORKSPACE_ROOT || '/workspace';
    }

    /**
     * Tạo hoặc lấy workspace session
     * @param {number} userId
     * @param {string} username
     * @param {number} contestId
     * @param {number} problemId
     * @param {string} problemCode - Mã bài (ví dụ: PROB001)
     * @param {string} pdfPath - Đường dẫn đến file PDF đề bài
     * @returns {Promise<Object>} Session info
     */
    async createOrGetSession(userId, username, contestId, problemId, problemCode, pdfPath = null) {
        try {
            // Tạo workspace path
            const workspacePath = this.getWorkspacePath(username, contestId, problemId);

            // Check session đã tồn tại chưa
            const [existingSessions] = await db.query(`
                SELECT * FROM workspace_sessions
                WHERE user_id = ? AND contest_id = ? AND problem_id = ?
                AND is_active = TRUE
            `, [userId, contestId, problemId]);

            let session;

            if (existingSessions.length > 0) {
                // Session đã tồn tại - update last_accessed
                session = existingSessions[0];
                
                await db.query(`
                    UPDATE workspace_sessions
                    SET last_accessed = NOW()
                    WHERE id = ?
                `, [session.id]);

                console.log(`[WorkspaceManager] Reusing session ${session.id} for user ${username}`);
            } else {
                // Tạo session mới
                const [result] = await db.query(`
                    INSERT INTO workspace_sessions
                    (user_id, username, contest_id, problem_id, workspace_path, expires_at)
                    VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
                `, [userId, username, contestId, problemId, workspacePath]);

                session = {
                    id: result.insertId,
                    user_id: userId,
                    username: username,
                    contest_id: contestId,
                    problem_id: problemId,
                    workspace_path: workspacePath
                };

                console.log(`[WorkspaceManager] Created new session ${session.id} for user ${username}`);
            }

            // Tạo workspace folder structure
            await this.createWorkspaceStructure(workspacePath, problemCode, pdfPath);

            return {
                sessionId: session.id,
                workspacePath: workspacePath,
                fullPath: path.join(this.workspaceRoot, workspacePath)
            };

        } catch (error) {
            console.error('[WorkspaceManager] Error creating session:', error);
            throw error;
        }
    }

    /**
     * Tạo workspace path
     */
    getWorkspacePath(username, contestId, problemId) {
        return `${username}/contest_${contestId}/problem_${problemId}`;
    }

    /**
     * Tạo folder structure và file template
     */
    async createWorkspaceStructure(workspacePath, problemCode, pdfPath = null) {
        try {
            const fullPath = path.join(this.workspaceRoot, workspacePath);

            // Tạo folder nếu chưa có
            await fs.mkdir(fullPath, { recursive: true, mode: 0o775 });

            // Tạo .vscode folder
            const vscodePath = path.join(fullPath, '.vscode');
            await fs.mkdir(vscodePath, { recursive: true, mode: 0o775 });

            // Tạo tasks.json
            await this.createVSCodeTasks(vscodePath);

            // Tạo auto-run.sh script
            await this.createAutoRunScript(vscodePath);

            // Tạo file README.md hướng dẫn
            const readmePath = path.join(fullPath, 'README.md');
            const readmeExists = await this.fileExists(readmePath);

            if (!readmeExists) {
                await fs.writeFile(readmePath, this.getReadmeTemplate(problemCode), { mode: 0o664 });
            }

            // Tạo file input.txt mẫu
            const inputPath = path.join(fullPath, 'input.txt');
            const inputExists = await this.fileExists(inputPath);
            if (!inputExists) {
                await fs.writeFile(inputPath, '# Nhập test case của bạn vào đây\n# Ví dụ:\n# 5 3\n', { mode: 0o664 });
            }

            // Tạo file chính nếu chưa có
            await this.createMainFileIfNeeded(fullPath, problemCode);

            console.log(`[WorkspaceManager] Workspace structure created at ${fullPath}`);
            console.log(`[WorkspaceManager] Note: Permissions will be automatically fixed by cron job`);

        } catch (error) {
            console.error('[WorkspaceManager] Error creating workspace structure:', error);
            throw error;
        }
    }

    /**
     * Tạo VSCode tasks.json
     */
    async createVSCodeTasks(vscodePath) {
        try {
            const tasksPath = path.join(vscodePath, 'tasks.json');
            const tasksExists = await this.fileExists(tasksPath);

            if (!tasksExists) {
                const templatePath = path.join(__dirname, '../templates/vscode-tasks.json');
                const templateContent = await fs.readFile(templatePath, 'utf8');
                await fs.writeFile(tasksPath, templateContent);
                console.log(`[WorkspaceManager] Created tasks.json`);
            }
        } catch (error) {
            console.error('[WorkspaceManager] Error creating tasks.json:', error);
        }
    }

    /**
     * Tạo auto-run.sh script
     */
    async createAutoRunScript(vscodePath) {
        try {
            const scriptPath = path.join(vscodePath, 'auto-run.sh');
            const scriptExists = await this.fileExists(scriptPath);

            if (!scriptExists) {
                const templatePath = path.join(__dirname, '../templates/auto-run.sh');
                const templateContent = await fs.readFile(templatePath, 'utf8');
                await fs.writeFile(scriptPath, templateContent);

                // Make script executable
                await fs.chmod(scriptPath, 0o755);
                console.log(`[WorkspaceManager] Created auto-run.sh`);
            }
        } catch (error) {
            console.error('[WorkspaceManager] Error creating auto-run.sh:', error);
        }
    }

    /**
     * Tạo file chính (main file) nếu chưa có
     */
    async createMainFileIfNeeded(workspacePath, problemCode) {
        try {
            // Check xem đã có file code nào chưa
            const files = await fs.readdir(workspacePath);
            const codeFiles = files.filter(f => this.isCodeFile(f));

            if (codeFiles.length === 0) {
                // Chưa có file code nào - tạo template
                const mainFilePath = path.join(workspacePath, `${problemCode}.cpp`);
                await fs.writeFile(mainFilePath, this.getCppTemplate(problemCode), { mode: 0o664 });
                console.log(`[WorkspaceManager] Created main file: ${problemCode}.cpp`);
            }

        } catch (error) {
            console.error('[WorkspaceManager] Error creating main file:', error);
        }
    }

    /**
     * Sync files từ filesystem vào database
     */
    async syncFilesToDatabase(sessionId, userId, contestId, problemId, problemCode) {
        try {
            // Lấy workspace path
            const [sessions] = await db.query(
                'SELECT workspace_path FROM workspace_sessions WHERE id = ?',
                [sessionId]
            );

            if (sessions.length === 0) {
                throw new Error('Session not found');
            }

            const workspacePath = sessions[0].workspace_path;
            const fullPath = path.join(this.workspaceRoot, workspacePath);

            // Scan tất cả files
            const files = await this.scanWorkspaceFiles(fullPath, problemCode);

            // Lấy danh sách files hiện có trong database
            const [existingFiles] = await db.query(`
                SELECT file_name FROM workspace_files
                WHERE session_id = ? AND user_id = ? AND contest_id = ? AND problem_id = ?
            `, [sessionId, userId, contestId, problemId]);

            const existingFileNames = new Set(existingFiles.map(f => f.file_name));
            const currentFileNames = new Set(files.map(f => f.name));

            // Xóa files không còn tồn tại trong filesystem
            let deletedCount = 0;
            for (const existingFileName of existingFileNames) {
                if (!currentFileNames.has(existingFileName)) {
                    await db.query(`
                        DELETE FROM workspace_files
                        WHERE session_id = ? AND file_name = ?
                    `, [sessionId, existingFileName]);
                    deletedCount++;
                    console.log(`[WorkspaceManager] Deleted file from DB: ${existingFileName}`);
                }
            }

            // Lưu vào database
            let syncedCount = 0;
            let totalSize = 0;

            for (const file of files) {
                await db.query(`
                    INSERT INTO workspace_files
                    (session_id, user_id, contest_id, problem_id,
                     file_path, file_name, file_content, file_size, file_type,
                     is_main_file, synced_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
                    ON DUPLICATE KEY UPDATE
                        file_content = VALUES(file_content),
                        file_size = VALUES(file_size),
                        updated_at = NOW(),
                        synced_at = NOW()
                `, [
                    sessionId, userId, contestId, problemId,
                    file.relativePath, file.name, file.content, file.size, file.type,
                    file.isMainFile
                ]);

                syncedCount++;
                totalSize += file.size;
            }

            // Update session last_sync_time
            await db.query(`
                UPDATE workspace_sessions
                SET last_sync_time = NOW()
                WHERE id = ?
            `, [sessionId]);

            // Log sync
            await db.query(`
                INSERT INTO workspace_sync_log
                (session_id, user_id, sync_type, files_count, total_size, status)
                VALUES (?, ?, 'auto', ?, ?, 'success')
            `, [sessionId, userId, syncedCount, totalSize]);

            console.log(`[WorkspaceManager] Synced ${syncedCount} files, deleted ${deletedCount} files (${totalSize} bytes) for session ${sessionId}`);

            return {
                success: true,
                filesCount: syncedCount,
                deletedCount: deletedCount,
                totalSize: totalSize
            };

        } catch (error) {
            console.error('[WorkspaceManager] Error syncing files:', error);

            // Log error
            await db.query(`
                INSERT INTO workspace_sync_log
                (session_id, user_id, sync_type, status, error_message)
                VALUES (?, ?, 'auto', 'failed', ?)
            `, [sessionId, userId, error.message]);

            throw error;
        }
    }

    /**
     * Scan tất cả files trong workspace
     */
    async scanWorkspaceFiles(workspacePath, problemCode) {
        const files = [];

        async function scanDir(dir, baseDir = '') {
            const entries = await fs.readdir(dir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                const relativePath = path.join(baseDir, entry.name);

                if (entry.isDirectory()) {
                    // Bỏ qua hidden folders và node_modules
                    if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                        await scanDir(fullPath, relativePath);
                    }
                } else {
                    // Chỉ lấy code files
                    if (this.isCodeFile(entry.name)) {
                        const content = await fs.readFile(fullPath, 'utf8');
                        const stats = await fs.stat(fullPath);
                        const fileType = this.getFileType(entry.name);

                        // Xác định main file: tên file (không kể extension) trùng với problemCode
                        const baseName = path.basename(entry.name, path.extname(entry.name));
                        const isMainFile = baseName === problemCode;

                        files.push({
                            name: entry.name,
                            relativePath: relativePath,
                            content: content,
                            size: stats.size,
                            type: fileType,
                            isMainFile: isMainFile
                        });
                    }
                }
            }
        }

        await scanDir.call(this, workspacePath);
        return files;
    }

    /**
     * Lấy files từ database
     */
    async getFilesFromDatabase(userId, contestId, problemId) {
        try {
            const [files] = await db.query(`
                CALL get_workspace_files(?, ?, ?)
            `, [userId, contestId, problemId]);

            return files[0] || [];

        } catch (error) {
            console.error('[WorkspaceManager] Error getting files:', error);
            throw error;
        }
    }

    /**
     * Cleanup expired workspaces
     */
    async cleanupExpiredWorkspaces() {
        try {
            console.log('[WorkspaceManager] Running cleanup...');

            // Gọi stored procedure
            await db.query('CALL cleanup_expired_workspaces()');

            // Xóa folders trên filesystem
            const [expiredSessions] = await db.query(`
                SELECT workspace_path
                FROM workspace_sessions
                WHERE is_active = FALSE
                AND expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY)
            `);

            for (const session of expiredSessions) {
                const fullPath = path.join(this.workspaceRoot, session.workspace_path);
                try {
                    await fs.rm(fullPath, { recursive: true, force: true });
                    console.log(`[WorkspaceManager] Deleted folder: ${fullPath}`);
                } catch (err) {
                    console.error(`[WorkspaceManager] Error deleting ${fullPath}:`, err);
                }
            }

            console.log(`[WorkspaceManager] Cleanup completed. Deleted ${expiredSessions.length} folders.`);

        } catch (error) {
            console.error('[WorkspaceManager] Cleanup error:', error);
        }
    }

    // ========== Helper Methods ==========

    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }

    isCodeFile(filename) {
        const codeExtensions = ['.cpp', '.c', '.h', '.hpp', '.py', '.java', '.js', '.ts', '.go', '.rs'];
        return codeExtensions.some(ext => filename.endsWith(ext));
    }

    getFileType(filename) {
        const ext = path.extname(filename).toLowerCase();
        return ext.substring(1); // Remove dot
    }

    /**
     * Tìm main file trong danh sách files
     * Ưu tiên file có tên trùng với problemCode, nếu không có thì lấy file code đầu tiên
     */
    findMainFile(files, problemCode) {
        const codeExtensions = ['.cpp', '.c', '.py', '.java', '.js', '.go', '.rs', '.ts'];
        let mainFileName = null;
        let codeFiles = [];

        for (const file of files) {
            const fileName = typeof file === 'string' ? file : file.name;
            const baseName = fileName.substring(0, fileName.lastIndexOf('.')) || fileName;
            const ext = path.extname(fileName).toLowerCase();

            if (codeExtensions.includes(ext)) {
                codeFiles.push(fileName);

                // Ưu tiên file có tên trùng với problemCode
                if (baseName === problemCode) {
                    mainFileName = fileName;
                    break;
                }
            }
        }

        // Nếu không tìm thấy file trùng tên, lấy file code đầu tiên
        if (!mainFileName && codeFiles.length > 0) {
            mainFileName = codeFiles[0];
        }

        return mainFileName;
    }

    getReadmeTemplate(problemCode) {
        return `# Problem: ${problemCode}

## 📄 Xem Đề Bài
- Click nút "Xem đề bài" trên thanh công cụ để xem đề bài chi tiết
- Đề bài sẽ hiển thị bên cạnh code editor

## 🚀 Cách Compile và Run Code

### Phương pháp 1: Sử dụng VSCode Tasks (Khuyến nghị)

**Phím tắt:**
- \`Ctrl+Shift+B\` (hoặc \`Cmd+Shift+B\` trên Mac): Build code
- \`Ctrl+Shift+T\` (hoặc \`Cmd+Shift+T\` trên Mac): Build và Run

**Hoặc sử dụng Command Palette:**
1. Nhấn \`Ctrl+Shift+P\` (hoặc \`Cmd+Shift+P\`)
2. Gõ "Run Task"
3. Chọn task phù hợp:
   - **C++**: Chọn phiên bản C++ (14, 17, 20, 23)
   - **Python**: Chọn "Python: Run"
   - **Java**: Chọn "Java: Compile and Run"

### Phương pháp 2: Sử dụng Terminal

**Mở Terminal:**
- Menu: Terminal → New Terminal
- Phím tắt: \`Ctrl+\`\` (backtick)

**C++ (chọn phiên bản):**
\`\`\`bash
# C++14
g++ -std=c++14 -Wall -Wextra -O2 ${problemCode}.cpp -o solution
./solution < input.txt

# C++17
g++ -std=c++17 -Wall -Wextra -O2 ${problemCode}.cpp -o solution
./solution < input.txt

# C++20 (mặc định)
g++ -std=c++20 -Wall -Wextra -O2 ${problemCode}.cpp -o solution
./solution < input.txt

# C++23
g++ -std=c++23 -Wall -Wextra -O2 ${problemCode}.cpp -o solution
./solution < input.txt
\`\`\`

**Python:**
\`\`\`bash
python3 ${problemCode}.py < input.txt
\`\`\`

**Java:**
\`\`\`bash
javac ${problemCode}.java
java ${problemCode} < input.txt
\`\`\`

### Phương pháp 3: Auto-Run Script

Script tự động detect ngôn ngữ và compile/run:

\`\`\`bash
# Tự động detect và run (C++ mặc định dùng C++20)
./.vscode/auto-run.sh ${problemCode}.cpp

# Chỉ định phiên bản C++
./.vscode/auto-run.sh ${problemCode}.cpp c++17

# Python
./.vscode/auto-run.sh ${problemCode}.py

# Java
./.vscode/auto-run.sh ${problemCode}.java
\`\`\`

## 📝 Test với Input

1. Tạo file \`input.txt\` trong workspace
2. Nhập test case vào file này
3. Khi run code, input sẽ tự động được đọc từ file

## 💾 Lưu Code

- **Auto-save**: Code tự động lưu mỗi 5 phút
- **Manual save**: Click nút "Lưu" trên thanh công cụ
- **Submit**: Click nút "Nộp bài" khi hoàn thành

## 📌 Lưu ý

- File chính phải có tên giống mã bài: \`${problemCode}.cpp\`, \`${problemCode}.py\`, hoặc \`${problemCode}.java\`
- Hệ thống tự động detect ngôn ngữ dựa vào đuôi file chính
- Bạn có thể tạo thêm file phụ (utils.h, helper.cpp, etc.)

Good luck! 🚀
`;
    }

    getCppTemplate(problemCode) {
        return `#include <iostream>
using namespace std;

int main() {
    // Your solution for ${problemCode}
    
    return 0;
}
`;
    }
}

module.exports = new WorkspaceManager();

