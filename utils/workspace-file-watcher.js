/**
 * Workspace File Watcher
 * Theo dõi thay đổi file trong workspace và đồng bộ với database
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const db = require('../config/database');
const workspaceManager = require('./workspace-manager');

class WorkspaceFileWatcher {
    constructor() {
        this.watchers = new Map(); // sessionId -> watcher instance
        this.debounceTimers = new Map(); // sessionId -> timer
        this.DEBOUNCE_DELAY = 1000; // 1 second
    }

    /**
     * Bắt đầu watch một workspace
     */
    async startWatching(sessionId, workspacePath, userId, contestId, problemId, problemCode) {
        try {
            // Nếu đã watch rồi thì skip
            if (this.watchers.has(sessionId)) {
                console.log(`[FileWatcher] Already watching session ${sessionId}`);
                return;
            }

            const fullPath = path.join(workspaceManager.workspaceRoot, workspacePath);

            // Kiểm tra workspace có tồn tại không
            try {
                await fs.access(fullPath);
            } catch (error) {
                console.error(`[FileWatcher] Workspace not found: ${fullPath}`);
                return;
            }

            // Tạo watcher
            const watcher = fsSync.watch(fullPath, { recursive: true }, (eventType, filename) => {
                if (!filename) return;

                // Bỏ qua hidden files và folders
                if (filename.startsWith('.')) return;

                // Bỏ qua non-code files
                if (!workspaceManager.isCodeFile(filename)) return;

                console.log(`[FileWatcher] File ${eventType}: ${filename} in session ${sessionId}`);

                // Debounce để tránh sync quá nhiều lần
                this.debouncedSync(sessionId, userId, contestId, problemId, problemCode);
            });

            this.watchers.set(sessionId, {
                watcher,
                workspacePath,
                userId,
                contestId,
                problemId,
                problemCode
            });

            console.log(`[FileWatcher] Started watching session ${sessionId} at ${workspacePath}`);

        } catch (error) {
            console.error(`[FileWatcher] Error starting watcher for session ${sessionId}:`, error);
        }
    }

    /**
     * Dừng watch một workspace
     */
    stopWatching(sessionId) {
        const watcherInfo = this.watchers.get(sessionId);
        if (watcherInfo) {
            watcherInfo.watcher.close();
            this.watchers.delete(sessionId);
            
            // Clear debounce timer nếu có
            const timer = this.debounceTimers.get(sessionId);
            if (timer) {
                clearTimeout(timer);
                this.debounceTimers.delete(sessionId);
            }

            console.log(`[FileWatcher] Stopped watching session ${sessionId}`);
        }
    }

    /**
     * Debounced sync - chỉ sync sau khi không có thay đổi trong DEBOUNCE_DELAY ms
     */
    debouncedSync(sessionId, userId, contestId, problemId, problemCode) {
        // Clear timer cũ nếu có
        const existingTimer = this.debounceTimers.get(sessionId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Tạo timer mới
        const timer = setTimeout(async () => {
            try {
                console.log(`[FileWatcher] Syncing files for session ${sessionId}...`);
                
                await workspaceManager.syncFilesToDatabase(
                    sessionId,
                    userId,
                    contestId,
                    problemId,
                    problemCode
                );

                console.log(`[FileWatcher] Sync completed for session ${sessionId}`);
                
                // Emit event để client refresh file list (sẽ implement sau)
                this.notifyClients(sessionId);

            } catch (error) {
                console.error(`[FileWatcher] Sync error for session ${sessionId}:`, error);
            } finally {
                this.debounceTimers.delete(sessionId);
            }
        }, this.DEBOUNCE_DELAY);

        this.debounceTimers.set(sessionId, timer);
    }

    /**
     * Notify clients về file changes (placeholder - sẽ implement WebSocket sau)
     */
    notifyClients(sessionId) {
        // TODO: Implement WebSocket notification
        console.log(`[FileWatcher] Would notify clients for session ${sessionId}`);
    }

    /**
     * Cleanup tất cả watchers
     */
    cleanup() {
        console.log(`[FileWatcher] Cleaning up ${this.watchers.size} watchers...`);
        
        for (const [sessionId, watcherInfo] of this.watchers.entries()) {
            watcherInfo.watcher.close();
        }
        
        this.watchers.clear();
        
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        
        this.debounceTimers.clear();
        
        console.log('[FileWatcher] Cleanup completed');
    }

    /**
     * Lấy thông tin về các watchers đang hoạt động
     */
    getActiveWatchers() {
        const active = [];
        for (const [sessionId, info] of this.watchers.entries()) {
            active.push({
                sessionId,
                workspacePath: info.workspacePath,
                userId: info.userId,
                contestId: info.contestId,
                problemId: info.problemId
            });
        }
        return active;
    }
}

// Singleton instance
const fileWatcher = new WorkspaceFileWatcher();

// Cleanup on process exit
process.on('SIGINT', () => {
    fileWatcher.cleanup();
    process.exit(0);
});

process.on('SIGTERM', () => {
    fileWatcher.cleanup();
    process.exit(0);
});

module.exports = fileWatcher;

