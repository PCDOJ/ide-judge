// Get exam ID from URL
const urlParams = new URLSearchParams(window.location.search);
// Support both 'id' and 'examId' parameters for backward compatibility
const examId = urlParams.get('id') || urlParams.get('examId');

console.log('[ExamView] URL params:', { id: urlParams.get('id'), examId: urlParams.get('examId'), finalExamId: examId });

if (!examId) {
    console.error('[ExamView] No examId found in URL, redirecting to exams.html');
    window.location.href = '/exams.html';
}

let currentExam = null;
let currentUser = null;

// Check authentication and load data
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return;
        }
        
        currentUser = data.user;
        document.getElementById('navUsername').textContent = data.user.username;
        
        await loadExamDetails();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
});

// Logout handler
document.getElementById('logoutBtn')?.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        await fetch('/api/auth/logout', { method: 'POST' });
        window.location.href = '/login.html';
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Load exam details
async function loadExamDetails() {
    try {
        const response = await fetch(`/api/user/exams/${examId}`);
        const data = await response.json();

        if (data.success) {
            currentExam = data.exam;
            renderExamHeader();
            renderProblemsList();

            // Enable monitoring if exam has prevent_tab_switch enabled
            if (currentExam.prevent_tab_switch && window.ExamMonitoring) {
                console.log('[EXAM-VIEW] Enabling monitoring for exam:', currentExam.id);
                // Pass exam end time so monitoring can auto-stop when exam ends
                const endTime = currentExam.end_time ? (currentExam.end_time + 'Z') : null;
                window.ExamMonitoring.enable(currentExam.id, currentExam.title, endTime);
            }

            // Note: Notification listener is now handled globally by global-exam-notification.js
            // It will automatically connect when user is in an active exam
        } else {
            showAlert(data.message || 'Không thể tải thông tin kỳ thi', 'danger');
            setTimeout(() => window.location.href = '/exams.html', 2000);
        }
    } catch (error) {
        console.error('Load exam error:', error);
        showAlert('Lỗi khi tải thông tin kỳ thi', 'danger');
        setTimeout(() => window.location.href = '/exams.html', 2000);
    }
}

// Helper function: Convert UTC datetime from server to Vietnam time for display
function parseLocalDateTime(datetime) {
    // Input: "2025-10-19 01:00:00" (UTC from server)
    // Output: "19/10/2025 08:00:00" (Vietnam time, UTC+7)
    // Parse UTC string - browser will automatically convert to local timezone
    const utcDate = new Date(datetime + 'Z'); // Add 'Z' to indicate UTC
    return utcDate.toLocaleString('vi-VN');
}

// Render exam header
function renderExamHeader() {
    // Convert UTC from server to Vietnam time for display
    const startTime = parseLocalDateTime(currentExam.start_time);
    const endTime = parseLocalDateTime(currentExam.end_time);

    document.getElementById('examTitle').innerHTML = `<i class="bi bi-journal-text"></i> ${currentExam.title}`;
    document.getElementById('examTime').textContent = `${startTime} - ${endTime}`;
    document.getElementById('examDescription').textContent = currentExam.description || '';

    // Show leave button only if exam is ongoing
    if (currentExam.status === 'ongoing') {
        document.getElementById('leaveExamBtn').style.display = 'block';
    }
}

