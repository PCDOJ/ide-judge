// Get exam ID from URL
const urlParams = new URLSearchParams(window.location.search);
const examId = urlParams.get('examId');

if (!examId) {
    window.location.href = '/admin/exams.html';
}

let currentExam = null;
let allProblems = [];

// Check authentication and load data
window.addEventListener('DOMContentLoaded', async () => {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated || data.user.role !== 'admin') {
            window.location.href = '/login.html';
            return;
        }
        
        await loadExamInfo();
        await loadProblems();
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

// Helper function: Convert UTC datetime from server to Vietnam time for display
function parseLocalDateTime(datetime) {
    // Input: "2025-10-19 01:00:00" (UTC from server)
    // Output: "19/10/2025 08:00:00" (Vietnam time, UTC+7)
    // Parse UTC string - browser will automatically convert to local timezone
    const utcDate = new Date(datetime + 'Z'); // Add 'Z' to indicate UTC
    return utcDate.toLocaleString('vi-VN');
}

// Load exam info
async function loadExamInfo() {
    try {
        const response = await fetch(`/api/admin/exams/${examId}`);
        const data = await response.json();

        if (data.success) {
            currentExam = data.exam;
            document.getElementById('examTitle').innerHTML = `<i class="bi bi-journal-text"></i> ${currentExam.title}`;
            // Convert UTC from server to Vietnam time for display
            const startTime = parseLocalDateTime(currentExam.start_time);
            const endTime = parseLocalDateTime(currentExam.end_time);
            document.getElementById('examInfo').textContent = `${startTime} - ${endTime}`;
        } else {
            showAlert('Không thể tải thông tin kỳ thi', 'danger');
            setTimeout(() => window.location.href = '/admin/exams.html', 2000);
        }
    } catch (error) {
        console.error('Load exam error:', error);
        showAlert('Lỗi khi tải thông tin kỳ thi', 'danger');
    }
}

// Load problems
async function loadProblems() {
    try {
        const response = await fetch(`/api/admin/exams/${examId}/problems`);
        const data = await response.json();
        
        if (data.success) {
            allProblems = data.problems;
            renderProblemsTable();
        } else {
            showAlert('Không thể tải danh sách bài thi', 'danger');
        }
    } catch (error) {
        console.error('Load problems error:', error);
        showAlert('Lỗi khi tải danh sách bài thi', 'danger');
    }
}

// Render problems table
function renderProblemsTable() {
    const tbody = document.getElementById('problemsTableBody');
    
    if (allProblems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Chưa có bài thi nào</td></tr>';
        return;
    }
    
    tbody.innerHTML = allProblems.map((problem, index) => `
        <tr>
            <td>${index + 1}</td>
            <td><strong>${problem.problem_code}</strong></td>
            <td>${problem.problem_title}</td>
            <td><span class="badge bg-success">${problem.points}</span></td>
            <td>
                <a href="/api/user/problems/${problem.id}/pdf" target="_blank" class="btn btn-sm btn-outline-info">
                    <i class="bi bi-file-pdf"></i> ${problem.pdf_filename}
                </a>
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal(${problem.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteProblem(${problem.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new problem
async function addProblem() {
    const code = document.getElementById('newProblemCode').value;
    const title = document.getElementById('newProblemTitle').value;
    const points = document.getElementById('newProblemPoints').value;
    const order = document.getElementById('newProblemOrder').value;
    const pdfFile = document.getElementById('newProblemPDF').files[0];
    
    if (!code || !title || !pdfFile) {
        showAlert('Vui lòng điền đầy đủ thông tin và chọn file PDF', 'warning');
        return;
    }
    
    if (pdfFile.type !== 'application/pdf') {
        showAlert('Chỉ chấp nhận file PDF', 'warning');
        return;
    }
    
    if (pdfFile.size > 10 * 1024 * 1024) {
        showAlert('File PDF không được vượt quá 10MB', 'warning');
        return;
    }
    
    const formData = new FormData();
    formData.append('problem_code', code);
    formData.append('problem_title', title);
    formData.append('points', points);
    formData.append('display_order', order);
    formData.append('pdf', pdfFile);
    
    try {
        const response = await fetch(`/api/admin/exams/${examId}/problems`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Thêm bài thi thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addProblemModal')).hide();
            document.getElementById('addProblemForm').reset();
            loadProblems();
        } else {
            showAlert(data.message || 'Không thể thêm bài thi', 'danger');
        }
    } catch (error) {
        console.error('Add problem error:', error);
        showAlert('Lỗi khi thêm bài thi', 'danger');
    }
}

// Open edit modal
async function openEditModal(problemId) {
    const problem = allProblems.find(p => p.id === problemId);
    
    if (!problem) {
        showAlert('Không tìm thấy bài thi', 'danger');
        return;
    }
    
    document.getElementById('editProblemId').value = problem.id;
    document.getElementById('editProblemCode').value = problem.problem_code;
    document.getElementById('editProblemTitle').value = problem.problem_title;
    document.getElementById('editProblemPoints').value = problem.points;
    document.getElementById('editProblemOrder').value = problem.display_order;
    
    new bootstrap.Modal(document.getElementById('editProblemModal')).show();
}

// Update problem
async function updateProblem() {
    const problemId = document.getElementById('editProblemId').value;
    const code = document.getElementById('editProblemCode').value;
    const title = document.getElementById('editProblemTitle').value;
    const points = document.getElementById('editProblemPoints').value;
    const order = document.getElementById('editProblemOrder').value;
    
    if (!code || !title) {
        showAlert('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/problems/${problemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                problem_code: code, 
                problem_title: title, 
                points: points, 
                display_order: order 
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Cập nhật bài thi thành công!', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editProblemModal')).hide();
            loadProblems();
        } else {
            showAlert(data.message || 'Không thể cập nhật bài thi', 'danger');
        }
    } catch (error) {
        console.error('Update problem error:', error);
        showAlert('Lỗi khi cập nhật bài thi', 'danger');
    }
}

// Delete problem
async function deleteProblem(problemId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài thi này? File PDF cũng sẽ bị xóa.')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/problems/${problemId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Xóa bài thi thành công!', 'success');
            loadProblems();
        } else {
            showAlert(data.message || 'Không thể xóa bài thi', 'danger');
        }
    } catch (error) {
        console.error('Delete problem error:', error);
        showAlert('Lỗi khi xóa bài thi', 'danger');
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

