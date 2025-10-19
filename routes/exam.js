const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../config/upload');
const { isAdmin } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');

// Helper function to convert Vietnam time to UTC for database storage
function vietnamToUTC(vietnamTimeStr) {
    // Input: "2025-10-19 15:00:00" (Vietnam time, UTC+7)
    // Output: "2025-10-19 08:00:00" (UTC time)
    const dateStr = vietnamTimeStr.toString().replace('T', ' ').substring(0, 19);
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes, seconds] = timePart.split(':');

    // Parse as Vietnam time (UTC+7) and convert to UTC
    // Create UTC timestamp for the Vietnam time, then subtract 7 hours
    const vnTimestamp = Date.UTC(year, month - 1, day, hours, minutes, seconds || 0);
    const utcTimestamp = vnTimestamp - (7 * 60 * 60 * 1000);
    const utcDate = new Date(utcTimestamp);

    // Format as MySQL datetime string
    return utcDate.toISOString().slice(0, 19).replace('T', ' ');
}

// Helper function to parse datetime string to Date object (UTC)
function parseDateTime(datetimeStr) {
    // Input: "2025-10-19 08:00:00" (from database, stored as UTC)
    const dateStr = datetimeStr.toString().replace('T', ' ').substring(0, 19);
    const [datePart, timePart] = dateStr.split(' ');
    const [year, month, day] = datePart.split('-');
    const [hours, minutes, seconds] = timePart.split(':');

    // Create Date object in UTC
    return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds || 0));
}

// Helper function to calculate exam status
function getExamStatus(startTime, endTime) {
    const now = new Date(); // Current UTC time
    const start = parseDateTime(startTime);
    const end = parseDateTime(endTime);

    if (now < start) return 'upcoming';
    if (now >= start && now <= end) return 'ongoing';
    return 'ended';
}

// ==================== ADMIN ROUTES ====================

