let currentUsers = [];

// Check admin authentication
async function checkAdminAuth() {
    try {
        const response = await fetch('/api/auth/check-session');
        const data = await response.json();
        
        if (!data.authenticated || data.user.role !== 'admin') {
            window.location.href = '/index.html';
            return;
        }
        
        loadUsers();
    } catch (error) {
        console.error('Auth check error:', error);
        window.location.href = '/login.html';
    }
}

// Load all users
async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users');
        const data = await response.json();
        
        if (data.success) {
            currentUsers = data.users;
            renderUsersTable();
        } else {
            showAlert('Không thể tải danh sách người dùng', 'danger');
        }
    } catch (error) {
        console.error('Load users error:', error);
        showAlert('Lỗi kết nối đến server', 'danger');
    }
}

// Render users table
function renderUsersTable() {
    const tbody = document.getElementById('usersTableBody');
    
    if (currentUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center">Không có người dùng nào</td></tr>';
        return;
    }
    
    tbody.innerHTML = currentUsers.map(user => `
        <tr>
            <td>${user.id}</td>
            <td><i class="bi bi-person-badge"></i> ${user.fullname}</td>
            <td><i class="bi bi-person-circle"></i> ${user.username}</td>
            <td>${user.email}</td>
            <td>
                <span class="badge ${user.role === 'admin' ? 'bg-danger' : 'bg-info'}">
                    ${user.role === 'admin' ? 'Quản trị viên' : 'Người dùng'}
                </span>
            </td>
            <td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="openEditModal(${user.id})">
                    <i class="bi bi-pencil"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteUser(${user.id})">
                    <i class="bi bi-trash"></i>
                </button>
            </td>
        </tr>
    `).join('');
}

// Add new user
async function addUser() {
    const fullname = document.getElementById('newFullname').value;
    const username = document.getElementById('newUsername').value;
    const email = document.getElementById('newEmail').value;
    const password = document.getElementById('newPassword').value;
    const role = document.getElementById('newRole').value;

    if (!fullname || !username || !email || !password || !role) {
        showAlert('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/admin/users', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullname, username, email, password, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Thêm người dùng thành công', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addUserModal')).hide();
            document.getElementById('addUserForm').reset();
            loadUsers();
        } else {
            showAlert(data.message || 'Thêm người dùng thất bại', 'danger');
        }
    } catch (error) {
        console.error('Add user error:', error);
        showAlert('Lỗi kết nối đến server', 'danger');
    }
}

// Open edit modal
async function openEditModal(userId) {
    try {
        const response = await fetch(`/api/admin/users/${userId}`);
        const data = await response.json();
        
        if (data.success) {
            const user = data.user;
            document.getElementById('editUserId').value = user.id;
            document.getElementById('editFullname').value = user.fullname;
            document.getElementById('editUsername').value = user.username;
            document.getElementById('editEmail').value = user.email;
            document.getElementById('editRole').value = user.role;
            
            new bootstrap.Modal(document.getElementById('editUserModal')).show();
        } else {
            showAlert('Không thể tải thông tin người dùng', 'danger');
        }
    } catch (error) {
        console.error('Load user error:', error);
        showAlert('Lỗi kết nối đến server', 'danger');
    }
}

// Update user
async function updateUser() {
    const userId = document.getElementById('editUserId').value;
    const fullname = document.getElementById('editFullname').value;
    const email = document.getElementById('editEmail').value;
    const role = document.getElementById('editRole').value;

    if (!fullname || !email || !role) {
        showAlert('Vui lòng điền đầy đủ thông tin', 'warning');
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fullname, email, role })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Cập nhật người dùng thành công', 'success');
            bootstrap.Modal.getInstance(document.getElementById('editUserModal')).hide();
            loadUsers();
        } else {
            showAlert(data.message || 'Cập nhật người dùng thất bại', 'danger');
        }
    } catch (error) {
        console.error('Update user error:', error);
        showAlert('Lỗi kết nối đến server', 'danger');
    }
}

// Delete user
async function deleteUser(userId) {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}`, {
            method: 'DELETE'
        });
        
        const data = await response.json();
        
        if (data.success) {
            showAlert('Xóa người dùng thành công', 'success');
            loadUsers();
        } else {
            showAlert(data.message || 'Xóa người dùng thất bại', 'danger');
        }
    } catch (error) {
        console.error('Delete user error:', error);
        showAlert('Lỗi kết nối đến server', 'danger');
    }
}

// Show alert
function showAlert(message, type) {
    const alertContainer = document.getElementById('alertContainer');
    alertContainer.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Auto dismiss after 5 seconds
    setTimeout(() => {
        const alert = alertContainer.querySelector('.alert');
        if (alert) {
            bootstrap.Alert.getInstance(alert)?.close();
        }
    }, 5000);
}

// Logout
document.getElementById('logoutBtn').addEventListener('click', async (e) => {
    e.preventDefault();
    
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.success) {
            window.location.href = '/login.html';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
});

// Initialize
checkAdminAuth();

