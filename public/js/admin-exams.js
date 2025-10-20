// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();

        if (!data.authenticated || data.user.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }

        loadExams();

        // Setup access code checkbox handlers
        setupAccessCodeHandlers();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
});

// Setup access code checkbox handlers
function setupAccessCodeHandlers() {
    // New exam form
    const newCheckbox = document.getElementById('newExamHasAccessCode');
    const newGroup = document.getElementById('newAccessCodeGroup');

    newCheckbox.addEventListener('change', () => {
        newGroup.style.display = newCheckbox.checked ? 'block' : 'none';
        if (!newCheckbox.checked) {
            document.getElementById('newExamAccessCode').value = '';
        }
    });

    // Edit exam form
    const editCheckbox = document.getElementById('editExamHasAccessCode');
    const editGroup = document.getElementById('editAccessCodeGroup');

    editCheckbox.addEventListener('change', () => {
        editGroup.style.display = editCheckbox.checked ? 'block' : 'none';
        if (!editCheckbox.checked) {
            document.getElementById('editExamAccessCode').value = '';
        }
    });
}

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

let allExams = [];

// Load all exams
async function loadExams() {
    try {
        const response = await fetch('/api/admin/exams');
        const data = await response.json();
        
        if (data.success) {
            allExams = data.exams;
            renderExamsTable();
        } else {
            showAlert('Không thể tải danh sách kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Load exams error:', error);
        showAlert('Lỗi khi tải danh sách kỳ thi', 'danger');
    }
}

// Render exams table
function renderExamsTable() {
    const tbody = document.getElementById('examsTableBody');
    
    if (allExams.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">Chưa có kỳ thi nào</td></tr>';
        return;
    }
    
    tbody.innerHTML = allExams.map(exam => {
        const statusBadge = getStatusBadge(exam.status);
        // Parse as local time, not UTC
        const startTime = parseLocalDateTime(exam.start_time);
        const endTime = parseLocalDateTime(exam.end_time);
        
        return `
            <tr>
                <td>${exam.id}</td>
                <td>
                    <strong>${exam.title}</strong>
                    ${exam.description ? `<br><small class="text-muted">${exam.description.substring(0, 50)}...</small>` : ''}
                </td>
                <td>
                    <small>
                        <i class="bi bi-calendar-event"></i> ${startTime}<br>
                        <i class="bi bi-calendar-check"></i> ${endTime}
                    </small>
                </td>
                <td>${statusBadge}</td>
                <td><span class="badge bg-primary">${exam.problem_count || 0}</span></td>
                <td><span class="badge bg-info">${exam.registration_count || 0}</span></td>
                <td>${exam.access_code ? '<i class="bi bi-lock-fill text-warning"></i>' : '<i class="bi bi-unlock text-muted"></i>'}</td>
                <td>
                    <button class="btn btn-sm btn-success" onclick="window.location.href='/admin/exam-problems.html?examId=${exam.id}'">
                        <i class="bi bi-file-earmark-text"></i> Bài thi
                    </button>
                    <button class="btn btn-sm btn-info" onclick="viewRegistrations(${exam.id}, '${exam.title}')">
                        <i class="bi bi-people"></i> Đăng ký
                    </button>
                    <button class="btn btn-sm btn-warning" onclick="window.location.href='/admin/exam-submissions.html?id=${exam.id}'">
                        <i class="bi bi-code-square"></i> Bài làm
                    </button>
                    ${exam.prevent_tab_switch ? `
                    <button class="btn btn-sm btn-danger" onclick="window.location.href='/admin/exam-violations.html?id=${exam.id}'" title="Xem vi phạm thoát tab">
                        <i class="bi bi-shield-exclamation"></i> Vi phạm
                    </button>
                    ` : ''}
                    <button class="btn btn-sm btn-outline-primary" onclick="openEditModal(${exam.id})">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteExam(${exam.id})">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status badge
function getStatusBadge(status) {
    const badges = {
        'upcoming': '<span class="badge bg-info status-badge">Sắp diễn ra</span>',
        'ongoing': '<span class="badge bg-success status-badge">Đang diễn ra</span>',
        'ended': '<span class="badge bg-secondary status-badge">Đã kết thúc</span>'
    };
    return badges[status] || '';
}

// Add new exam
async function addExam() {
    const title = document.getElementById('newExamTitle').value;
    const description = document.getElementById('newExamDescription').value;
    const start_time = document.getElementById('newExamStartTime').value;
    const end_time = document.getElementById('newExamEndTime').value;
    const has_access_code = document.getElementById('newExamHasAccessCode').checked;
    const access_code = document.getElementById('newExamAccessCode').value;
    const prevent_tab_switch = document.getElementById('newExamPreventTabSwitch').checked;

    if (!title || !start_time || !end_time) {
        showAlert('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
        return;
    }

    if (has_access_code && !access_code) {
        showAlert('Vui lòng nhập access code', 'warning');
        return;
    }

    // Input is Vietnam time (UTC+7), send as-is to server
    // Server will handle conversion to UTC
    const startTimeFormatted = start_time.replace('T', ' ') + ':00';
    const endTimeFormatted = end_time.replace('T', ' ') + ':00';

    try {
        const response = await fetch('/api/admin/exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                start_time: startTimeFormatted,
                end_time: endTimeFormatted,
                has_access_code,
                access_code: has_access_code ? access_code : null,
                prevent_tab_switch
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Tạo kỳ thi thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addExamModal')).hide();
            document.getElementById('addExamForm').reset();
            // Reset checkboxes and hide access code group
            document.getElementById('newExamHasAccessCode').checked = false;
            document.getElementById('newExamPreventTabSwitch').checked = false;
            document.getElementById('newAccessCodeGroup').style.display = 'none';
            loadExams();
        } else {
            showAlert(data.message || 'Không thể tạo kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Add exam error:', error);
        showAlert('Lỗi khi tạo kỳ thi', 'danger');
    }
}

// Open edit modal
async function openEditModal(examId) {
    try {
        const response = await fetch(`/api/admin/exams/${examId}`);
        const data = await response.json();

        if (data.success) {
            const exam = data.exam;
            document.getElementById('editExamId').value = exam.id;
            document.getElementById('editExamTitle').value = exam.title;
            document.getElementById('editExamDescription').value = exam.description || '';
            document.getElementById('editExamStartTime').value = formatDateTimeLocal(exam.start_time);
            document.getElementById('editExamEndTime').value = formatDateTimeLocal(exam.end_time);

            // Set has_access_code checkbox and access code field
            const hasAccessCode = exam.has_access_code || false;
            document.getElementById('editExamHasAccessCode').checked = hasAccessCode;
            document.getElementById('editAccessCodeGroup').style.display = hasAccessCode ? 'block' : 'none';
            document.getElementById('editExamAccessCode').value = exam.access_code || '';

            // Set prevent_tab_switch checkbox
            document.getElementById('editExamPreventTabSwitch').checked = exam.prevent_tab_switch || false;

            new bootstrap.Modal(document.getElementById('editExamModal')).show();
        } else {
            showAlert('Không thể tải thông tin kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Load exam error:', error);
        showAlert('Lỗi khi tải thông tin kỳ thi', 'danger');
    }
}

// Update exam
async function updateExam() {
    const examId = document.getElementById('editExamId').value;
    const title = document.getElementById('editExamTitle').value;
    const description = document.getElementById('editExamDescription').value;
    const start_time = document.getElementById('editExamStartTime').value;
    const end_time = document.getElementById('editExamEndTime').value;
    const has_access_code = document.getElementById('editExamHasAccessCode').checked;
    const access_code = document.getElementById('editExamAccessCode').value;
    const prevent_tab_switch = document.getElementById('editExamPreventTabSwitch').checked;

    if (!title || !start_time || !end_time) {
        showAlert('Vui lòng điền đầy đủ thông tin bắt buộc', 'warning');
        return;
    }

    if (has_access_code && !access_code) {
        showAlert('Vui lòng nhập access code', 'warning');
        return;
    }

    // Convert datetime-local format to MySQL datetime format
    const startTimeFormatted = start_time.replace('T', ' ') + ':00';
    const endTimeFormatted = end_time.replace('T', ' ') + ':00';

    try {
        const response = await fetch(`/api/admin/exams/${examId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                title,
                description,
                start_time: startTimeFormatted,
                end_time: endTimeFormatted,
                has_access_code,
                access_code: has_access_code ? access_code : null,
                prevent_tab_switch
            })
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Cập nhật kỳ thi thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editExamModal')).hide();
            loadExams();
        } else {
            showAlert(data.message || 'Không thể cập nhật kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Update exam error:', error);
        showAlert('Lỗi khi cập nhật kỳ thi', 'danger');
    }
}

// Delete exam
async function deleteExam(examId) {
    if (!confirm('Bạn có chắc chắn muốn xóa kỳ thi này? Tất cả bài thi và đăng ký sẽ bị xóa.')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/exams/${examId}`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Xóa kỳ thi thành công!', 'success');
            loadExams();
        } else {
            showAlert(data.message || 'Không thể xóa kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Delete exam error:', error);
        showAlert('Lỗi khi xóa kỳ thi', 'danger');
    }
}

// View registrations for an exam
async function viewRegistrations(examId, examTitle) {
    try {
        document.getElementById('registrationsExamTitle').textContent = examTitle;
        const modal = new bootstrap.Modal(document.getElementById('registrationsModal'));
        modal.show();

        // Load registrations
        const response = await fetch(`/api/admin/exams/${examId}/registrations`);
        const data = await response.json();

        if (data.success) {
            renderRegistrationsTable(data.registrations);
        } else {
            document.getElementById('registrationsTableBody').innerHTML =
                '<tr><td colspan="5" class="text-center text-danger">Không thể tải danh sách đăng ký</td></tr>';
        }
    } catch (error) {
        console.error('Load registrations error:', error);
        document.getElementById('registrationsTableBody').innerHTML =
            '<tr><td colspan="5" class="text-center text-danger">Lỗi khi tải danh sách đăng ký</td></tr>';
    }
}

// Render registrations table
function renderRegistrationsTable(registrations) {
    const tbody = document.getElementById('registrationsTableBody');

    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center">Chưa có đăng ký nào</td></tr>';
        return;
    }

    tbody.innerHTML = registrations.map(reg => {
        let statusBadge = '';
        let timeInfo = '';

        if (reg.registration_type === 'pre_registered') {
            statusBadge = '<span class="badge bg-info">Đã đăng ký</span>';
            timeInfo = `Đăng ký: ${new Date(reg.created_at).toLocaleString('vi-VN')}`;
        } else if (reg.registration_type === 'joined') {
            statusBadge = '<span class="badge bg-success">Đã tham gia</span>';
            timeInfo = `Tham gia: ${new Date(reg.joined_at).toLocaleString('vi-VN')}`;
        } else if (reg.registration_type === 'left') {
            statusBadge = '<span class="badge bg-danger">Đã rời khỏi</span>';
            timeInfo = `Rời: ${new Date(reg.left_at).toLocaleString('vi-VN')}`;
        }

        return `
            <tr>
                <td>${reg.username}</td>
                <td>${reg.fullname}</td>
                <td>${reg.email}</td>
                <td>${statusBadge}</td>
                <td><small>${timeInfo}</small></td>
            </tr>
        `;
    }).join('');
}

// Convert UTC datetime from server to Vietnam time for display
function parseLocalDateTime(datetime) {
    // Input: "2025-10-19 01:00:00" (UTC from server)
    // Output: "19/10/2025 08:00:00" (Vietnam time, UTC+7)
    // Parse UTC string - browser will automatically convert to local timezone
    const utcDate = new Date(datetime + 'Z'); // Add 'Z' to indicate UTC
    return utcDate.toLocaleString('vi-VN');
}

// Convert UTC datetime from server to Vietnam time for datetime-local input
function formatDateTimeLocal(datetime) {
    // Input: "2025-10-19 01:00:00" (UTC from server)
    // Output: "2025-10-19T08:00" (Vietnam time for input field)
    // Parse UTC string - browser will automatically convert to local timezone
    const utcDate = new Date(datetime + 'Z'); // Add 'Z' to indicate UTC

    // Format for datetime-local input (YYYY-MM-DDTHH:mm)
    const year = utcDate.getFullYear();
    const month = String(utcDate.getMonth() + 1).padStart(2, '0');
    const day = String(utcDate.getDate()).padStart(2, '0');
    const hours = String(utcDate.getHours()).padStart(2, '0');
    const minutes = String(utcDate.getMinutes()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}`;
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