// Get all exams (Admin)
router.get('/admin/exams', isAdmin, async (req, res) => {
    try {
        const [exams] = await db.query(`
            SELECT e.*, u.fullname as creator_name,
                   (SELECT COUNT(*) FROM exam_problems WHERE exam_id = e.id) as problem_count,
                   (SELECT COUNT(*) FROM exam_registrations WHERE exam_id = e.id) as registration_count
            FROM exams e
            LEFT JOIN users u ON e.created_by = u.id
            ORDER BY e.start_time DESC
        `);
        
        // Add status to each exam
        const examsWithStatus = exams.map(exam => ({
            ...exam,
            status: getExamStatus(exam.start_time, exam.end_time)
        }));
        
        res.json({ success: true, exams: examsWithStatus });
    } catch (error) {
        console.error('Get exams error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get single exam details (Admin)
router.get('/admin/exams/:id', isAdmin, async (req, res) => {
    try {
        const [exams] = await db.query(`
            SELECT e.*, u.fullname as creator_name
            FROM exams e
            LEFT JOIN users u ON e.created_by = u.id
            WHERE e.id = ?
        `, [req.params.id]);
        
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }
        
        const exam = exams[0];
        exam.status = getExamStatus(exam.start_time, exam.end_time);
        
        // Get problems for this exam
        const [problems] = await db.query(`
            SELECT * FROM exam_problems
            WHERE exam_id = ?
            ORDER BY display_order ASC
        `, [req.params.id]);
        
        exam.problems = problems;
        
        res.json({ success: true, exam });
    } catch (error) {
        console.error('Get exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new exam (Admin)
router.post('/admin/exams', isAdmin, async (req, res) => {
    try {
        const { title, description, start_time, end_time, access_code, has_access_code } = req.body;

        if (!title || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                message: 'Title, start time, and end time are required'
            });
        }

        // Convert Vietnam time to UTC for storage
        const startTimeUTC = vietnamToUTC(start_time);
        const endTimeUTC = vietnamToUTC(end_time);

        // Only save access_code if has_access_code is true
        const finalAccessCode = has_access_code ? (access_code || null) : null;
        const finalHasAccessCode = has_access_code ? true : false;

        const [result] = await db.query(`
            INSERT INTO exams (title, description, start_time, end_time, access_code, has_access_code, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [title, description, startTimeUTC, endTimeUTC, finalAccessCode, finalHasAccessCode, req.session.userId]);

        res.json({
            success: true,
            message: 'Exam created successfully',
            examId: result.insertId
        });
    } catch (error) {
        console.error('Create exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update exam (Admin)
router.put('/admin/exams/:id', isAdmin, async (req, res) => {
    try {
        const { title, description, start_time, end_time, access_code, has_access_code } = req.body;
        const examId = req.params.id;

        if (!title || !start_time || !end_time) {
            return res.status(400).json({
                success: false,
                message: 'Title, start time, and end time are required'
            });
        }

        // Convert Vietnam time to UTC for storage
        const startTimeUTC = vietnamToUTC(start_time);
        const endTimeUTC = vietnamToUTC(end_time);

        // Only save access_code if has_access_code is true
        const finalAccessCode = has_access_code ? (access_code || null) : null;
        const finalHasAccessCode = has_access_code ? true : false;

        await db.query(`
            UPDATE exams
            SET title = ?, description = ?, start_time = ?, end_time = ?, access_code = ?, has_access_code = ?
            WHERE id = ?
        `, [title, description, startTimeUTC, endTimeUTC, finalAccessCode, finalHasAccessCode, examId]);

        res.json({ success: true, message: 'Exam updated successfully' });
    } catch (error) {
        console.error('Update exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete exam (Admin)
router.delete('/admin/exams/:id', isAdmin, async (req, res) => {
    try {
        const examId = req.params.id;

        // Get all problems to delete their PDF files
        const [problems] = await db.query('SELECT pdf_path FROM exam_problems WHERE exam_id = ?', [examId]);

        // Delete PDF files
        problems.forEach(problem => {
            const filePath = path.join(__dirname, '..', problem.pdf_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        });

        // Delete exam (cascade will delete problems and registrations)
        await db.query('DELETE FROM exams WHERE id = ?', [examId]);

        res.json({ success: true, message: 'Exam deleted successfully' });
    } catch (error) {
        console.error('Delete exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get registrations for an exam (Admin)
router.get('/admin/exams/:examId/registrations', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Get all registrations with user info
        const [registrations] = await db.query(`
            SELECT er.*, u.username, u.fullname, u.email
            FROM exam_registrations er
            JOIN users u ON er.user_id = u.id
            WHERE er.exam_id = ?
            ORDER BY er.created_at DESC
        `, [examId]);

        res.json({ success: true, registrations });
    } catch (error) {
        console.error('Get registrations error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get problems for an exam (Admin)
router.get('/admin/exams/:examId/problems', isAdmin, async (req, res) => {
    try {
        const [problems] = await db.query(`
            SELECT * FROM exam_problems
            WHERE exam_id = ?
            ORDER BY display_order ASC
        `, [req.params.examId]);
        
        res.json({ success: true, problems });
    } catch (error) {
        console.error('Get problems error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Add problem to exam with PDF upload (Admin)
router.post('/admin/exams/:examId/problems', isAdmin, upload.single('pdf'), async (req, res) => {
    try {
        const { problem_code, problem_title, points, display_order } = req.body;
        const examId = req.params.examId;
        
        if (!problem_code || !problem_title || !req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'Problem code, title, and PDF file are required' 
            });
        }
        
        const pdfPath = 'uploads/exam-pdfs/' + req.file.filename;
        
        const [result] = await db.query(`
            INSERT INTO exam_problems (exam_id, problem_code, problem_title, pdf_filename, pdf_path, points, display_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [examId, problem_code, problem_title, req.file.originalname, pdfPath, points || 0, display_order || 0]);
        
        res.json({ 
            success: true, 
            message: 'Problem added successfully',
            problemId: result.insertId
        });
    } catch (error) {
        console.error('Add problem error:', error);
        // Delete uploaded file if database insert fails
        if (req.file) {
            const filePath = path.join(__dirname, '../uploads/exam-pdfs', req.file.filename);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update problem (Admin)
router.put('/admin/problems/:id', isAdmin, async (req, res) => {
    try {
        const { problem_code, problem_title, points, display_order } = req.body;
        const problemId = req.params.id;
        
        if (!problem_code || !problem_title) {
            return res.status(400).json({ 
                success: false, 
                message: 'Problem code and title are required' 
            });
        }
        
        await db.query(`
            UPDATE exam_problems 
            SET problem_code = ?, problem_title = ?, points = ?, display_order = ?
            WHERE id = ?
        `, [problem_code, problem_title, points || 0, display_order || 0, problemId]);
        
        res.json({ success: true, message: 'Problem updated successfully' });
    } catch (error) {
        console.error('Update problem error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete problem (Admin)
router.delete('/admin/problems/:id', isAdmin, async (req, res) => {
    try {
        const problemId = req.params.id;
        
        // Get problem to delete PDF file
        const [problems] = await db.query('SELECT pdf_path FROM exam_problems WHERE id = ?', [problemId]);
        
        if (problems.length > 0) {
            const filePath = path.join(__dirname, '..', problems[0].pdf_path);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        await db.query('DELETE FROM exam_problems WHERE id = ?', [problemId]);
        
        res.json({ success: true, message: 'Problem deleted successfully' });
    } catch (error) {
        console.error('Delete problem error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ==================== USER ROUTES ====================

const { isAuthenticated } = require('../middleware/auth');

// Get all exams for user (categorized by status)
router.get('/user/exams', isAuthenticated, async (req, res) => {
    try {
        const userId = req.session.userId;

        const [exams] = await db.query(`
            SELECT e.*,
                   er.registration_type,
                   er.joined_at,
                   (SELECT COUNT(*) FROM exam_problems WHERE exam_id = e.id) as problem_count
            FROM exams e
            LEFT JOIN exam_registrations er ON e.id = er.exam_id AND er.user_id = ?
            ORDER BY e.start_time DESC
        `, [userId]);

        // Categorize exams by status
        const categorized = {
            upcoming: [],
            ongoing: [],
            ended: []
        };

        exams.forEach(exam => {
            const status = getExamStatus(exam.start_time, exam.end_time);
            exam.status = status;
            // Hide access_code from user
            exam.has_access_code = exam.access_code ? true : false;
            delete exam.access_code;

            categorized[status].push(exam);
        });

        res.json({ success: true, exams: categorized });
    } catch (error) {
        console.error('Get user exams error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Pre-register for upcoming exam
router.post('/user/exams/:examId/pre-register', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;
        const userId = req.session.userId;

        // Check if exam exists and is upcoming
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const exam = exams[0];
        const status = getExamStatus(exam.start_time, exam.end_time);

        if (status !== 'upcoming') {
            return res.status(400).json({ success: false, message: 'Can only pre-register for upcoming exams' });
        }

        // Check if already registered
        const [existing] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        if (existing.length > 0) {
            return res.status(400).json({ success: false, message: 'Already registered for this exam' });
        }

        // Register
        await db.query(
            'INSERT INTO exam_registrations (exam_id, user_id, registration_type) VALUES (?, ?, ?)',
            [examId, userId, 'pre_registered']
        );

        res.json({ success: true, message: 'Pre-registered successfully' });
    } catch (error) {
        console.error('Pre-register error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Unregister from upcoming exam (cancel pre-registration)
router.delete('/user/exams/:examId/unregister', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;
        const userId = req.session.userId;

        // Check if exam exists and is upcoming
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const exam = exams[0];
        const status = getExamStatus(exam.start_time, exam.end_time);

        if (status !== 'upcoming') {
            return res.status(400).json({ success: false, message: 'Can only unregister from upcoming exams' });
        }

        // Check if registered
        const [existing] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        if (existing.length === 0 || existing[0].registration_type !== 'pre_registered') {
            return res.status(400).json({ success: false, message: 'You are not registered for this exam' });
        }

        // Delete registration
        await db.query(
            'DELETE FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        res.json({ success: true, message: 'Unregistered successfully' });
    } catch (error) {
        console.error('Unregister error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Join ongoing exam
router.post('/user/exams/:examId/join', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;
        const userId = req.session.userId;
        const { access_code } = req.body;

        // Check if exam exists
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const exam = exams[0];
        const status = getExamStatus(exam.start_time, exam.end_time);

        if (status !== 'ongoing') {
            return res.status(400).json({ success: false, message: 'Exam is not currently ongoing' });
        }

        // Check access code if required
        if (exam.has_access_code) {
            if (!access_code || exam.access_code !== access_code) {
                return res.status(403).json({ success: false, message: 'Invalid access code' });
            }
        }

        // Check if already joined
        const [existing] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        if (existing.length > 0) {
            if (existing[0].registration_type === 'joined') {
                return res.status(400).json({ success: false, message: 'Already joined this exam' });
            }
            // Update pre_registered or left to joined (allow rejoin)
            await db.query(
                'UPDATE exam_registrations SET registration_type = ?, joined_at = NOW(), left_at = NULL WHERE exam_id = ? AND user_id = ?',
                ['joined', examId, userId]
            );
        } else {
            // New join
            await db.query(
                'INSERT INTO exam_registrations (exam_id, user_id, registration_type, joined_at) VALUES (?, ?, ?, NOW())',
                [examId, userId, 'joined']
            );
        }

        res.json({ success: true, message: 'Joined exam successfully' });
    } catch (error) {
        console.error('Join exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Leave exam
router.post('/user/exams/:examId/leave', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;
        const userId = req.session.userId;

        // Check if joined
        const [existing] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        if (existing.length === 0 || existing[0].registration_type !== 'joined') {
            return res.status(400).json({ success: false, message: 'You have not joined this exam' });
        }

        // Update to left
        await db.query(
            'UPDATE exam_registrations SET registration_type = ?, left_at = NOW() WHERE exam_id = ? AND user_id = ?',
            ['left', examId, userId]
        );

        res.json({ success: true, message: 'Left exam successfully' });
    } catch (error) {
        console.error('Leave exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get exam details and problems (for joined users or ended exams)
router.get('/user/exams/:examId', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;
        const userId = req.session.userId;

        // Get exam
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        const exam = exams[0];
        const status = getExamStatus(exam.start_time, exam.end_time);
        exam.status = status;

        // Check registration
        const [registrations] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [examId, userId]
        );

        // Allow access if: joined, or exam ended (for viewing)
        const canAccess = (registrations.length > 0 && registrations[0].registration_type === 'joined') || status === 'ended';

        if (!canAccess) {
            return res.status(403).json({ success: false, message: 'You do not have access to this exam' });
        }

        // Get problems
        const [problems] = await db.query(`
            SELECT id, problem_code, problem_title, points, display_order
            FROM exam_problems
            WHERE exam_id = ?
            ORDER BY display_order ASC
        `, [examId]);

        // Hide access code
        delete exam.access_code;
        exam.problems = problems;

        res.json({ success: true, exam });
    } catch (error) {
        console.error('Get exam details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get PDF file for a problem (for joined users or ended exams)
router.get('/user/problems/:problemId/pdf', isAuthenticated, async (req, res) => {
    try {
        const problemId = req.params.problemId;
        const userId = req.session.userId;

        // Get problem and exam
        const [problems] = await db.query(`
            SELECT ep.*, e.start_time, e.end_time
            FROM exam_problems ep
            JOIN exams e ON ep.exam_id = e.id
            WHERE ep.id = ?
        `, [problemId]);

        if (problems.length === 0) {
            return res.status(404).json({ success: false, message: 'Problem not found' });
        }

        const problem = problems[0];
        const status = getExamStatus(problem.start_time, problem.end_time);

        // Check registration
        const [registrations] = await db.query(
            'SELECT * FROM exam_registrations WHERE exam_id = ? AND user_id = ?',
            [problem.exam_id, userId]
        );

        // Allow access if: joined, or exam ended
        const canAccess = (registrations.length > 0 && registrations[0].registration_type === 'joined') || status === 'ended';

        if (!canAccess) {
            return res.status(403).json({ success: false, message: 'You do not have access to this problem' });
        }

        // Send PDF file
        const filePath = path.join(__dirname, '..', problem.pdf_path);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'PDF file not found' });
        }

        res.sendFile(filePath);
    } catch (error) {
        console.error('Get PDF error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get participants list for an exam (for users to view)
router.get('/user/exams/:examId/participants', isAuthenticated, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get participants (pre_registered or joined, not left)
        const [participants] = await db.query(`
            SELECT u.fullname
            FROM exam_registrations er
            JOIN users u ON er.user_id = u.id
            WHERE er.exam_id = ? AND er.registration_type IN ('pre_registered', 'joined')
            ORDER BY u.fullname ASC
        `, [examId]);

        res.json({ success: true, participants });
    } catch (error) {
        console.error('Get participants error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

