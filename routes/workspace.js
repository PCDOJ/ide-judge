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
 * Helper function to detect language ID from filename
 */
function detectLanguageId(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
        'cpp': 54,  // C++ (GCC 9.2.0)
        'c': 50,    // C (GCC 9.2.0)
        'py': 71,   // Python 3
        'java': 62, // Java (OpenJDK 13.0.1)
        'js': 63,   // JavaScript (Node.js 12.14.0)
        'go': 60,   // Go (1.13.5)
        'rs': 73    // Rust (1.40.0)
    };
    return languageMap[ext] || 54; // Default to C++
}

/**
 * Helper function to detect language name from filename
 */
function detectLanguageName(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    const languageMap = {
        'cpp': 'C++',
        'c': 'C',
        'py': 'Python',
        'java': 'Java',
        'js': 'JavaScript',
        'go': 'Go',
        'rs': 'Rust'
    };
    return languageMap[ext] || 'C++'; // Default to C++
}

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

        // Lấy problem code và PDF path
        const [problems] = await db.query(`
            SELECT problem_code, pdf_path FROM exam_problems
            WHERE id = ? AND exam_id = ?
        `, [problemId, contestId]);

        if (problems.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Problem not found'
            });
        }

        const problemCode = problems[0].problem_code;
        const pdfPath = problems[0].pdf_path;

        // Tạo hoặc lấy session
        const session = await workspaceManager.createOrGetSession(
            userId,
            username,
            contestId,
            problemId,
            problemCode,
            pdfPath
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
 * POST /api/workspace/save-code
 * Lưu code từ workspace (không submit)
 */
router.post('/save-code', isAuthenticated, async (req, res) => {
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
                message: 'No files to save'
            });
        }

        // Tìm main file
        const mainFile = files.find(f => f.is_main_file) || files[0];

        // Detect language
        const languageId = detectLanguageId(mainFile.file_name);
        const languageName = detectLanguageName(mainFile.file_name);

        // Lưu vào code_submissions với status 'draft'
        await db.query(`
            INSERT INTO code_submissions
            (user_id, exam_id, problem_id, source_code, language_id, language_name, status)
            VALUES (?, ?, ?, ?, ?, ?, 'draft')
            ON DUPLICATE KEY UPDATE
                source_code = VALUES(source_code),
                language_id = VALUES(language_id),
                language_name = VALUES(language_name),
                updated_at = CURRENT_TIMESTAMP
        `, [
            userId,
            contestId,
            problemId,
            mainFile.file_content, // Lưu file_content của main file
            languageId,
            languageName
        ]);

        // Get submission id
        const [submission] = await db.query(
            'SELECT id FROM code_submissions WHERE user_id = ? AND exam_id = ? AND problem_id = ?',
            [userId, contestId, problemId]
        );

        // Log to history
        await db.query(`
            INSERT INTO submission_history (submission_id, user_id, exam_id, problem_id, source_code, language_id, language_name, action_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'save')
        `, [submission[0].id, userId, contestId, problemId, mainFile.content, languageId, languageName]);

        res.json({
            success: true,
            message: 'Code saved successfully',
            filesCount: files.length,
            mainFile: mainFile.file_name,
            source: 'workspace'
        });

    } catch (error) {
        console.error('[Workspace API] Save code error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to save code',
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

        // Detect language
        const languageId = detectLanguageId(mainFile.file_name);
        const languageName = detectLanguageName(mainFile.file_name);

        // Lưu vào code_submissions
        await db.query(`
            INSERT INTO code_submissions
            (user_id, exam_id, problem_id, source_code, language_id, language_name, status, submitted_at)
            VALUES (?, ?, ?, ?, ?, ?, 'submitted', NOW())
            ON DUPLICATE KEY UPDATE
                source_code = VALUES(source_code),
                language_id = VALUES(language_id),
                language_name = VALUES(language_name),
                status = 'submitted',
                submitted_at = NOW()
        `, [
            userId,
            contestId,
            problemId,
            mainFile.file_content, // Lưu file_content của main file
            languageId,
            languageName
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

