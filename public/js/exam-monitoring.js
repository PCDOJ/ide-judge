// Global Exam Monitoring Module
// This module monitors user activity during exams to prevent cheating
// It works across all pages in the system

(function() {
    'use strict';

    // Monitoring state
    let monitoringActive = false;
    let tabLeftTime = null;
    let violationAlertShown = false;
    let focusCheckInterval = null;
    let examTimeCheckInterval = null;
    let validationCheckInterval = null; // NEW: Check monitoring conditions periodically
    let lastFocusCheck = Date.now();
    let currentExamId = null;
    let currentExamTitle = null;
    let currentExamEndTime = null;
    let pageJustLoaded = true;
    let lastBlurTime = 0;

    // LocalStorage keys
    const STORAGE_KEY_MONITORING = 'exam_monitoring_active';
    const STORAGE_KEY_EXAM_ID = 'exam_monitoring_exam_id';
    const STORAGE_KEY_EXAM_TITLE = 'exam_monitoring_exam_title';
    const STORAGE_KEY_EXAM_END_TIME = 'exam_monitoring_end_time';

    // SessionStorage keys (persist during browser session but not across tabs)
    const SESSION_KEY_FULLSCREEN_REQUESTED = 'exam_monitoring_fullscreen_requested';

    /**
     * Validate monitoring conditions (user joined + exam ongoing)
     */
    async function validateMonitoringConditions() {
        if (!currentExamId) {
            return { shouldMonitor: false, reason: 'No exam ID' };
        }

        try {
            const response = await fetch(`/api/user/exams/${currentExamId}/monitoring-status`);
            const data = await response.json();

            console.log('[EXAM-MONITOR] Validation check:', data);
            return data;
        } catch (error) {
            console.error('[EXAM-MONITOR] Validation error:', error);
            return { shouldMonitor: false, reason: 'Validation failed' };
        }
    }

    /**
     * Clear monitoring data from storage
     */
    function clearMonitoringData() {
        localStorage.removeItem(STORAGE_KEY_MONITORING);
        localStorage.removeItem(STORAGE_KEY_EXAM_ID);
        localStorage.removeItem(STORAGE_KEY_EXAM_TITLE);
        localStorage.removeItem(STORAGE_KEY_EXAM_END_TIME);
    }

    /**
     * Validate and start monitoring if conditions are met
     */
    async function validateAndStartMonitoring() {
        const validation = await validateMonitoringConditions();

        if (validation.shouldMonitor) {
            console.log('[EXAM-MONITOR] Conditions met, starting monitoring');
            startMonitoring();
        } else {
            console.log('[EXAM-MONITOR] Conditions not met:', validation.reason);
            clearMonitoringData();
        }
    }

    // Initialize monitoring on page load
    function init() {
        // Check if monitoring should be active
        const storedMonitoring = localStorage.getItem(STORAGE_KEY_MONITORING);
        const storedExamId = localStorage.getItem(STORAGE_KEY_EXAM_ID);
        const storedExamTitle = localStorage.getItem(STORAGE_KEY_EXAM_TITLE);
        const storedEndTime = localStorage.getItem(STORAGE_KEY_EXAM_END_TIME);

        if (storedMonitoring === 'true' && storedExamId) {
            currentExamId = storedExamId;
            currentExamTitle = storedExamTitle || 'Kỳ thi';
            currentExamEndTime = storedEndTime;

            // Validate monitoring conditions before starting
            validateAndStartMonitoring();
        }
    }

    // Start monitoring
    function startMonitoring() {
        if (monitoringActive) {
            console.log('[EXAM-MONITOR] Already active');
            return;
        }

        console.log('[EXAM-MONITOR] Starting global monitoring for exam:', currentExamId);
        monitoringActive = true;

        // Set flag to prevent false positives during page load
        pageJustLoaded = true;
        setTimeout(() => {
            pageJustLoaded = false;
            console.log('[EXAM-MONITOR] Page load grace period ended, monitoring fully active');
        }, 3000); // 3 second grace period after page load (increased from 2s)

        // Add event listeners
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur, true); // Use capture phase
        window.addEventListener('focus', handleWindowFocus, true); // Use capture phase
        window.addEventListener('beforeunload', handleBeforeUnload);
        document.addEventListener('mouseleave', handleMouseLeave);
        document.addEventListener('contextmenu', handleContextMenu);

        // Start periodic checks
        startFocusCheck();
        startExamTimeCheck();
        startValidationCheck(); // NEW: Periodic validation of monitoring conditions

        // Request fullscreen mode (only once per session)
        requestFullscreenMode();

        // Show initial warning (only once per session)
        if (!sessionStorage.getItem('monitoring_warning_shown')) {
            showMonitoringWarning();
            sessionStorage.setItem('monitoring_warning_shown', 'true');
        }

        console.log('[EXAM-MONITOR] Global monitoring started');
    }

    // Stop monitoring
    function stopMonitoring() {
        if (!monitoringActive) return;

        console.log('[EXAM-MONITOR] Stopping global monitoring');
        monitoringActive = false;

        // Remove event listeners
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('blur', handleWindowBlur);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        document.removeEventListener('mouseleave', handleMouseLeave);
        document.removeEventListener('contextmenu', handleContextMenu);

        // Clear intervals
        if (focusCheckInterval) {
            clearInterval(focusCheckInterval);
            focusCheckInterval = null;
        }
        if (examTimeCheckInterval) {
            clearInterval(examTimeCheckInterval);
            examTimeCheckInterval = null;
        }
        if (validationCheckInterval) {
            clearInterval(validationCheckInterval);
            validationCheckInterval = null;
        }

        // Exit fullscreen if active
        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.log('[EXAM-MONITOR] Exit fullscreen failed:', err);
            });
        }

        // Clear localStorage
        localStorage.removeItem(STORAGE_KEY_MONITORING);
        localStorage.removeItem(STORAGE_KEY_EXAM_ID);
        localStorage.removeItem(STORAGE_KEY_EXAM_TITLE);
        localStorage.removeItem(STORAGE_KEY_EXAM_END_TIME);

        // Clear sessionStorage
        sessionStorage.removeItem('monitoring_warning_shown');
        sessionStorage.removeItem(SESSION_KEY_FULLSCREEN_REQUESTED);
        sessionStorage.removeItem('fullscreen_listener_added');

        console.log('[EXAM-MONITOR] Global monitoring stopped');
    }

    // Start periodic focus check
    function startFocusCheck() {
        if (focusCheckInterval) return;

        focusCheckInterval = setInterval(() => {
            // Skip if page just loaded
            if (pageJustLoaded) return;

            if (!document.hasFocus() && monitoringActive) {
                const now = Date.now();
                // Only log if focus lost for more than 3 seconds to reduce false positives
                // This prevents triggering when user briefly interacts with IDE iframe
                if (now - lastFocusCheck > 3000 && !tabLeftTime) {
                    console.log('[EXAM-MONITOR] Focus lost detected');
                    onTabLeft('focus_lost');
                }
            }
            lastFocusCheck = Date.now();
        }, 2000); // Check every 2 seconds (reduced frequency)
    }

    // Start periodic exam time check
    function startExamTimeCheck() {
        if (examTimeCheckInterval) return;
        if (!currentExamEndTime) return; // No end time set

        examTimeCheckInterval = setInterval(() => {
            if (!monitoringActive) return;

            const now = new Date();
            const endTime = new Date(currentExamEndTime);

            if (now > endTime) {
                console.log('[EXAM-MONITOR] Exam time has ended, stopping monitoring');
                stopMonitoring();

                // Show notification
                if (typeof showToast === 'function') {
                    showToast('info', 'Kỳ thi đã kết thúc', 'Hệ thống giám sát đã dừng');
                }
            }
        }, 10000); // Check every 10 seconds
    }

    // NEW: Start periodic validation check (user joined + exam ongoing)
    function startValidationCheck() {
        if (validationCheckInterval) return;

        validationCheckInterval = setInterval(async () => {
            if (!monitoringActive) return;

            const validation = await validateMonitoringConditions();

            if (!validation.shouldMonitor) {
                console.log('[EXAM-MONITOR] Validation failed:', validation.reason);
                console.log('[EXAM-MONITOR] Stopping monitoring - conditions no longer met');
                stopMonitoring();

                // Show notification
                if (typeof showToast === 'function') {
                    showToast('warning', 'Giám sát đã dừng', validation.reason);
                } else {
                    alert(`⚠️ Hệ thống giám sát đã dừng\n\nLý do: ${validation.reason}`);
                }
            }
        }, 15000); // Check every 15 seconds
    }

    // Handle visibility change
    function handleVisibilityChange() {
        if (!monitoringActive) return;

        // Skip if page just loaded (prevent false positive during navigation)
        if (pageJustLoaded) {
            console.log('[EXAM-MONITOR] Visibility change during page load - ignoring');
            return;
        }

        if (document.hidden) {
            console.log('[EXAM-MONITOR] Tab hidden - user switched to another tab');
            onTabLeft('tab_hidden');
        } else {
            console.log('[EXAM-MONITOR] Tab visible - user returned');
            onTabReturned();
        }
    }

    // Handle window blur
    function handleWindowBlur() {
        if (!monitoringActive) return;

        // Skip if page just loaded
        if (pageJustLoaded) {
            console.log('[EXAM-MONITOR] Window blur during page load - ignoring');
            return;
        }

        // Prevent duplicate triggers within 2 seconds
        const now = Date.now();
        if (now - lastBlurTime < 2000) {
            console.log('[EXAM-MONITOR] Window blur - too soon after last blur, ignoring');
            return;
        }
        lastBlurTime = now;

        console.log('[EXAM-MONITOR] Window blur - window lost focus');
        // Only log if not already logged by visibility change
        // Add delay to prevent false positives from IDE iframe interactions
        setTimeout(() => {
            if (!document.hidden && !tabLeftTime && !document.hasFocus()) {
                onTabLeft('window_blur');
            }
        }, 500); // 500ms delay to filter out brief focus changes
    }

    // Handle window focus
    function handleWindowFocus() {
        if (!monitoringActive) return;

        console.log('[EXAM-MONITOR] Window focus - window gained focus');
        if (tabLeftTime) {
            onTabReturned();
        }
    }

    // Handle mouse leaving window
    function handleMouseLeave(e) {
        if (!monitoringActive) return;

        // Skip if page just loaded
        if (pageJustLoaded) return;

        // Only trigger if mouse actually left the window
        if (e.clientY <= 0 || e.clientX <= 0 ||
            e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
            console.log('[EXAM-MONITOR] Mouse left window boundary');
            // Increase delay to 1 second to reduce false positives
            setTimeout(() => {
                if (!document.hasFocus() && !tabLeftTime && !document.hidden) {
                    onTabLeft('mouse_leave');
                }
            }, 1000);
        }
    }

    // Handle context menu (right-click)
    function handleContextMenu(e) {
        if (!monitoringActive) return;

        console.log('[EXAM-MONITOR] Context menu attempted');
        e.preventDefault();
        alert('⚠️ Chuột phải đã bị vô hiệu hóa trong kỳ thi này.');
        return false;
    }

    // Handle before unload
    function handleBeforeUnload(e) {
        if (!monitoringActive) return;

        // Check if navigating within the same domain
        const currentDomain = window.location.hostname;
        // Allow navigation within the system
        // The monitoring will continue on the next page

        // Only show warning if trying to close tab or navigate away from domain
        // This is handled by browser, we just log it
        console.log('[EXAM-MONITOR] Before unload event');
    }

    // Request fullscreen mode
    function requestFullscreenMode() {
        // Check if already requested in this session
        const alreadyRequested = sessionStorage.getItem(SESSION_KEY_FULLSCREEN_REQUESTED);

        if (!alreadyRequested && document.documentElement.requestFullscreen) {
            // Mark as requested in session storage
            sessionStorage.setItem(SESSION_KEY_FULLSCREEN_REQUESTED, 'true');

            setTimeout(() => {
                if (confirm('Để đảm bảo tính công bằng, vui lòng bật chế độ toàn màn hình.\n\nBạn có muốn bật chế độ toàn màn hình không?')) {
                    document.documentElement.requestFullscreen().catch(err => {
                        console.log('[EXAM-MONITOR] Fullscreen request failed:', err);
                    });
                }
            }, 1000);
        }

        // Monitor fullscreen changes (only add listener once)
        if (!sessionStorage.getItem('fullscreen_listener_added')) {
            sessionStorage.setItem('fullscreen_listener_added', 'true');
            document.addEventListener('fullscreenchange', () => {
                if (!document.fullscreenElement && monitoringActive && !pageJustLoaded) {
                    console.log('[EXAM-MONITOR] Exited fullscreen');
                    onTabLeft('exit_fullscreen');
                }
            });
        }
    }

    // Show initial monitoring warning
    function showMonitoringWarning() {
        setTimeout(() => {
            alert(`🔒 CHẾ ĐỘ GIÁM SÁT CHỐNG GIAN LẬN\n\n` +
                  `⚠️ Kỳ thi "${currentExamTitle}" có bật tính năng chống gian lận.\n\n` +
                  `CÁC HÀNH VI SAU SẼ BỊ GHI LẠI:\n` +
                  `• Chuyển sang tab/cửa sổ khác\n` +
                  `• Click ra ngoài trình duyệt\n` +
                  `• Sử dụng phím tắt Alt+Tab, Cmd+Tab\n` +
                  `• Thoát chế độ toàn màn hình\n\n` +
                  `⏱️ Thời gian vi phạm sẽ được ghi lại và báo cáo cho giám thị.\n\n` +
                  `✅ Bạn có thể tự do chuyển giữa các bài trong kỳ thi.\n` +
                  `❌ KHÔNG được chuyển sang tab/ứng dụng khác!`);
        }, 500);
    }

    // Called when user leaves the tab
    async function onTabLeft(violationType) {
        if (!monitoringActive) return;

        // Prevent duplicate logs for the same violation
        if (tabLeftTime) {
            console.log('[EXAM-MONITOR] Already logged, skipping duplicate');
            return;
        }

        tabLeftTime = Date.now();

        const violationDescriptions = {
            'tab_hidden': 'Chuyển sang tab khác',
            'window_blur': 'Click ra ngoài trình duyệt',
            'page_unload': 'Cố gắng đóng/rời khỏi trang',
            'mouse_leave': 'Di chuyển chuột ra ngoài cửa sổ',
            'exit_fullscreen': 'Thoát chế độ toàn màn hình',
            'focus_lost': 'Mất focus của cửa sổ'
        };

        const description = violationDescriptions[violationType] || violationType;

        // Show alert warning for serious violations
        if (!violationAlertShown &&
            ['tab_hidden', 'window_blur', 'exit_fullscreen'].includes(violationType)) {
            violationAlertShown = true;
            setTimeout(() => {
                alert(`⚠️ VI PHẠM PHÁT HIỆN: ${description}\n\n` +
                      `Hành vi này đã được ghi lại với thông tin:\n` +
                      `• Thời gian: ${new Date(tabLeftTime).toLocaleString('vi-VN')}\n` +
                      `• Kỳ thi: ${currentExamTitle}\n\n` +
                      `Vui lòng quay lại tab thi ngay!`);
                violationAlertShown = false;
            }, 100);
        }

        // Log violation to server
        try {
            const response = await fetch('/api/exam-violations/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: currentExamId,
                    left_at: new Date(tabLeftTime).toISOString(),
                    violation_type: violationType
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('[EXAM-MONITOR] ✓ Violation logged successfully:', violationType);
            } else {
                console.error('[EXAM-MONITOR] ✗ Server error:', result.message);
            }
        } catch (error) {
            console.error('[EXAM-MONITOR] ✗ Failed to log violation:', error);
        }
    }

    // Called when user returns to the tab
    async function onTabReturned() {
        if (!tabLeftTime) return;

        const returnedTime = Date.now();
        const durationSeconds = Math.floor((returnedTime - tabLeftTime) / 1000);

        console.log('[EXAM-MONITOR] User returned after', durationSeconds, 'seconds');

        // Update violation with return time
        try {
            const response = await fetch('/api/exam-violations/update-return', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    exam_id: currentExamId,
                    returned_at: new Date(returnedTime).toISOString(),
                    duration_seconds: durationSeconds  // Send pre-calculated duration
                })
            });

            const result = await response.json();
            if (result.success) {
                console.log('[EXAM-MONITOR] ✓ Return time logged successfully');
            } else {
                console.error('[EXAM-MONITOR] ✗ Server error:', result.message);
            }
        } catch (error) {
            console.error('[EXAM-MONITOR] ✗ Failed to log return:', error);
        }

        // Reset tab left time
        tabLeftTime = null;

        // Show return notification for long absences
        if (durationSeconds > 5) {
            setTimeout(() => {
                alert(`ℹ️ Bạn đã quay lại tab thi.\n\n` +
                      `Thời gian rời khỏi: ${durationSeconds} giây\n\n` +
                      `Vi phạm này đã được ghi lại và sẽ được báo cáo cho giám thị.`);
            }, 500);
        }
    }

    // Public API
    window.ExamMonitoring = {
        // Enable monitoring for an exam
        enable: function(examId, examTitle, examEndTime) {
            currentExamId = examId;
            currentExamTitle = examTitle || 'Kỳ thi';
            currentExamEndTime = examEndTime; // Store exam end time

            // Save to localStorage
            localStorage.setItem(STORAGE_KEY_MONITORING, 'true');
            localStorage.setItem(STORAGE_KEY_EXAM_ID, examId);
            localStorage.setItem(STORAGE_KEY_EXAM_TITLE, currentExamTitle);
            if (examEndTime) {
                localStorage.setItem(STORAGE_KEY_EXAM_END_TIME, examEndTime);
            }

            startMonitoring();
        },

        // Disable monitoring
        disable: function() {
            stopMonitoring();
        },

        // Check if monitoring is active
        isActive: function() {
            return monitoringActive;
        },

        // Get current exam ID
        getCurrentExamId: function() {
            return currentExamId;
        }
    };

    // Initialize on page load
    init();

    console.log('[EXAM-MONITOR] Module loaded');
})();

