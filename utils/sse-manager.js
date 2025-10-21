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
        // Ensure examId and userId are numbers for consistent Map keys
        const examIdNum = parseInt(examId);
        const userIdNum = parseInt(userId);

        if (!this.examConnections.has(examIdNum)) {
            this.examConnections.set(examIdNum, new Map());
        }

        const examClients = this.examConnections.get(examIdNum);
        examClients.set(userIdNum, res);

        console.log(`[SSE] Client connected: examId=${examIdNum}, userId=${userIdNum}, total=${examClients.size}`);

        // Remove connection when client disconnects
        res.on('close', () => {
            this.removeConnection(examIdNum, userIdNum);
        });
    }

    /**
     * Remove a client connection
     * @param {number} examId - Exam ID
     * @param {number} userId - User ID
     */
    removeConnection(examId, userId) {
        // Ensure examId and userId are numbers for consistent Map keys
        const examIdNum = parseInt(examId);
        const userIdNum = parseInt(userId);

        const examClients = this.examConnections.get(examIdNum);
        if (examClients) {
            examClients.delete(userIdNum);
            console.log(`[SSE] Client disconnected: examId=${examIdNum}, userId=${userIdNum}, remaining=${examClients.size}`);

            // Clean up empty exam maps
            if (examClients.size === 0) {
                this.examConnections.delete(examIdNum);
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
        // Ensure examId is a number for consistent Map keys
        const examIdNum = parseInt(examId);

        const examClients = this.examConnections.get(examIdNum);
        if (!examClients) {
            console.log(`[SSE] No clients connected for exam ${examIdNum}`);
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
                this.removeConnection(examIdNum, userId);
            }
        });

        console.log(`[SSE] Sent ${eventType} to ${sentCount} clients in exam ${examIdNum}`);
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

