const express = require('express');
const router = express.Router();
const { isAdmin, isAuthenticated } = require('../middleware/auth');
const notificationManager = require('../utils/notification-manager');

/**
 * Admin: Create a new notification for an exam
 * POST /api/notifications/exams/:examId
 */
router.post('/exams/:examId', isAdmin, async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);
        const { message } = req.body;
        const createdBy = req.session.userId;

        // Validate input
        if (!message || message.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Message is required and cannot be empty'
            });
        }

        // Create notification and send to students
        const result = await notificationManager.createNotification(examId, message.trim(), createdBy);

        res.json({
            success: true,
            message: `Notification sent to ${result.clientCount} students`,
            notification: result.notification,
            clientCount: result.clientCount
        });
    } catch (error) {
        console.error('Create notification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to create notification'
        });
    }
});

/**
 * Admin: Get all notifications for an exam
 * GET /api/notifications/exams/:examId
 */
router.get('/exams/:examId', isAdmin, async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);
        const activeOnly = req.query.activeOnly === 'true';

        const notifications = await notificationManager.getNotifications(examId, activeOnly);

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get notifications'
        });
    }
});

/**
 * Admin: Get notification statistics for an exam
 * GET /api/notifications/exams/:examId/stats
 */
router.get('/exams/:examId/stats', isAdmin, async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);

        const stats = await notificationManager.getNotificationStats(examId);

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get notification stats error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get notification stats'
        });
    }
});

/**
 * Admin: Deactivate a notification
 * PUT /api/notifications/:notificationId/deactivate
 */
router.put('/:notificationId/deactivate', isAdmin, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.notificationId);

        await notificationManager.deactivateNotification(notificationId);

        res.json({
            success: true,
            message: 'Notification deactivated successfully'
        });
    } catch (error) {
        console.error('Deactivate notification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to deactivate notification'
        });
    }
});

/**
 * Admin: Delete a notification
 * DELETE /api/notifications/:notificationId
 */
router.delete('/:notificationId', isAdmin, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.notificationId);

        await notificationManager.deleteNotification(notificationId);

        res.json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to delete notification'
        });
    }
});

/**
 * Student: Get active notifications for an exam (for initial load)
 * GET /api/notifications/exams/:examId/active
 */
router.get('/exams/:examId/active', isAuthenticated, async (req, res) => {
    try {
        const examId = parseInt(req.params.examId);

        // Get only active notifications
        const notifications = await notificationManager.getNotifications(examId, true);

        res.json({
            success: true,
            notifications
        });
    } catch (error) {
        console.error('Get active notifications error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Failed to get active notifications'
        });
    }
});

module.exports = router;