// Render problems list
function renderProblemsList() {
    const container = document.getElementById('problemsList');
    
    if (!currentExam.problems || currentExam.problems.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Chưa có bài thi nào</p></div>';
        return;
    }
    
    container.innerHTML = currentExam.problems.map((problem, index) => `
        <div class="col-md-6 col-lg-4">
            <div class="card problem-card">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="card-title mb-0">
                            <i class="bi bi-file-earmark-text"></i> ${problem.problem_code}
                        </h5>
                        <span class="badge bg-success">${problem.points} điểm</span>
                    </div>
                    <p class="card-text">${problem.problem_title}</p>
                    <small class="text-muted">Thứ tự: ${index + 1}</small>
                </div>
                <div class="card-footer bg-white">
                    <div class="d-grid gap-2">
                        <button class="btn btn-sm btn-primary" onclick="viewProblem(${problem.id}, '${problem.problem_title}')">
                            <i class="bi bi-eye"></i> Xem đề
                        </button>
                        ${currentExam.status === 'ongoing' ? `
                        <button class="btn btn-sm btn-success" onclick="codeProblem(${problem.id})">
                            <i class="bi bi-code-slash"></i> Code bài này
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `).join('');
}

// View problem PDF
function viewProblem(problemId, problemTitle) {
    document.getElementById('problemsListView').style.display = 'none';
    document.getElementById('pdfViewerView').style.display = 'block';
    document.getElementById('currentProblemTitle').textContent = problemTitle;
    
    // Load PDF
    const pdfViewer = document.getElementById('pdfViewer');
    pdfViewer.src = `/api/user/problems/${problemId}/pdf`;
}

// Back to problems list
function backToProblems() {
    document.getElementById('pdfViewerView').style.display = 'none';
    document.getElementById('problemsListView').style.display = 'block';
    document.getElementById('pdfViewer').src = '';
}

// Code problem - show IDE mode selection modal
let selectedProblemId = null;

function codeProblem(problemId) {
    selectedProblemId = problemId;
    const modal = new bootstrap.Modal(document.getElementById('ideModeModal'));
    modal.show();
}

// Select IDE mode and redirect
window.selectIdeMode = function(mode) {
    if (!selectedProblemId) return;

    // Close modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('ideModeModal'));
    if (modal) modal.hide();

    if (mode === 'judge0') {
        // Judge0 mode (single file)
        window.location.href = `/exam-code.html?examId=${examId}&problemId=${selectedProblemId}`;
    } else if (mode === 'workspace') {
        // Workspace mode (multi-file + terminal)
        // Get problem info
        const problem = currentExam.problems.find(p => p.id == selectedProblemId);
        if (problem) {
            window.location.href = `/workspace-demo.html?contestId=${examId}&problemId=${selectedProblemId}&problemCode=${problem.problem_code}`;
        }
    }
}

// Leave exam
async function leaveExam() {
    if (!confirm('Bạn có chắc chắn muốn rời khỏi kỳ thi? Bạn sẽ không thể tham gia lại và không thể xem đề nữa.')) {
        return;
    }

    try {
        const response = await fetch(`/api/user/exams/${examId}/leave`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            // Disable monitoring when leaving exam
            if (window.ExamMonitoring) {
                console.log('[EXAM-VIEW] Disabling monitoring - user left exam');
                window.ExamMonitoring.disable();
            }

            showAlert('Đã rời khỏi kỳ thi', 'success');
            setTimeout(() => window.location.href = '/exams.html', 1500);
        } else {
            showAlert(data.message || 'Không thể rời khỏi kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Leave exam error:', error);
        showAlert('Lỗi khi rời khỏi kỳ thi', 'danger');
    }
}

// Show alert
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    alertContainer.appendChild(alert);
    
    setTimeout(() => {
        alert.remove();
    }, 5000);
}

// Open notifications list modal
let notificationsListModal = null;
async function openNotificationsListModal() {
    if (!currentExam) {
        showAlert('Chưa tải thông tin kỳ thi', 'warning');
        return;
    }

    // Initialize modal if not already
    if (!notificationsListModal) {
        const modalElement = document.getElementById('notificationsListModal');
        notificationsListModal = new bootstrap.Modal(modalElement);
    }

    // Show modal
    notificationsListModal.show();

    // Load notifications
    await loadNotificationsList();
}

// Load notifications list
async function loadNotificationsList() {
    const container = document.getElementById('notificationsListContainer');

    try {
        container.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;

        const response = await fetch(`/api/notifications/exams/${currentExam.id}/active`);
        const data = await response.json();

        if (data.success) {
            if (data.notifications.length === 0) {
                container.innerHTML = `
                    <div class="alert alert-info">
                        <i class="bi bi-info-circle"></i> Chưa có thông báo nào
                    </div>
                `;
                return;
            }

            // Render notifications list
            let html = '<div class="list-group">';
            data.notifications.forEach(notification => {
                // Parse message (format: **Title**\n\nContent)
                let title = 'Thông báo';
                let content = notification.message;

                const titleMatch = notification.message.match(/^\*\*(.+?)\*\*\n\n([\s\S]+)$/);
                if (titleMatch) {
                    title = titleMatch[1];
                    content = titleMatch[2];
                }

                const time = new Date(notification.created_at).toLocaleString('vi-VN');

                html += `
                    <div class="list-group-item">
                        <div class="d-flex w-100 justify-content-between">
                            <h6 class="mb-1"><i class="bi bi-megaphone"></i> ${title}</h6>
                            <small class="text-muted">${time}</small>
                        </div>
                        <p class="mb-1">${content.replace(/\n/g, '<br>')}</p>
                        <small class="text-muted">Từ: ${notification.creator_name}</small>
                    </div>
                `;
            });
            html += '</div>';

            container.innerHTML = html;
        } else {
            container.innerHTML = `
                <div class="alert alert-danger">
                    <i class="bi bi-exclamation-triangle"></i> ${data.message || 'Không thể tải thông báo'}
                </div>
            `;
        }
    } catch (error) {
        console.error('Load notifications error:', error);
        container.innerHTML = `
            <div class="alert alert-danger">
                <i class="bi bi-exclamation-triangle"></i> Lỗi kết nối server
            </div>
        `;
    }
}

