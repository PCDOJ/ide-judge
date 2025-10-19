// Check authentication on page load
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated) {
            window.location.href = '/login.html';
            return;
        }
        
        // Show admin panel link if admin
        if (data.user.role === 'admin') {
            document.getElementById('adminPanelLink').style.display = 'block';
        }
        
        // Display username
        document.getElementById('navUsername').textContent = data.user.username;
        
        loadExams();
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

let allExams = null;
let currentView = 'all'; // 'all' or 'registered'

// Load all exams
async function loadExams() {
    try {
        const response = await fetch('/api/user/exams');
        const data = await response.json();

        if (data.success) {
            allExams = data.exams;

            // Load participants for each exam
            await loadParticipantsForExams();

            renderExams();
        } else {
            showAlert('Không thể tải danh sách kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Load exams error:', error);
        showAlert('Lỗi khi tải danh sách kỳ thi', 'danger');
    }
}

// Load participants for all exams
async function loadParticipantsForExams() {
    const allExamsList = [
        ...allExams.upcoming,
        ...allExams.ongoing,
        ...allExams.ended
    ];

    // Fetch participants for each exam
    const participantsPromises = allExamsList.map(async (exam) => {
        try {
            const response = await fetch(`/api/user/exams/${exam.id}/participants`);
            const data = await response.json();
            if (data.success) {
                exam.participants = data.participants;
            }
        } catch (error) {
            console.error(`Error loading participants for exam ${exam.id}:`, error);
            exam.participants = [];
        }
    });

    await Promise.all(participantsPromises);
}

// Toggle between all exams and registered exams view
function toggleView() {
    if (currentView === 'all') {
        showRegisteredExams();
    } else {
        showAllExams();
    }
}

// Show all exams view
function showAllExams() {
    currentView = 'all';
    document.getElementById('allExamsView').style.display = 'block';
    document.getElementById('registeredExamsView').style.display = 'none';
    document.getElementById('pageTitle').innerHTML = '<i class="bi bi-journal-text"></i> Danh sách Kỳ thi';
    document.getElementById('toggleViewBtn').innerHTML = '<i class="bi bi-bookmark-check"></i> Xem kỳ thi đã đăng ký';
}

// Show registered exams view
function showRegisteredExams() {
    currentView = 'registered';
    document.getElementById('allExamsView').style.display = 'none';
    document.getElementById('registeredExamsView').style.display = 'block';
    document.getElementById('pageTitle').innerHTML = '<i class="bi bi-bookmark-check"></i> Kỳ thi đã đăng ký';
    document.getElementById('toggleViewBtn').innerHTML = '<i class="bi bi-journal-text"></i> Xem tất cả kỳ thi';
    renderRegisteredExams();
}

// Render registered exams
function renderRegisteredExams() {
    const container = document.getElementById('registeredExamsList');

    // Collect all registered exams (pre_registered or joined)
    const registered = [];

    if (allExams) {
        // From upcoming exams
        allExams.upcoming.forEach(exam => {
            if (exam.registration_type === 'pre_registered') {
                registered.push({ ...exam, status: 'upcoming' });
            }
        });

        // From ongoing exams
        allExams.ongoing.forEach(exam => {
            if (exam.registration_type === 'joined') {
                registered.push({ ...exam, status: 'ongoing' });
            }
        });

        // From ended exams (if joined)
        allExams.ended.forEach(exam => {
            if (exam.registration_type === 'joined') {
                registered.push({ ...exam, status: 'ended' });
            }
        });
    }

    if (registered.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Bạn chưa đăng ký kỳ thi nào</p></div>';
        return;
    }

    container.innerHTML = registered.map(exam => createExamCard(exam, exam.status)).join('');
}

// Render exams
function renderExams() {
    renderExamCategory('upcomingExams', allExams.upcoming, 'upcoming');
    renderExamCategory('ongoingExams', allExams.ongoing, 'ongoing');
    renderExamCategory('endedExams', allExams.ended, 'ended');
}

// Helper function: Convert UTC datetime from server to Vietnam time for display
function parseLocalDateTime(datetime) {
    // Input: "2025-10-19 01:00:00" (UTC from server)
    // Output: "19/10/2025 08:00:00" (Vietnam time, UTC+7)
    // Parse UTC string - browser will automatically convert to local timezone
    const utcDate = new Date(datetime + 'Z'); // Add 'Z' to indicate UTC
    return utcDate.toLocaleString('vi-VN');
}

// Render exam category
function renderExamCategory(containerId, exams, status) {
    const container = document.getElementById(containerId);

    if (exams.length === 0) {
        container.innerHTML = '<div class="col-12"><p class="text-muted">Không có kỳ thi nào</p></div>';
        return;
    }

    container.innerHTML = exams.map(exam => createExamCard(exam, status)).join('');
}

// Create exam card
function createExamCard(exam, status) {
    // Convert UTC from server to Vietnam time for display
    const startTime = parseLocalDateTime(exam.start_time);
    const endTime = parseLocalDateTime(exam.end_time);
    const hasAccessCode = exam.has_access_code ? '<i class="bi bi-lock-fill text-warning"></i>' : '';
    
    let actionButton = '';
    let registrationBadge = '';
    
    if (status === 'upcoming') {
        if (exam.registration_type === 'pre_registered') {
            registrationBadge = '<span class="badge bg-success">Đã đăng ký</span>';
            actionButton = `
                <button class="btn btn-danger btn-sm" onclick="unregisterExam(${exam.id})">
                    <i class="bi bi-x-circle"></i> Huỷ đăng ký
                </button>
            `;
        } else {
            actionButton = `<button class="btn btn-primary" onclick="preRegister(${exam.id})">
                <i class="bi bi-calendar-check"></i> Đăng ký
            </button>`;
        }
    } else if (status === 'ongoing') {
        if (exam.registration_type === 'joined') {
            registrationBadge = '<span class="badge bg-success">Đang tham gia</span>';
            actionButton = `<button class="btn btn-success" onclick="window.location.href='/exam-view.html?examId=${exam.id}'">
                <i class="bi bi-box-arrow-in-right"></i> Vào thi
            </button>`;
        } else if (exam.registration_type === 'left') {
            registrationBadge = '<span class="badge bg-warning">Đã rời khỏi</span>';
            actionButton = `<button class="btn btn-primary" onclick="joinExam(${exam.id}, ${exam.has_access_code})">
                <i class="bi bi-play-circle"></i> Tham gia lại
            </button>`;
        } else {
            actionButton = `<button class="btn btn-primary" onclick="joinExam(${exam.id}, ${exam.has_access_code})">
                <i class="bi bi-play-circle"></i> Tham gia
            </button>`;
        }
    } else if (status === 'ended') {
        actionButton = `<button class="btn btn-outline-secondary" onclick="window.location.href='/exam-view.html?examId=${exam.id}'">
            <i class="bi bi-eye"></i> Xem đề
        </button>`;
    }
    
    // Participants section
    let participantsSection = '';
    if (exam.participants && exam.participants.length > 0) {
        const participantsList = exam.participants.map(p => p.fullname).join(', ');
        const displayList = exam.participants.length > 3
            ? exam.participants.slice(0, 3).map(p => p.fullname).join(', ') + ` và ${exam.participants.length - 3} người khác`
            : participantsList;

        participantsSection = `
            <div class="mt-2 pt-2 border-top">
                <p class="mb-1"><small><i class="bi bi-people"></i> Người tham gia (${exam.participants.length}):</small></p>
                <p class="mb-0"><small class="text-muted" title="${participantsList}">${displayList}</small></p>
            </div>
        `;
    }

    return `
        <div class="col-md-6 col-lg-4">
            <div class="card exam-card">
                <div class="card-header status-${status} text-white">
                    <h5 class="mb-0">${exam.title} ${hasAccessCode}</h5>
                </div>
                <div class="card-body">
                    ${exam.description ? `<p class="card-text">${exam.description}</p>` : ''}
                    <p class="mb-1"><small><i class="bi bi-calendar-event"></i> Bắt đầu: ${startTime}</small></p>
                    <p class="mb-2"><small><i class="bi bi-calendar-check"></i> Kết thúc: ${endTime}</small></p>
                    <p class="mb-2"><i class="bi bi-file-earmark-text"></i> Số bài: <strong>${exam.problem_count}</strong></p>
                    ${registrationBadge}
                    ${participantsSection}
                </div>
                <div class="card-footer bg-white">
                    ${actionButton}
                </div>
            </div>
        </div>
    `;
}

// Pre-register for upcoming exam
async function preRegister(examId) {
    try {
        const response = await fetch(`/api/user/exams/${examId}/pre-register`, {
            method: 'POST'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Đăng ký thành công! Bạn sẽ tự động tham gia khi kỳ thi bắt đầu.', 'success');
            loadExams();
        } else {
            showAlert(data.message || 'Không thể đăng ký', 'danger');
        }
    } catch (error) {
        console.error('Pre-register error:', error);
        showAlert('Lỗi khi đăng ký', 'danger');
    }
}

// Unregister from upcoming exam
async function unregisterExam(examId) {
    if (!confirm('Bạn có chắc chắn muốn huỷ đăng ký kỳ thi này?')) {
        return;
    }

    try {
        const response = await fetch(`/api/user/exams/${examId}/unregister`, {
            method: 'DELETE'
        });

        const data = await response.json();

        if (data.success) {
            showAlert('Huỷ đăng ký thành công!', 'success');
            loadExams();
        } else {
            showAlert(data.message || 'Không thể huỷ đăng ký', 'danger');
        }
    } catch (error) {
        console.error('Unregister error:', error);
        showAlert('Lỗi khi huỷ đăng ký', 'danger');
    }
}

// Join ongoing exam
async function joinExam(examId, hasAccessCode) {
    if (hasAccessCode) {
        // Show access code modal
        document.getElementById('accessCodeExamId').value = examId;
        document.getElementById('accessCodeInput').value = '';
        new bootstrap.Modal(document.getElementById('accessCodeModal')).show();
    } else {
        // Join directly
        await submitJoinExam(examId, null);
    }
}

// Submit access code and join
async function submitAccessCode() {
    const examId = document.getElementById('accessCodeExamId').value;
    const accessCode = document.getElementById('accessCodeInput').value;
    
    if (!accessCode) {
        showAlert('Vui lòng nhập access code', 'warning');
        return;
    }
    
    await submitJoinExam(examId, accessCode);
}

// Submit join exam request
async function submitJoinExam(examId, accessCode) {
    try {
        const response = await fetch(`/api/user/exams/${examId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ access_code: accessCode })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Tham gia kỳ thi thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('accessCodeModal'))?.hide();
            loadExams();
            // Redirect to exam view
            setTimeout(() => {
                window.location.href = `/exam-view.html?examId=${examId}`;
            }, 1000);
        } else {
            showAlert(data.message || 'Không thể tham gia kỳ thi', 'danger');
        }
    } catch (error) {
        console.error('Join exam error:', error);
        showAlert('Lỗi khi tham gia kỳ thi', 'danger');
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

