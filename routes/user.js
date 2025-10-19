const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { isAuthenticated } = require('../middleware/auth');

// Get current user profile
router.get('/profile', isAuthenticated, async (req, res) => {
    try {
        const [users] = await db.query(
            'SELECT id, fullname, username, email, role, created_at FROM users WHERE id = ?',
            [req.session.userId]
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
        console.error('Get profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

// Update user profile
router.put('/profile', isAuthenticated, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email is required' 
            });
        }

        // Check if email is already used by another user
        const [existingUsers] = await db.query(
            'SELECT * FROM users WHERE email = ? AND id != ?',
            [email, req.session.userId]
        );

        if (existingUsers.length > 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email already in use' 
            });
        }

        // Update user
        await db.query(
            'UPDATE users SET email = ? WHERE id = ?',
            [email, req.session.userId]
        );

        res.json({ 
            success: true, 
            message: 'Profile updated successfully' 
        });

    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error' 
        });
    }
});

module.exports = router;

