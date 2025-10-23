/**
 * Workspace Client
 * Client-side JavaScript cho localStorage và auto-save
 * 
 * Features:
 * - Lưu files vào localStorage với TTL 7 ngày
 * - Auto-sync lên server mỗi 5 phút
 * - Nút Save thủ công
 * - Restore từ localStorage khi vào lại
 */

class WorkspaceClient {
    constructor() {
        this.sessionId = null;
        this.contestId = null;
        this.problemId = null;
        this.problemCode = null;
        this.autoSaveInterval = null;
        this.syncStatus = 'idle'; // idle, saving, saved, error
        this.STORAGE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 ngày
        this.AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 phút
    }

    /**
     * Khởi tạo workspace
     */
    async init(contestId, problemId) {
        this.contestId = contestId;
        this.problemId = problemId;

        try {
            // Tạo hoặc lấy session
            const response = await fetch('/api/workspace/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contestId, problemId })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            this.sessionId = data.session.sessionId;
            this.workspacePath = data.session.workspacePath;

            console.log('[WorkspaceClient] Session created:', this.sessionId);

            // Restore từ localStorage nếu có
            await this.restoreFromLocalStorage();

            // Bắt đầu auto-save
            this.startAutoSave();

            // Setup event listeners
            this.setupEventListeners();

            return data.session;

        } catch (error) {
            console.error('[WorkspaceClient] Init error:', error);
            throw error;
        }
    }

    /**
     * Lưu files vào localStorage
     */
    saveToLocalStorage(files) {
        try {
            const key = this.getStorageKey();
            const data = {
                files: files,
                timestamp: Date.now(),
                expiry: Date.now() + this.STORAGE_TTL,
                sessionId: this.sessionId,
                contestId: this.contestId,
                problemId: this.problemId
            };

            localStorage.setItem(key, JSON.stringify(data));
            console.log('[WorkspaceClient] Saved to localStorage:', files.length, 'files');

        } catch (error) {
            console.error('[WorkspaceClient] localStorage save error:', error);
        }
    }

    /**
     * Restore từ localStorage
     */
    async restoreFromLocalStorage() {
        try {
            const key = this.getStorageKey();
            const stored = localStorage.getItem(key);

            if (!stored) {
                console.log('[WorkspaceClient] No localStorage data found');
                return null;
            }

            const data = JSON.parse(stored);

            // Check expiry
            if (Date.now() > data.expiry) {
                console.log('[WorkspaceClient] localStorage data expired, removing...');
                localStorage.removeItem(key);
                return null;
            }

            console.log('[WorkspaceClient] Restored from localStorage:', data.files.length, 'files');
            return data.files;

        } catch (error) {
            console.error('[WorkspaceClient] localStorage restore error:', error);
            return null;
        }
    }

    /**
     * Sync files lên server
     */
    async syncToServer() {
        if (this.syncStatus === 'saving') {
            console.log('[WorkspaceClient] Sync already in progress');
            return;
        }

        try {
            this.setSyncStatus('saving');

            const response = await fetch('/api/workspace/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    contestId: this.contestId,
                    problemId: this.problemId
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            console.log('[WorkspaceClient] Synced to server:', data.filesCount, 'files');
            this.setSyncStatus('saved');

            // Auto-hide "Saved" status sau 3 giây
            setTimeout(() => {
                if (this.syncStatus === 'saved') {
                    this.setSyncStatus('idle');
                }
            }, 3000);

            return data;

        } catch (error) {
            console.error('[WorkspaceClient] Sync error:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    /**
     * Submit code
     */
    async submitCode() {
        try {
            this.setSyncStatus('saving');

            const response = await fetch('/api/workspace/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    contestId: this.contestId,
                    problemId: this.problemId
                })
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            console.log('[WorkspaceClient] Code submitted:', data.filesCount, 'files');
            this.setSyncStatus('saved');

            return data;

        } catch (error) {
            console.error('[WorkspaceClient] Submit error:', error);
            this.setSyncStatus('error');
            throw error;
        }
    }

    /**
     * Bắt đầu auto-save
     */
    startAutoSave() {
        // Clear existing interval
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }

        // Auto-save mỗi 5 phút
        this.autoSaveInterval = setInterval(async () => {
            console.log('[WorkspaceClient] Auto-save triggered');
            try {
                await this.syncToServer();
            } catch (error) {
                console.error('[WorkspaceClient] Auto-save failed:', error);
            }
        }, this.AUTO_SAVE_INTERVAL);

        console.log('[WorkspaceClient] Auto-save started (every 5 minutes)');
    }

    /**
     * Dừng auto-save
     */
    stopAutoSave() {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = null;
            console.log('[WorkspaceClient] Auto-save stopped');
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Save trước khi unload
        window.addEventListener('beforeunload', async (e) => {
            try {
                // Sync to server (best effort)
                await this.syncToServer();
            } catch (error) {
                console.error('[WorkspaceClient] beforeunload sync error:', error);
            }
        });

        // Cleanup localStorage expired data khi load
        this.cleanupExpiredLocalStorage();
    }

    /**
     * Cleanup localStorage expired data
     */
    cleanupExpiredLocalStorage() {
        try {
            const keys = Object.keys(localStorage);
            const prefix = 'workspace_';
            let cleanedCount = 0;

            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    try {
                        const data = JSON.parse(localStorage.getItem(key));
                        if (data.expiry && Date.now() > data.expiry) {
                            localStorage.removeItem(key);
                            cleanedCount++;
                        }
                    } catch (err) {
                        // Invalid data, remove it
                        localStorage.removeItem(key);
                        cleanedCount++;
                    }
                }
            });

            if (cleanedCount > 0) {
                console.log('[WorkspaceClient] Cleaned up', cleanedCount, 'expired localStorage items');
            }

        } catch (error) {
            console.error('[WorkspaceClient] Cleanup error:', error);
        }
    }

    /**
     * Set sync status và update UI
     */
    setSyncStatus(status) {
        this.syncStatus = status;

        // Update UI nếu có element
        const statusElement = document.getElementById('sync-status');
        if (statusElement) {
            switch (status) {
                case 'saving':
                    statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang lưu...';
                    statusElement.className = 'sync-status saving';
                    break;
                case 'saved':
                    statusElement.innerHTML = '<i class="fas fa-check"></i> Đã lưu';
                    statusElement.className = 'sync-status saved';
                    break;
                case 'error':
                    statusElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Lỗi';
                    statusElement.className = 'sync-status error';
                    break;
                default:
                    statusElement.innerHTML = '';
                    statusElement.className = 'sync-status idle';
            }
        }

        // Dispatch event
        window.dispatchEvent(new CustomEvent('workspace-sync-status', {
            detail: { status }
        }));
    }

    /**
     * Get localStorage key
     */
    getStorageKey() {
        return `workspace_${this.contestId}_${this.problemId}`;
    }

    /**
     * Get session status
     */
    async getStatus() {
        try {
            const response = await fetch(`/api/workspace/status/${this.sessionId}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.message);
            }

            return data.session;

        } catch (error) {
            console.error('[WorkspaceClient] Get status error:', error);
            throw error;
        }
    }

    /**
     * Destroy workspace client
     */
    destroy() {
        this.stopAutoSave();
        console.log('[WorkspaceClient] Destroyed');
    }
}

// Export global instance
window.WorkspaceClient = WorkspaceClient;

