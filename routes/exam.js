const express = require('express');
const router = express.Router();
const db = require('../config/database');
const upload = require('../config/upload');
const { isAdmin, isAuthenticated } = require('../middleware/auth');
const path = require('path');
const fs = require('fs');
const archiver = require('archiver');
const sseManager = require('../utils/sse-manager');

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
        const { title, description, start_time, end_time, access_code, has_access_code, prevent_tab_switch } = req.body;

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
        const finalPreventTabSwitch = prevent_tab_switch ? true : false;

        const [result] = await db.query(`
            INSERT INTO exams (title, description, start_time, end_time, access_code, has_access_code, prevent_tab_switch, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [title, description, startTimeUTC, endTimeUTC, finalAccessCode, finalHasAccessCode, finalPreventTabSwitch, req.session.userId]);

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
        const { title, description, start_time, end_time, access_code, has_access_code, prevent_tab_switch } = req.body;
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
        const finalPreventTabSwitch = prevent_tab_switch ? true : false;

        await db.query(`
            UPDATE exams
            SET title = ?, description = ?, start_time = ?, end_time = ?, access_code = ?, has_access_code = ?, prevent_tab_switch = ?
            WHERE id = ?
        `, [title, description, startTimeUTC, endTimeUTC, finalAccessCode, finalHasAccessCode, finalPreventTabSwitch, examId]);

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

// Get all submissions for an exam (Admin) - for viewing student code
router.get('/admin/exams/:examId/submissions', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Get all submissions with user and problem info
        const [submissions] = await db.query(`
            SELECT
                cs.*,
                u.username,
                u.fullname,
                u.email,
                ep.problem_code,
                ep.problem_title
            FROM code_submissions cs
            JOIN users u ON cs.user_id = u.id
            JOIN exam_problems ep ON cs.problem_id = ep.id
            WHERE cs.exam_id = ?
            ORDER BY u.fullname ASC, ep.display_order ASC
        `, [examId]);

        res.json({ success: true, submissions });
    } catch (error) {
        console.error('Get submissions error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Helper function to sanitize filename/foldername while keeping Vietnamese characters
function sanitizeFilename(name) {
    // Chỉ loại bỏ các ký tự không hợp lệ trong tên file/folder
    // Giữ lại: chữ cái (bao gồm tiếng Việt), số, khoảng trắng, dấu gạch ngang, dấu gạch dưới
    return name
        .replace(/[<>:"/\\|?*]/g, '') // Loại bỏ ký tự đặc biệt không hợp lệ
        .replace(/\s+/g, '_')          // Thay khoảng trắng bằng dấu gạch dưới
        .replace(/_+/g, '_')           // Loại bỏ dấu gạch dưới trùng lặp
        .trim();
}

// Download all submissions as ZIP (Admin)
router.get('/admin/exams/:examId/download-zip', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }
        const exam = exams[0];

        // Get all submissions with user and problem info
        const [submissions] = await db.query(`
            SELECT
                cs.*,
                u.username,
                u.fullname,
                u.email,
                ep.problem_code,
                ep.problem_title
            FROM code_submissions cs
            JOIN users u ON cs.user_id = u.id
            JOIN exam_problems ep ON cs.problem_id = ep.id
            WHERE cs.exam_id = ?
            ORDER BY u.fullname ASC, ep.display_order ASC
        `, [examId]);

        if (submissions.length === 0) {
            return res.status(404).json({ success: false, message: 'No submissions found' });
        }

        // Create ZIP archive
        const archive = archiver('zip', {
            zlib: { level: 9 } // Maximum compression
        });

        // Set response headers - Giữ tiếng Việt trong tên file ZIP
        const zipFilename = `${sanitizeFilename(exam.title)}_submissions.zip`;
        res.attachment(zipFilename);
        res.setHeader('Content-Type', 'application/zip');

        // Pipe archive to response
        archive.pipe(res);

        // Group submissions by student
        const studentMap = new Map();
        submissions.forEach(sub => {
            if (!studentMap.has(sub.user_id)) {
                studentMap.set(sub.user_id, {
                    fullname: sub.fullname,
                    submissions: []
                });
            }
            studentMap.get(sub.user_id).submissions.push(sub);
        });

        // Add files to archive - Giữ tiếng Việt trong tên folder
        studentMap.forEach((student, userId) => {
            const folderName = sanitizeFilename(student.fullname);

            student.submissions.forEach(sub => {
                const ext = getFileExtension(sub.language_id);
                const filename = `${folderName}/${sub.problem_code}${ext}`;
                const content = sub.source_code || '// No code';

                archive.append(content, { name: filename });
            });
        });

        // Finalize archive
        archive.finalize();

    } catch (error) {
        console.error('Download ZIP error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Helper function to get file extension based on language ID
function getFileExtension(languageId) {
    const extensions = {
        // C/C++
        50: '.c',       // C (GCC 9.2.0)
        75: '.c',       // C (Clang 7.0.1)
        103: '.c',      // C (GCC 14.1.0)
        54: '.cpp',     // C++ (GCC 9.2.0)
        76: '.cpp',     // C++ (Clang 7.0.1)
        105: '.cpp',    // C++ (GCC 14.1.0)

        // Python
        71: '.py',      // Python (3.8.1)
        25: '.py',      // Python for ML (3.11.2)

        // Java
        62: '.java',    // Java (OpenJDK 13.0.1)
        91: '.java',    // Java (JDK 17.0.6)

        // JavaScript/TypeScript
        63: '.js',      // JavaScript (Node.js 12.14.0)
        102: '.js',     // JavaScript (Node.js 22.08.0)
        74: '.ts',      // TypeScript (3.7.4)
        101: '.ts',     // TypeScript (5.6.2)

        // C#
        51: '.cs',      // C# (Mono 6.6.0.161)
        29: '.cs',      // C# (.NET Core SDK 7.0.400)

        // Other languages
        45: '.asm',     // Assembly (NASM 2.14.02)
        46: '.sh',      // Bash (5.0.0)
        60: '.go',      // Go (1.13.5)
        95: '.go',      // Go (1.18.5)
        64: '.lua',     // Lua (5.3.5)
        67: '.pas',     // Pascal (FPC 3.0.4)
        68: '.php',     // PHP (7.4.1)
        98: '.php',     // PHP (8.3.11)
        99: '.r',       // R (4.4.1)
        72: '.rb',      // Ruby (2.7.0)
        73: '.rs',      // Rust (1.40.0)
        81: '.scala',   // Scala (2.13.2)
        83: '.swift',   // Swift (5.2.3)
        43: '.txt'      // Plain Text
    };
    return extensions[languageId] || '.txt';
}

// SSE endpoint for exam events (Student)
router.get('/exams/:examId/events', isAuthenticated, async (req, res) => {
    const examId = req.params.examId;
    const userId = req.session.userId;

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

    // Send initial connection message
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ message: 'Connected to exam events' })}\n\n`);

    // Add connection to SSE manager
    sseManager.addConnection(examId, userId, res);

    // Keep connection alive with heartbeat
    const heartbeat = setInterval(() => {
        res.write(`:heartbeat\n\n`);
    }, 30000); // Every 30 seconds

    // Clean up on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        sseManager.removeConnection(examId, userId);
    });
});

