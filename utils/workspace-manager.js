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
     * @returns {Promise<Object>} Session info
     */
    async createOrGetSession(userId, username, contestId, problemId, problemCode) {
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
            await this.createWorkspaceStructure(workspacePath, problemCode);

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
    async createWorkspaceStructure(workspacePath, problemCode) {
        try {
            const fullPath = path.join(this.workspaceRoot, workspacePath);

            // Tạo folder nếu chưa có
            await fs.mkdir(fullPath, { recursive: true });

            // Tạo file README.md hướng dẫn
            const readmePath = path.join(fullPath, 'README.md');
            const readmeExists = await this.fileExists(readmePath);

            if (!readmeExists) {
                await fs.writeFile(readmePath, this.getReadmeTemplate(problemCode));
            }

            // Tạo file chính nếu chưa có
            await this.createMainFileIfNeeded(fullPath, problemCode);

            console.log(`[WorkspaceManager] Workspace structure created at ${fullPath}`);

        } catch (error) {
            console.error('[WorkspaceManager] Error creating workspace structure:', error);
            throw error;
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
                await fs.writeFile(mainFilePath, this.getCppTemplate(problemCode));
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

            console.log(`[WorkspaceManager] Synced ${syncedCount} files (${totalSize} bytes) for session ${sessionId}`);

            return {
                success: true,
                filesCount: syncedCount,
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
                        const isMainFile = entry.name.startsWith(problemCode);

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

    getReadmeTemplate(problemCode) {
        return `# Problem: ${problemCode}

## Instructions
- Create your solution in the main file: **${problemCode}.cpp** (or .py, .java)
- You can create additional files (utils.cpp, utils.h, etc.)
- Use the terminal to compile and test your code
- Files are auto-saved every 5 minutes
- Click "Save" button to save manually

## Example for C++:
\`\`\`bash
g++ ${problemCode}.cpp -o program
./program < input.txt
\`\`\`

## Example for Python:
\`\`\`bash
python3 ${problemCode}.py < input.txt
\`\`\`

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

