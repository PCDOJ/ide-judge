const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// Helper function to check if user has access to exam
async function checkExamAccess(userId, examId) {
    const [registrations] = await db.query(
        'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ? AND registration_type = ?',
        [examId, userId, 'joined']
    );
    return registrations.length > 0;
}

// Helper function to check if exam is ongoing
// gracePeriodSeconds: allow operations for X seconds after exam ends (for auto-submit)
async function isExamOngoing(examId, gracePeriodSeconds = 0) {
    const [exams] = await db.query('SELECT start_time, end_time FROM exams WHERE id = ?', [examId]);
    if (exams.length === 0) return false;

    const now = new Date();
    const start = new Date(exams[0].start_time);
    const end = new Date(exams[0].end_time);

    // Add grace period to end time
    const endWithGrace = new Date(end.getTime() + (gracePeriodSeconds * 1000));

    return now >= start && now <= endWithGrace;
}

// Save or update code (auto-save)
router.post('/save', isAuthenticated, async (req, res) => {
    try {
        const { exam_id, problem_id, source_code, language_id, language_name } = req.body;
        const userId = req.session.userId;

        if (!exam_id || !problem_id || source_code === undefined || !language_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if user has access to exam
        const hasAccess = await checkExamAccess(userId, exam_id);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

        // Check if exam is ongoing (with 30 second grace period for auto-submit)
        const ongoing = await isExamOngoing(exam_id, 30);
        if (!ongoing) {
            return res.status(400).json({
                success: false,
                message: 'Exam is not currently ongoing'
            });
        }

        // Check if already submitted
        const [existing] = await db.query(
            'SELECT status FROM code_submissions WHERE user_id = ? AND exam_id = ? AND problem_id = ?',
            [userId, exam_id, problem_id]
        );

        if (existing.length > 0 && existing[0].status === 'submitted') {
            return res.status(400).json({
                success: false,
                message: 'Code already submitted. Cannot modify.'
            });
        }

        // Insert or update submission
        await db.query(`
            INSERT INTO code_submissions (user_id, exam_id, problem_id, source_code, language_id, language_name, status)
            VALUES (?, ?, ?, ?, ?, ?, 'draft')
            ON DUPLICATE KEY UPDATE 
                source_code = VALUES(source_code),
                language_id = VALUES(language_id),
                language_name = VALUES(language_name),
                updated_at = CURRENT_TIMESTAMP
        `, [userId, exam_id, problem_id, source_code, language_id, language_name]);

        // Get submission id
        const [submission] = await db.query(
            'SELECT id FROM code_submissions WHERE user_id = ? AND exam_id = ? AND problem_id = ?',
            [userId, exam_id, problem_id]
        );

        // Log to history
        await db.query(`
            INSERT INTO submission_history (submission_id, user_id, exam_id, problem_id, source_code, language_id, language_name, action_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'save')
        `, [submission[0].id, userId, exam_id, problem_id, source_code, language_id, language_name]);

        res.json({
            success: true,
            message: 'Code saved successfully'
        });
    } catch (error) {
        console.error('Save code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Load saved code
router.get('/load/:examId/:problemId', isAuthenticated, async (req, res) => {
    try {
        const { examId, problemId } = req.params;
        const userId = req.session.userId;

        // Check if user has access to exam
        const hasAccess = await checkExamAccess(userId, examId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

        // Get submission
        const [submissions] = await db.query(
            'SELECT * FROM code_submissions WHERE user_id = ? AND exam_id = ? AND problem_id = ?',
            [userId, examId, problemId]
        );

        if (submissions.length === 0) {
            return res.json({
                success: true,
                submission: null
            });
        }

        res.json({
            success: true,
            submission: submissions[0]
        });
    } catch (error) {
        console.error('Load code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Submit code (manual submit)
router.post('/submit', isAuthenticated, async (req, res) => {
    try {
        const { exam_id, problem_id } = req.body;
        const userId = req.session.userId;

        if (!exam_id || !problem_id) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }

        // Check if user has access to exam
        const hasAccess = await checkExamAccess(userId, exam_id);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

        // Check if exam is ongoing
        const ongoing = await isExamOngoing(exam_id);
        if (!ongoing) {
            return res.status(400).json({
                success: false,
                message: 'Exam is not currently ongoing'
            });
        }

        // Get current submission
        const [submissions] = await db.query(
            'SELECT * FROM code_submissions WHERE user_id = ? AND exam_id = ? AND problem_id = ?',
            [userId, exam_id, problem_id]
        );

        if (submissions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No code to submit. Please save your code first.'
            });
        }

        const submission = submissions[0];

        if (submission.status === 'submitted') {
            return res.status(400).json({
                success: false,
                message: 'Code already submitted'
            });
        }

        // Update status to submitted
        await db.query(
            'UPDATE code_submissions SET status = ?, submitted_at = NOW() WHERE id = ?',
            ['submitted', submission.id]
        );

        // Log to history
        await db.query(`
            INSERT INTO submission_history (submission_id, user_id, exam_id, problem_id, source_code, language_id, language_name, action_type)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'submit')
        `, [submission.id, userId, exam_id, problem_id, submission.source_code, submission.language_id, submission.language_name]);

        res.json({
            success: true,
            message: 'Code submitted successfully'
        });
    } catch (error) {
        console.error('Submit code error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Get all submissions for an exam (for user)
router.get('/exam/:examId', isAuthenticated, async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.session.userId;

        // Check if user has access to exam
        const hasAccess = await checkExamAccess(userId, examId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

        // Get all submissions for this exam
        const [submissions] = await db.query(`
            SELECT cs.*, ep.problem_code, ep.problem_title
            FROM code_submissions cs
            JOIN exam_problems ep ON cs.problem_id = ep.id
            WHERE cs.user_id = ? AND cs.exam_id = ?
            ORDER BY ep.display_order ASC
        `, [userId, examId]);

        res.json({
            success: true,
            submissions
        });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Auto-submit all draft submissions when exam ends (called by cron job or manually)
router.post('/auto-submit/:examId', isAuthenticated, async (req, res) => {
    try {
        const { examId } = req.params;
        const userId = req.session.userId;

        // Check if user has access to exam
        const hasAccess = await checkExamAccess(userId, examId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: 'You do not have access to this exam'
            });
        }

        // Get all draft submissions
        const [submissions] = await db.query(
            'SELECT * FROM code_submissions WHERE user_id = ? AND exam_id = ? AND status = ?',
            [userId, examId, 'draft']
        );

        if (submissions.length === 0) {
            return res.json({
                success: true,
                message: 'No draft submissions to auto-submit',
                count: 0
            });
        }

        // Update all to auto_submitted
        await db.query(
            'UPDATE code_submissions SET status = ?, submitted_at = NOW() WHERE user_id = ? AND exam_id = ? AND status = ?',
            ['auto_submitted', userId, examId, 'draft']
        );

        // Log to history for each submission
        for (const submission of submissions) {
            await db.query(`
                INSERT INTO submission_history (submission_id, user_id, exam_id, problem_id, source_code, language_id, language_name, action_type)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'auto_submit')
            `, [submission.id, userId, examId, submission.problem_id, submission.source_code, submission.language_id, submission.language_name]);
        }

        res.json({
            success: true,
            message: `Auto-submitted ${submissions.length} draft submission(s)`,
            count: submissions.length
        });
    } catch (error) {
        console.error('Auto-submit error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

module.exports = router;