// Stop exam and notify all clients (Admin)
router.post('/admin/exams/:examId/stop', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Update exam end time to now (force stop)
        await db.query(
            'UPDATE exams SET end_time = NOW() WHERE id = ?',
            [examId]
        );

        // Send stop event to all connected clients
        const clientCount = sseManager.sendToExam(examId, 'exam_stopped', {
            message: 'Exam has been stopped by admin',
            examId: examId,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: `Exam stopped and ${clientCount} client(s) notified`,
            clientCount
        });

    } catch (error) {
        console.error('Stop exam error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Log tab violation (User)
router.post('/exam-violations/log', isAuthenticated, async (req, res) => {
    try {
        const { exam_id, problem_id, left_at, returned_at, violation_type } = req.body;
        const userId = req.session.userId;

        if (!exam_id || !left_at) {
            return res.status(400).json({
                success: false,
                message: 'exam_id and left_at are required'
            });
        }

        // Convert ISO 8601 to MySQL datetime format (YYYY-MM-DD HH:MM:SS)
        const formatDateForMySQL = (isoString) => {
            if (!isoString) return null;
            const date = new Date(isoString);
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        const leftAtFormatted = formatDateForMySQL(left_at);
        const returnedAtFormatted = formatDateForMySQL(returned_at);

        // Calculate duration if returned_at is provided
        let durationSeconds = null;
        if (returned_at && left_at) {
            const leftTime = new Date(left_at);
            const returnedTime = new Date(returned_at);
            durationSeconds = Math.floor((returnedTime - leftTime) / 1000);
        }

        // Insert violation log
        await db.query(`
            INSERT INTO exam_tab_violations (exam_id, user_id, problem_id, left_at, returned_at, duration_seconds, violation_type)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [exam_id, userId, problem_id || null, leftAtFormatted, returnedAtFormatted, durationSeconds, violation_type || 'tab_hidden']);

        res.json({ success: true, message: 'Violation logged successfully' });
    } catch (error) {
        console.error('Log violation error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update violation when user returns to tab (User)
router.put('/exam-violations/update-return', isAuthenticated, async (req, res) => {
    try {
        const { exam_id, returned_at, duration_seconds } = req.body;
        const userId = req.session.userId;

        if (!exam_id || !returned_at) {
            return res.status(400).json({
                success: false,
                message: 'exam_id and returned_at are required'
            });
        }

        // Convert ISO 8601 to MySQL datetime format
        const formatDateForMySQL = (isoString) => {
            if (!isoString) return null;
            const date = new Date(isoString);
            return date.toISOString().slice(0, 19).replace('T', ' ');
        };

        const returnedAtFormatted = formatDateForMySQL(returned_at);

        // Find the most recent violation without returned_at
        const [violations] = await db.query(`
            SELECT id, left_at FROM exam_tab_violations
            WHERE exam_id = ? AND user_id = ? AND returned_at IS NULL
            ORDER BY left_at DESC
            LIMIT 1
        `, [exam_id, userId]);

        if (violations.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No open violation found'
            });
        }

        const violation = violations[0];

        // Use duration from client if provided (more accurate), otherwise calculate
        let finalDuration = duration_seconds;
        if (!finalDuration || finalDuration <= 0) {
            const leftTime = new Date(violation.left_at);
            const returnedTime = new Date(returned_at);
            finalDuration = Math.floor((returnedTime - leftTime) / 1000);
        }

        // Update the violation
        await db.query(`
            UPDATE exam_tab_violations
            SET returned_at = ?, duration_seconds = ?
            WHERE id = ?
        `, [returnedAtFormatted, finalDuration, violation.id]);

        res.json({ success: true, message: 'Violation updated successfully' });
    } catch (error) {
        console.error('Update violation error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get violations for an exam (Admin)
// Get list of students registered for exam with violation stats
router.get('/admin/exams/:examId/students', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Get all registered students with their violation stats
        const [students] = await db.query(`
            SELECT
                u.id,
                u.username,
                u.fullname,
                u.email,
                er.created_at as registered_at,
                COUNT(DISTINCT v.id) as violation_count,
                COALESCE(SUM(v.duration_seconds), 0) as total_duration_seconds,
                MAX(v.left_at) as last_violation_at
            FROM exam_registrations er
            JOIN users u ON er.user_id = u.id
            LEFT JOIN exam_tab_violations v ON v.exam_id = er.exam_id AND v.user_id = u.id
            WHERE er.exam_id = ?
            GROUP BY u.id, u.username, u.fullname, u.email, er.created_at
            ORDER BY violation_count DESC, u.fullname ASC
        `, [examId]);

        // Calculate overall statistics
        const stats = {
            totalStudents: students.length,
            studentsWithViolations: students.filter(s => s.violation_count > 0).length,
            totalViolations: students.reduce((sum, s) => sum + s.violation_count, 0),
            totalDuration: students.reduce((sum, s) => sum + (s.total_duration_seconds || 0), 0)
        };

        res.json({
            success: true,
            exam: exams[0],
            students,
            stats
        });
    } catch (error) {
        console.error('Get students error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get violations for a specific student in an exam
router.get('/admin/exams/:examId/students/:userId/violations', isAdmin, async (req, res) => {
    try {
        const { examId, userId } = req.params;

        // Get student info
        const [users] = await db.query('SELECT id, username, fullname, email FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Get all violations for this student in this exam
        const [violations] = await db.query(`
            SELECT
                v.*,
                ep.problem_code,
                ep.problem_title
            FROM exam_tab_violations v
            LEFT JOIN exam_problems ep ON v.problem_id = ep.id
            WHERE v.exam_id = ? AND v.user_id = ?
            ORDER BY v.left_at DESC
        `, [examId, userId]);

        // Calculate statistics
        const stats = {
            totalViolations: violations.length,
            totalDuration: violations.reduce((sum, v) => sum + (v.duration_seconds || 0), 0),
            violationsByType: violations.reduce((acc, v) => {
                acc[v.violation_type] = (acc[v.violation_type] || 0) + 1;
                return acc;
            }, {})
        };

        res.json({
            success: true,
            student: users[0],
            violations,
            stats
        });
    } catch (error) {
        console.error('Get student violations error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Legacy endpoint - keep for backward compatibility
router.get('/admin/exams/:examId/violations', isAdmin, async (req, res) => {
    try {
        const examId = req.params.examId;

        // Get exam info
        const [exams] = await db.query('SELECT * FROM exams WHERE id = ?', [examId]);
        if (exams.length === 0) {
            return res.status(404).json({ success: false, message: 'Exam not found' });
        }

        // Get all violations with user and problem info
        const [violations] = await db.query(`
            SELECT
                v.*,
                u.username,
                u.fullname,
                u.email,
                ep.problem_code,
                ep.problem_title
            FROM exam_tab_violations v
            JOIN users u ON v.user_id = u.id
            LEFT JOIN exam_problems ep ON v.problem_id = ep.id
            WHERE v.exam_id = ?
            ORDER BY v.left_at DESC
        `, [examId]);

        // Calculate statistics
        const stats = {
            totalViolations: violations.length,
            uniqueStudents: [...new Set(violations.map(v => v.user_id))].length,
            totalDuration: violations.reduce((sum, v) => sum + (v.duration_seconds || 0), 0)
        };

        res.json({
            success: true,
            exam: exams[0],
            violations,
            stats
        });
    } catch (error) {
        console.error('Get violations error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;

