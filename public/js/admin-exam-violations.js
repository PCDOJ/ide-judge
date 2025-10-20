// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();

        if (!data.authenticated || data.user.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }

        loadStudents();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
});

let allStudents = [];
let examData = null;
const examId = new URLSearchParams(window.location.search).get('id');
let currentStudentId = null;
let violationsModal = null;
let autoRefreshInterval = null;

// Load students data
async function loadStudents() {
    try {
        const response = await fetch(`/api/admin/exams/${examId}/students`);
        const data = await response.json();

        if (data.success) {
            examData = data.exam;
            allStudents = data.students;

            // Update exam title
            document.getElementById('examTitle').textContent = examData.title;

            // Update statistics
            updateStatistics(data.stats);

            // Render students list
            renderStudents();
        } else {
            alert('Lỗi: ' + data.message);
            window.history.back();
        }
    } catch (error) {
        console.error('Error loading students:', error);
        alert('Lỗi khi tải dữ liệu thí sinh');
        window.history.back();
    }
}

// Update statistics cards
function updateStatistics(stats) {
    document.getElementById('totalViolations').textContent = stats.totalViolations || 0;
    document.getElementById('uniqueStudents').textContent = `${stats.studentsWithViolations || 0} / ${stats.totalStudents || 0}`;

    // Format total duration - FIX: Hiển thị đúng giờ:phút:giây
    const totalSeconds = parseInt(stats.totalDuration) || 0;
    console.log('[DEBUG] Total duration:', stats.totalDuration, '→', totalSeconds, 'seconds');
    document.getElementById('totalDuration').textContent = formatDurationFull(totalSeconds);
}

// Convert UTC datetime from server to Vietnam time (UTC+7) for display
function parseLocalDateTime(datetime) {
    if (!datetime) return null;
    // Input: "2025-10-20 07:34:36" (UTC from MySQL server)
    // Output: "20/10/2025 14:34:36" (Vietnam time, UTC+7)
    // Add 'Z' to indicate this is UTC time, browser will auto-convert to local timezone
    const utcDate = new Date(datetime + 'Z');
    return utcDate.toLocaleString('vi-VN');
}

// Format duration to full format (hours:minutes:seconds)
function formatDurationFull(seconds) {
    if (!seconds || seconds === 0) return '0s';

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    let parts = [];
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

    return parts.join(' ');
}

