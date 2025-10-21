/**
 * Notification Manager
 * Manages exam notifications from admin to students during contests
 */

const db = require('../config/database');
const sseManager = require('./sse-manager');

class NotificationManager {
    /**
     * Create a new notification for an exam
     * @param {number} examId - Exam ID
     * @param {string} message - Notification message
     * @param {number} createdBy - Admin user ID
     * @returns {Promise<object>} Created notification
     */
    async createNotification(examId, message, createdBy) {
        try {
            // Validate inputs
            if (!examId || !message || !createdBy) {
                throw new Error('examId, message, and createdBy are required');
            }

            // Check if exam exists
            const [exams] = await db.query('SELECT id, title FROM exams WHERE id = ?', [examId]);
            if (exams.length === 0) {
                throw new Error('Exam not found');
            }

            // Insert notification
            const [result] = await db.query(`
                INSERT INTO exam_notifications (exam_id, message, created_by)
                VALUES (?, ?, ?)
            `, [examId, message, createdBy]);

            const notificationId = result.insertId;

            // Get the created notification
            const [notifications] = await db.query(`
                SELECT n.*, u.fullname as creator_name, e.title as exam_title
                FROM exam_notifications n
                JOIN users u ON n.created_by = u.id
                JOIN exams e ON n.exam_id = e.id
                WHERE n.id = ?
            `, [notificationId]);

            const notification = notifications[0];

            // Send notification to all students in the exam via SSE
            const clientCount = sseManager.sendToExam(examId, 'exam_notification', {
                id: notification.id,
                message: notification.message,
                createdAt: notification.created_at,
                creatorName: notification.creator_name,
                examTitle: notification.exam_title
            });

            console.log(`[NOTIFICATION] Created and sent notification ${notificationId} to ${clientCount} clients in exam ${examId}`);

            return {
                success: true,
                notification,
                clientCount
            };
        } catch (error) {
            console.error('[NOTIFICATION] Create error:', error);
            throw error;
        }
    }

    /**
     * Get all notifications for an exam
     * @param {number} examId - Exam ID
     * @param {boolean} activeOnly - Only get active notifications
     * @returns {Promise<Array>} List of notifications
     */
    async getNotifications(examId, activeOnly = false) {
        try {
            let query = `
                SELECT n.*, u.fullname as creator_name
                FROM exam_notifications n
                JOIN users u ON n.created_by = u.id
                WHERE n.exam_id = ?
            `;

            if (activeOnly) {
                query += ' AND n.is_active = TRUE';
            }

            query += ' ORDER BY n.created_at DESC';

            const [notifications] = await db.query(query, [examId]);

            return notifications;
        } catch (error) {
            console.error('[NOTIFICATION] Get notifications error:', error);
            throw error;
        }
    }

    /**
     * Get a single notification by ID
     * @param {number} notificationId - Notification ID
     * @returns {Promise<object>} Notification object
     */
    async getNotificationById(notificationId) {
        try {
            const [notifications] = await db.query(`
                SELECT n.*, u.fullname as creator_name, e.title as exam_title
                FROM exam_notifications n
                JOIN users u ON n.created_by = u.id
                JOIN exams e ON n.exam_id = e.id
                WHERE n.id = ?
            `, [notificationId]);

            if (notifications.length === 0) {
                throw new Error('Notification not found');
            }

            return notifications[0];
        } catch (error) {
            console.error('[NOTIFICATION] Get notification by ID error:', error);
            throw error;
        }
    }

    /**
     * Deactivate a notification
     * @param {number} notificationId - Notification ID
     * @returns {Promise<boolean>} Success status
     */
    async deactivateNotification(notificationId) {
        try {
            await db.query(`
                UPDATE exam_notifications
                SET is_active = FALSE
                WHERE id = ?
            `, [notificationId]);

            console.log(`[NOTIFICATION] Deactivated notification ${notificationId}`);
            return true;
        } catch (error) {
            console.error('[NOTIFICATION] Deactivate error:', error);
            throw error;
        }
    }

    /**
     * Delete a notification
     * @param {number} notificationId - Notification ID
     * @returns {Promise<boolean>} Success status
     */
    async deleteNotification(notificationId) {
        try {
            await db.query('DELETE FROM exam_notifications WHERE id = ?', [notificationId]);

            console.log(`[NOTIFICATION] Deleted notification ${notificationId}`);
            return true;
        } catch (error) {
            console.error('[NOTIFICATION] Delete error:', error);
            throw error;
        }
    }

    /**
     * Get notification statistics for an exam
     * @param {number} examId - Exam ID
     * @returns {Promise<object>} Statistics
     */
    async getNotificationStats(examId) {
        try {
            const [stats] = await db.query(`
                SELECT
                    COUNT(*) as total_notifications,
                    SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_notifications,
                    MIN(created_at) as first_notification_at,
                    MAX(created_at) as last_notification_at
                FROM exam_notifications
                WHERE exam_id = ?
            `, [examId]);

            return stats[0];
        } catch (error) {
            console.error('[NOTIFICATION] Get stats error:', error);
            throw error;
        }
    }
}

// Export singleton instance
module.exports = new NotificationManager();

