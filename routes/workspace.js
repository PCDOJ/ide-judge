/**
 * Workspace Routes
 * API endpoints cho code-server workspace management
 */

const express = require('express');
const router = express.Router();
const workspaceManager = require('../utils/workspace-manager');
const { isAuthenticated } = require('../middleware/auth');
const db = require('../config/database');

/**
 * POST /api/workspace/create
 * Tạo hoặc lấy workspace session
 */
router.post('/create', isAuthenticated, async (req, res) => {
    try {
        const { contestId, problemId } = req.body;
        const userId = req.session.userId;
        const username = req.session.username;

        if (!contestId || !problemId) {
            return res.status(400).json({
                success: false,
                message: 'Missing contestId or problemId'
            });
        }

        // Kiểm tra quyền truy cập contest
        const [registrations] = await db.query(`
            SELECT * FROM exam_registrations
            WHERE user_id = ? AND exam_id = ?
        `, [userId, contestId]);

        if (registrations.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'You are not registered for this contest'
            });
        }

        // Lấy problem code
        const [problems] = await db.query(`
            SELECT problem_code FROM exam_problems
            WHERE id = ? AND exam_id = ?
        `, [problemId, contestId]);

        if (problems.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        const problemCode = problems[0].problem_code;

        // Tạo hoặc lấy session
        const session = await workspaceManager.createOrGetSession(
            userId,
            username,
            contestId,
            problemId,
            problemCode
        );

        res.json({
            success: true,
            session: session,
            message: 'Workspace session created/retrieved successfully'
        });

    } catch (error) {
        console.error('[Workspace API] Create session error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create workspace session',
            error: error.message
        });
    }
});

/**
 * POST /api/workspace/sync
 * Sync files từ code-server vào database
 */
router.post('/sync', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, contestId, problemId } = req.body;
        const userId = req.session.userId;

        if (!sessionId || !contestId || !problemId) {
            return res.status(400).json({
                success: false,
                message: 'Missing required parameters'
            });
        }

        // Verify session belongs to user
        const [sessions] = await db.query(`
            SELECT * FROM workspace_sessions
            WHERE id = ? AND user_id = ? AND is_active = TRUE
        `, [sessionId, userId]);

        if (sessions.length === 0) {
            return res.status(403).json({
                success: false,
                message: 'Invalid session or access denied'
            });
        }

        // Lấy problem code
        const [problems] = await db.query(`
            SELECT problem_code FROM exam_problems WHERE id = ?
        `, [problemId]);

        const problemCode = problems[0]?.problem_code || 'PROBLEM';

        // Sync files
        const result = await workspaceManager.syncFilesToDatabase(
            sessionId,
            userId,
            contestId,
            problemId,
            problemCode
        );

        res.json({
            success: true,
            ...result,
            message: `Synced ${result.filesCount} files successfully`
        });

    } catch (error) {
        console.error('[Workspace API] Sync error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sync files',
            error: error.message
        });
    }
});

/**
 * GET /api/workspace/files/:contestId/:problemId
 * Lấy danh sách files từ database
 */
router.get('/files/:contestId/:problemId', isAuthenticated, async (req, res) => {
    try {
        const { contestId, problemId } = req.params;
        const userId = req.session.userId;

        const files = await workspaceManager.getFilesFromDatabase(
            userId,
            parseInt(contestId),
            parseInt(problemId)
        );

        res.json({
            success: true,
            files: files,
            count: files.length
        });

    } catch (error) {
        console.error('[Workspace API] Get files error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get files',
            error: error.message
        });
    }
});

/**
 * POST /api/workspace/submit
 * Submit code (sync + mark as submitted)
 */
router.post('/submit', isAuthenticated, async (req, res) => {
    try {
        const { sessionId, contestId, problemId } = req.body;
        const userId = req.session.userId;

        // Sync files trước
        const [problems] = await db.query(`
            SELECT problem_code FROM exam_problems WHERE id = ?
        `, [problemId]);

        const problemCode = problems[0]?.problem_code || 'PROBLEM';

        const syncResult = await workspaceManager.syncFilesToDatabase(
            sessionId,
            userId,
            contestId,
            problemId,
            problemCode
        );

        // Lấy files đã sync
        const files = await workspaceManager.getFilesFromDatabase(
            userId,
            contestId,
            problemId
        );

        if (files.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No files to submit'
            });
        }

        // Tìm main file
        const mainFile = files.find(f => f.is_main_file) || files[0];

        // Lưu vào code_submissions
        await db.query(`
            INSERT INTO code_submissions
            (user_id, exam_id, problem_id, source_code, language_id, language_name, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, 'submitted', NOW())
            ON DUPLICATE KEY UPDATE
                source_code = VALUES(source_code),
                status = 'submitted',
                submitted_at = NOW()
        `, [
            userId,
            contestId,
            problemId,
            JSON.stringify(files), // Lưu tất cả files dưới dạng JSON
            this.detectLanguageId(mainFile.file_name),
            this.detectLanguageName(mainFile.file_name)
        ]);

        // Log sync as submit
        await db.query(`
            INSERT INTO workspace_sync_log
            (session_id, user_id, sync_type, files_count, total_size, status)
            VALUES (?, ?, 'submit', ?, ?, 'success')
        `, [sessionId, userId, files.length, syncResult.totalSize]);

        res.json({
            success: true,
            message: 'Code submitted successfully',
            filesCount: files.length,
            mainFile: mainFile.file_name
        });

    } catch (error) {
        console.error('[Workspace API] Submit error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to submit code',
            error: error.message
        });
    }
});

/**
 * GET /api/workspace/status/:sessionId
 * Lấy trạng thái workspace session
 */
router.get('/status/:sessionId', isAuthenticated, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const userId = req.session.userId;

        const [sessions] = await db.query(`
            SELECT 
                ws.*,
                TIMESTAMPDIFF(SECOND, NOW(), ws.expires_at) AS seconds_remaining,
                (SELECT COUNT(*) FROM workspace_files WHERE session_id = ws.id AND is_deleted = FALSE) AS files_count,
                (SELECT MAX(updated_at) FROM workspace_files WHERE session_id = ws.id) AS last_file_update
            FROM workspace_sessions ws
            WHERE ws.id = ? AND ws.user_id = ?
        `, [sessionId, userId]);

        if (sessions.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const session = sessions[0];

        res.json({
            success: true,
            session: {
                id: session.id,
                workspacePath: session.workspace_path,
                isActive: session.is_active,
                lastSyncTime: session.last_sync_time,
                lastAccessed: session.last_accessed,
                expiresAt: session.expires_at,
                secondsRemaining: session.seconds_remaining,
                filesCount: session.files_count,
                lastFileUpdate: session.last_file_update
            }
        });

    } catch (error) {
        console.error('[Workspace API] Get status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get session status',
            error: error.message
        });
    }
});

// Helper methods
function detectLanguageId(filename) {
    if (filename.endsWith('.cpp') || filename.endsWith('.c')) return 54; // C++
    if (filename.endsWith('.py')) return 71; // Python
    if (filename.endsWith('.java')) return 62; // Java
    return 54;
}

function detectLanguageName(filename) {
    if (filename.endsWith('.cpp') || filename.endsWith('.c')) return 'C++';
    if (filename.endsWith('.py')) return 'Python';
    if (filename.endsWith('.java')) return 'Java';
    return 'C++';
}

module.exports = router;

