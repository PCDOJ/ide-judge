/**
 * Server-Sent Events Manager
 * Manages SSE connections for real-time communication with exam clients
 */

class SSEManager {
    constructor() {
        // Map of examId -> Set of client connections
        this.examConnections = new Map();
    }

    /**
     * Add a client connection to an exam
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     * @param {object} res - Express response object
     */
    addConnection(examId, userId, res) {
        if (!this.examConnections.has(examId)) {
            this.examConnections.set(examId, new Map());
        }

        const examClients = this.examConnections.get(examId);
        examClients.set(userId, res);

        console.log(`[SSE] Client connected: examId=${examId}, userId=${userId}, total=${examClients.size}`);

        // Remove connection when client disconnects
        res.on('close', () => {
            this.removeConnection(examId, userId);
        });
    }

    /**
     * Remove a client connection
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     */
    removeConnection(examId, userId) {
        const examClients = this.examConnections.get(examId);
        if (examClients) {
            examClients.delete(userId);
            console.log(`[SSE] Client disconnected: examId=${examId}, userId=${userId}, remaining=${examClients.size}`);

            // Clean up empty exam maps
            if (examClients.size === 0) {
                this.examConnections.delete(examId);
            }
        }
    }

    /**
     * Send event to all clients in an exam
     * @param {number} examId - Exam ID
     * @param {string} eventType - Event type
     * @param {object} data - Event data
     */
    sendToExam(examId, eventType, data) {
        const examClients = this.examConnections.get(examId);
        if (!examClients) {
            console.log(`[SSE] No clients connected for exam ${examId}`);
            return 0;
        }

        let sentCount = 0;
        examClients.forEach((res, userId) => {
            try {
                res.write(`event: ${eventType}\n`);
                res.write(`data: ${JSON.stringify(data)}\n\n`);
                sentCount++;
            } catch (error) {
                console.error(`[SSE] Error sending to user ${userId}:`, error);
                this.removeConnection(examId, userId);
            }
        });

        console.log(`[SSE] Sent ${eventType} to ${sentCount} clients in exam ${examId}`);
        return sentCount;
    }

    /**
     * Get number of connected clients for an exam
     * @param {number} examId - Exam ID
     * @returns {number} Number of connected clients
     */
    getConnectionCount(examId) {
        const examClients = this.examConnections.get(examId);
        return examClients ? examClients.size : 0;
    }

    /**
     * Get all connected exam IDs
     * @returns {Array<number>} Array of exam IDs
     */
    getActiveExams() {
        return Array.from(this.examConnections.keys());
    }
}

// Export singleton instance
module.exports = new SSEManager();

