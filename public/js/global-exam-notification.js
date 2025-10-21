/**
 * Global Exam Notification Listener
 * Listens for exam notifications across all pages when user is in an active exam
 */

(function() {
    'use strict';

    // Constants
    const STORAGE_KEY_ACTIVE_EXAM = 'exam_monitoring_exam_id'; // Reuse from exam-monitoring.js
    const STORAGE_KEY_MONITORING = 'exam_monitoring_active'; // Reuse from exam-monitoring.js
    const CHECK_INTERVAL = 5000; // Check every 5 seconds

    // State
    let eventSource = null;
    let currentExamId = null;
    let checkInterval = null;
    let notificationModal = null;

    /**
     * Initialize global notification listener
     */
    function init() {
        console.log('[GLOBAL-NOTIFICATION] Initializing...');

        // Check if user is in an active exam
        checkAndConnect();

        // Periodically check exam status
        checkInterval = setInterval(checkAndConnect, CHECK_INTERVAL);

        // Listen for storage changes (when user joins/leaves exam in another tab)
        window.addEventListener('storage', handleStorageChange);

        console.log('[GLOBAL-NOTIFICATION] Initialized');
    }

    /**
     * Check if user is in an active exam and connect SSE if needed
     */
    async function checkAndConnect() {
        const isMonitoring = localStorage.getItem(STORAGE_KEY_MONITORING) === 'true';
        const examId = localStorage.getItem(STORAGE_KEY_ACTIVE_EXAM);

        // If not monitoring or no exam ID, disconnect
        if (!isMonitoring || !examId) {
            if (eventSource) {
                console.log('[GLOBAL-NOTIFICATION] User not in exam, disconnecting...');
                disconnect();
            }
            return;
        }

        // If already connected to the same exam, do nothing
        if (currentExamId === examId && eventSource) {
            return;
        }

        // Verify exam status with server
        try {
            const response = await fetch(`/api/user/exams/${examId}/monitoring-status`);
            const data = await response.json();

            if (data.success) {
                const isJoined = data.registrationType === 'joined';
                const isOngoing = data.examStatus === 'ongoing';

                if (isJoined && isOngoing) {
                    // Connect to SSE
                    connect(examId);
                } else {
                    // Not in active exam, disconnect
                    console.log('[GLOBAL-NOTIFICATION] Exam not active:', data.reason);
                    disconnect();
                }
            } else {
                console.error('[GLOBAL-NOTIFICATION] Failed to check exam status:', data.message);
                disconnect();
            }
        } catch (error) {
            console.error('[GLOBAL-NOTIFICATION] Error checking exam status:', error);
        }
    }

    /**
     * Connect to SSE for exam notifications
     */
    function connect(examId) {
        // Disconnect existing connection
        if (eventSource) {
            disconnect();
        }

        console.log('[GLOBAL-NOTIFICATION] Connecting to exam:', examId);

        currentExamId = examId;
        eventSource = new EventSource(`/api/exams/${examId}/events`);

        eventSource.addEventListener('exam_notification', handleNotification);
        eventSource.addEventListener('exam_stopped', handleExamStopped);

        eventSource.onerror = (error) => {
            console.error('[GLOBAL-NOTIFICATION] SSE error:', error);
            // Will reconnect on next check
            disconnect();
        };

        console.log('[GLOBAL-NOTIFICATION] Connected to exam:', examId);
    }

    /**
     * Disconnect from SSE
     */
    function disconnect() {
        if (eventSource) {
            eventSource.close();
            eventSource = null;
            currentExamId = null;
            console.log('[GLOBAL-NOTIFICATION] Disconnected');
        }
    }

    /**
     * Handle notification event
     */
    function handleNotification(event) {
        try {
            const data = JSON.parse(event.data);
            console.log('[GLOBAL-NOTIFICATION] Received notification:', data);

            // Show notification modal
            showNotificationModal(data);

            // Play notification sound
            playNotificationSound();
        } catch (error) {
            console.error('[GLOBAL-NOTIFICATION] Error handling notification:', error);
        }
    }

    /**
     * Handle exam stopped event
     */
    function handleExamStopped(event) {
        console.log('[GLOBAL-NOTIFICATION] Exam stopped');
        disconnect();
    }

    /**
     * Show notification modal
     */
    function showNotificationModal(data) {
        // Parse message (format: **Title**\n\nContent)
        let title = 'Thông báo từ quản trị viên';
        let content = data.message;

        const titleMatch = data.message.match(/^\*\*(.+?)\*\*\n\n([\s\S]+)$/);
        if (titleMatch) {
            title = titleMatch[1];
            content = titleMatch[2];
        }

        // Create modal if not exists
        if (!document.getElementById('globalExamNotificationModal')) {
            createNotificationModal();
        }

        // Update modal content
        document.getElementById('globalNotificationTitle').textContent = title;
        document.getElementById('globalNotificationMessage').innerHTML = content.replace(/\n/g, '<br>');

        const time = new Date(data.createdAt).toLocaleString('vi-VN');
        document.getElementById('globalNotificationTime').textContent = `Gửi lúc: ${time} | Từ: ${data.creatorName}`;

        // Show modal
        if (!notificationModal) {
            const modalElement = document.getElementById('globalExamNotificationModal');
            notificationModal = new bootstrap.Modal(modalElement, {
                backdrop: 'static',
                keyboard: false
            });
        }

        notificationModal.show();
    }

    /**
     * Create notification modal HTML
     */
    function createNotificationModal() {
        const modalHtml = `
            <div class="modal fade" id="globalExamNotificationModal" tabindex="-1" data-bs-backdrop="static" data-bs-keyboard="false">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header bg-primary text-white">
                            <h5 class="modal-title">
                                <i class="bi bi-megaphone-fill"></i> <span id="globalNotificationTitle">Thông báo từ quản trị viên</span>
                            </h5>
                        </div>
                        <div class="modal-body">
                            <div class="alert alert-info mb-3">
                                <i class="bi bi-info-circle"></i> Bạn có thông báo mới từ quản trị viên
                            </div>
                            <div class="notification-content">
                                <p id="globalNotificationMessage" class="fs-5 mb-3"></p>
                                <small class="text-muted" id="globalNotificationTime"></small>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-primary" onclick="GlobalExamNotification.closeModal()">
                                <i class="bi bi-check-circle"></i> Đã hiểu
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    /**
     * Close notification modal
     */
    function closeModal() {
        if (notificationModal) {
            notificationModal.hide();
        }
    }

    /**
     * Play notification sound
     */
    function playNotificationSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.error('[GLOBAL-NOTIFICATION] Error playing sound:', error);
        }
    }

    /**
     * Handle storage change (when user joins/leaves exam in another tab)
     */
    function handleStorageChange(event) {
        if (event.key === STORAGE_KEY_MONITORING || event.key === STORAGE_KEY_ACTIVE_EXAM) {
            console.log('[GLOBAL-NOTIFICATION] Storage changed, rechecking...');
            checkAndConnect();
        }
    }

    /**
     * Cleanup on page unload
     */
    function cleanup() {
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        disconnect();
        window.removeEventListener('storage', handleStorageChange);
    }

    // Initialize on page load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);

    // Public API
    window.GlobalExamNotification = {
        closeModal: closeModal,
        disconnect: disconnect,
        isConnected: function() {
            return eventSource !== null;
        }
    };

})();

