const express = require('express');
const router = express.Router();
const db = require('../config/database');
const bcrypt = require('bcryptjs');
const { isAdmin } = require('../middleware/auth');

// Get all users
router.get('/users', isAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, fullname, username, email, role, created_at, updated_at FROM users ORDER BY created_at DESC'
        );

        res.json({ 
            success: true, 
            users 
        });

    } catch (error) {
        console.error('Get users error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Get user by ID
router.get('/users/:id', isAdmin, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, fullname, username, email, role, created_at, updated_at FROM users WHERE id = ?',
            [req.params.id]
        );

        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        res.json({ 
            success: true, 
            user: users[0] 
        });

    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Create new user
router.post('/users', isAdmin, async (req, res) => {
    try {
        const { fullname, username, email, password, role } = req.body;

        // Validation
        if (!fullname || !username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Fullname, username, email, and password are required'
            });
        }

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid role' 
            });
        }

        // Check if user already exists
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE username = ? OR email = ?',
            [username, email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Username or email already exists' 
            });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert new user
        const [result] = await db.query(
            'INSERT INTO users (fullname, username, email, password, role) VALUES (?, ?, ?, ?, ?)',
            [fullname, username, email, hashedPassword, role]
        );

        res.status(201).json({ 
            success: true, 
            message: 'User created successfully',
            userId: result.insertId
        });

    } catch (error) {
        console.error('Create user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Update user
router.put('/users/:id', isAdmin, async (req, res) => {
    try {
        const { fullname, email, role } = req.body;
        const userId = req.params.id;

        // Validation
        if (!fullname || !email || !role) {
            return res.status(400).json({
                success: false,
                message: 'Fullname, email and role are required'
            });
        }

        if (!['user', 'admin'].includes(role)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid role' 
            });
        }

        // Check if user exists
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Check if email is already used by another user
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ? AND id != ?',
            [email, userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already in use' 
            });
        }

        // Update user
        await db.query(
            'UPDATE users SET fullname = ?, email = ?, role = ? WHERE id = ?',
            [fullname, email, role, userId]
        );

        res.json({ 
            success: true, 
            message: 'User updated successfully' 
        });

    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Delete user
router.delete('/users/:id', isAdmin, async (req, res) => {
    try {
        const userId = req.params.id;

        // Prevent admin from deleting themselves
        if (parseInt(userId) === req.session.userId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot delete your own account' 
            });
        }

        // Check if user exists
        const [users] = await db.query('SELECT * FROM users WHERE id = ?', [userId]);
        
        if (users.length === 0) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found' 
            });
        }

        // Delete user
        await db.query('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ 
            success: true, 
            message: 'User deleted successfully' 
        });

    } catch (error) {
        console.error('Delete user error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Get statistics
router.get('/stats', isAdmin, async (req, res) => {
    try {
        const [totalUsers] = await db.query('SELECT COUNT(*) as count FROM users');
        const [totalAdmins] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "admin"');
        const [totalRegularUsers] = await db.query('SELECT COUNT(*) as count FROM users WHERE role = "user"');

        res.json({ 
            success: true, 
            stats: {
                totalUsers: totalUsers[0].count,
                totalAdmins: totalAdmins[0].count,
                totalRegularUsers: totalRegularUsers[0].count
            }
        });

    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;