// Render students list
function renderStudents() {
    const studentFilter = document.getElementById('studentFilter').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;

    let filtered = allStudents.filter(s => {
        const matchSearch = !studentFilter ||
            s.fullname.toLowerCase().includes(studentFilter) ||
            s.email.toLowerCase().includes(studentFilter);

        let matchStatus = true;
        if (statusFilter === 'violations') {
            matchStatus = s.violation_count > 0;
        } else if (statusFilter === 'clean') {
            matchStatus = s.violation_count === 0;
        }

        return matchSearch && matchStatus;
    });

    const container = document.getElementById('studentsContainer');

    if (filtered.length === 0) {
        container.innerHTML = '<div class="text-center text-muted py-4">Không tìm thấy thí sinh nào</div>';
        return;
    }

    container.innerHTML = filtered.map(student => {
        const hasViolations = student.violation_count > 0;
        const cardClass = hasViolations ? 'has-violations' : 'no-violations';
        const statusBadge = hasViolations
            ? `<span class="badge bg-danger">${student.violation_count} vi phạm</span>`
            : `<span class="badge bg-success">Không vi phạm</span>`;

        const durationText = student.total_duration_seconds
            ? formatDurationFull(student.total_duration_seconds)
            : '-';

        // Convert UTC from server to Vietnam time (UTC+7)
        const lastViolation = student.last_violation_at
            ? parseLocalDateTime(student.last_violation_at)
            : '-';

        return `
            <div class="student-card ${cardClass} p-3">
                <div class="row align-items-center">
                    <div class="col-md-4">
                        <h6 class="mb-1"><i class="bi bi-person-circle"></i> ${student.fullname}</h6>
                        <small class="text-muted">${student.email}</small>
                    </div>
                    <div class="col-md-2 text-center">
                        ${statusBadge}
                    </div>
                    <div class="col-md-2 text-center">
                        <small class="text-muted d-block">Tổng thời gian</small>
                        <strong>${durationText}</strong>
                    </div>
                    <div class="col-md-2 text-center">
                        <small class="text-muted d-block">Vi phạm gần nhất</small>
                        <small>${lastViolation}</small>
                    </div>
                    <div class="col-md-2 text-end">
                        ${hasViolations ? `
                            <button class="btn btn-sm btn-outline-danger" onclick="showViolationDetails(${student.id})">
                                <i class="bi bi-eye"></i> Chi tiết
                            </button>
                        ` : `
                            <span class="text-success"><i class="bi bi-check-circle-fill"></i></span>
                        `}
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show violation details modal
async function showViolationDetails(userId) {
    currentStudentId = userId;

    // Initialize modal if not already done
    if (!violationsModal) {
        violationsModal = new bootstrap.Modal(document.getElementById('violationsModal'));
    }

    // Show modal
    violationsModal.show();

    // Load violations
    await loadStudentViolations(userId);

    // Start auto-refresh (every 5 seconds)
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
    }
    autoRefreshInterval = setInterval(() => {
        if (currentStudentId) {
            loadStudentViolations(currentStudentId, true);
        }
    }, 5000);

    // Stop auto-refresh when modal is closed
    document.getElementById('violationsModal').addEventListener('hidden.bs.modal', () => {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            autoRefreshInterval = null;
        }
        currentStudentId = null;
    });
}

// Load violations for a specific student
async function loadStudentViolations(userId, isRefresh = false) {
    try {
        if (!isRefresh) {
            document.getElementById('modalViolationsTableBody').innerHTML = `
                <tr><td colspan="5" class="text-center">
                    <div class="spinner-border spinner-border-sm" role="status"></div>
                </td></tr>
            `;
        }

        const response = await fetch(`/api/admin/exams/${examId}/students/${userId}/violations`);
        const data = await response.json();

        if (data.success) {
            // Update student info
            document.getElementById('modalStudentName').textContent = data.student.fullname;
            document.getElementById('modalStudentEmail').textContent = data.student.email;

            // Update stats
            document.getElementById('modalTotalViolations').textContent = data.stats.totalViolations;
            document.getElementById('modalTotalDuration').textContent = formatDurationFull(data.stats.totalDuration);

            // Update last update time
            const now = new Date();
            document.getElementById('lastUpdateTime').textContent = now.toLocaleTimeString('vi-VN');

            // Animate refresh icon
            const icon = document.getElementById('autoRefreshIcon');
            icon.style.animation = 'none';
            setTimeout(() => {
                icon.style.animation = 'spin 0.5s linear';
            }, 10);

            // Render violations table
            renderModalViolations(data.violations);
        }
    } catch (error) {
        console.error('Error loading student violations:', error);
    }
}

// Render violations in modal
function renderModalViolations(violations) {
    const tbody = document.getElementById('modalViolationsTableBody');

    if (violations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Không có vi phạm nào</td></tr>';
        return;
    }

    tbody.innerHTML = violations.map(v => {
        // Convert UTC from server to Vietnam time (UTC+7)
        const leftAt = parseLocalDateTime(v.left_at);
        const returnedAt = v.returned_at
            ? parseLocalDateTime(v.returned_at)
            : '<span class="badge bg-danger">Chưa quay lại</span>';
        const duration = formatDuration(v.duration_seconds);
        const violationType = getViolationTypeBadge(v.violation_type);
        const problemInfo = v.problem_code
            ? `${v.problem_code} - ${v.problem_title}`
            : '<span class="text-muted">N/A</span>';

        return `
            <tr>
                <td><small>${leftAt}</small></td>
                <td><small>${returnedAt}</small></td>
                <td><strong>${duration}</strong></td>
                <td><small>${problemInfo}</small></td>
                <td>${violationType}</td>
            </tr>
        `;
    }).join('');
}

// Format duration in seconds to readable format with color
function formatDuration(seconds) {
    if (!seconds || seconds === 0) {
        return '<span class="text-muted">-</span>';
    }

    const durationText = formatDurationFull(seconds);

    // Color code based on duration
    if (seconds > 300) { // > 5 minutes
        return `<span class="text-danger">${durationText}</span>`;
    } else if (seconds > 60) { // > 1 minute
        return `<span class="text-warning">${durationText}</span>`;
    } else {
        return `<span class="text-info">${durationText}</span>`;
    }
}

// Get violation type badge
function getViolationTypeBadge(type) {
    const badges = {
        'tab_hidden': '<span class="badge bg-warning" title="Chuyển sang tab khác"><i class="bi bi-window"></i> Tab ẩn</span>',
        'window_blur': '<span class="badge bg-info" title="Click ra ngoài cửa sổ"><i class="bi bi-cursor"></i> Mất focus</span>',
        'page_unload': '<span class="badge bg-danger" title="Cố gắng đóng/rời trang"><i class="bi bi-x-circle"></i> Thoát trang</span>',
        'mouse_leave': '<span class="badge bg-secondary" title="Di chuyển chuột ra ngoài"><i class="bi bi-mouse"></i> Chuột rời</span>',
        'keyboard_shortcut': '<span class="badge bg-danger" title="Sử dụng phím tắt chuyển tab"><i class="bi bi-keyboard"></i> Phím tắt</span>',
        'devtools_attempt': '<span class="badge bg-danger" title="Cố gắng mở Developer Tools"><i class="bi bi-code-slash"></i> DevTools</span>',
        'close_attempt': '<span class="badge bg-danger" title="Cố gắng đóng tab"><i class="bi bi-x-lg"></i> Đóng tab</span>',
        'exit_fullscreen': '<span class="badge bg-warning" title="Thoát chế độ toàn màn hình"><i class="bi bi-fullscreen-exit"></i> Thoát fullscreen</span>',
        'focus_lost': '<span class="badge bg-info" title="Mất focus của cửa sổ"><i class="bi bi-eye-slash"></i> Mất focus</span>'
    };
    return badges[type] || `<span class="badge bg-secondary">${type}</span>`;
}

// Reset all filters
function resetFilters() {
    document.getElementById('studentFilter').value = '';
    document.getElementById('statusFilter').value = 'all';
    renderStudents();
}

// Add CSS animation for refresh icon
const style = document.createElement('style');
style.textContent = `
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
`;
document.head.appendChild(style);

