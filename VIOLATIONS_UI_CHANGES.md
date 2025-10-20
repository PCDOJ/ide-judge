# Cải tiến UI Admin Panel - Hệ thống Vi phạm Tab

## 📋 Tổng quan thay đổi

Đã refactor hoàn toàn UI admin panel để hiển thị vi phạm theo từng sinh viên thay vì logs tổng hợp, kèm theo:
- ✅ Sửa lỗi tính duration (hiển thị đúng giờ:phút:giây)
- ✅ UI mới: Danh sách sinh viên với badge vi phạm
- ✅ Modal chi tiết với live update mỗi 5 giây
- ✅ 3 API endpoints mới

---

## 🔧 Các thay đổi chính

### 1. **Backend - API Endpoints Mới** (`routes/exam.js`)

#### API 1: Lấy danh sách sinh viên tham gia thi
```
GET /api/admin/exams/:examId/students
```

**Response:**
```json
{
  "success": true,
  "exam": { ... },
  "students": [
    {
      "id": 1,
      "fullname": "Nguyễn Văn A",
      "email": "a@example.com",
      "violation_count": 5,
      "total_duration_seconds": 300,
      "last_violation_at": "2025-10-20 12:30:00"
    }
  ],
  "stats": {
    "totalStudents": 50,
    "studentsWithViolations": 10,
    "totalViolations": 45,
    "totalDuration": 1500
  }
}
```

#### API 2: Lấy violations của 1 sinh viên cụ thể
```
GET /api/admin/exams/:examId/students/:userId/violations
```

**Response:**
```json
{
  "success": true,
  "student": {
    "id": 1,
    "fullname": "Nguyễn Văn A",
    "email": "a@example.com"
  },
  "violations": [
    {
      "id": 1,
      "left_at": "2025-10-20 12:30:00",
      "returned_at": "2025-10-20 12:35:00",
      "duration_seconds": 300,
      "violation_type": "tab_hidden",
      "problem_code": "P001",
      "problem_title": "Bài 1"
    }
  ],
  "stats": {
    "totalViolations": 5,
    "totalDuration": 300,
    "violationsByType": {
      "tab_hidden": 3,
      "window_blur": 2
    }
  }
}
```

#### API 3: Legacy endpoint (giữ để backward compatibility)
```
GET /api/admin/exams/:examId/violations
```

---

### 2. **Frontend - UI Mới** (`public/admin/exam-violations.html`)

#### Thay đổi giao diện:

**TRƯỚC:**
- Hiển thị tất cả violations trong 1 bảng lớn
- Khó tìm kiếm và theo dõi từng sinh viên
- Không có live update

**SAU:**
- Hiển thị danh sách sinh viên (student cards)
- Mỗi card hiển thị:
  - Tên, email sinh viên
  - Badge số lượng vi phạm (đỏ nếu có, xanh nếu không)
  - Tổng thời gian vi phạm
  - Vi phạm gần nhất
  - Nút "Chi tiết" (chỉ hiện nếu có vi phạm)

#### Modal Chi tiết:
- Hiển thị tất cả violations của 1 sinh viên
- **Live update mỗi 5 giây** (tự động refresh)
- Thống kê: Tổng vi phạm, tổng thời gian, thời gian cập nhật cuối
- Bảng chi tiết từng lần vi phạm

#### Filters mới:
- Tìm kiếm theo tên/email
- Lọc theo trạng thái:
  - Tất cả thí sinh
  - Có vi phạm
  - Không vi phạm

---

### 3. **JavaScript Logic** (`public/js/admin-exam-violations.js`)

#### Các function chính:

1. **`loadStudents()`** - Load danh sách sinh viên từ API mới
2. **`renderStudents()`** - Render student cards với filters
3. **`showViolationDetails(userId)`** - Mở modal chi tiết
4. **`loadStudentViolations(userId, isRefresh)`** - Load violations của 1 sinh viên
5. **`renderModalViolations(violations)`** - Render bảng violations trong modal
6. **`formatDurationFull(seconds)`** - Format duration đúng (giờ:phút:giây)

#### Live Update:
```javascript
// Auto-refresh mỗi 5 giây khi modal mở
autoRefreshInterval = setInterval(() => {
    if (currentStudentId) {
        loadStudentViolations(currentStudentId, true);
    }
}, 5000);

// Dừng auto-refresh khi đóng modal
document.getElementById('violationsModal').addEventListener('hidden.bs.modal', () => {
    clearInterval(autoRefreshInterval);
});
```

---

## 🎨 CSS Styles Mới

```css
.student-card {
    transition: all 0.3s;
    border: 1px solid #dee2e6;
    border-radius: 8px;
    margin-bottom: 1rem;
}

.student-card:hover {
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    transform: translateY(-2px);
}

.student-card.has-violations {
    border-left: 4px solid #dc3545; /* Đỏ */
}

.student-card.no-violations {
    border-left: 4px solid #28a745; /* Xanh */
}
```

---

## 🐛 Bug Fixes

### Fix 1: Duration hiển thị sai
**Vấn đề:** Duration tính bằng giây nhưng hiển thị không đúng format

**Giải pháp:**
```javascript
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
```

**Ví dụ:**
- 65 giây → "1m 5s"
- 3665 giây → "1h 1m 5s"
- 0 giây → "0s"

---

## 📊 Statistics Cards

**Card 1: Tổng số vi phạm**
- Hiển thị tổng số lần vi phạm của tất cả sinh viên

**Card 2: Số thí sinh vi phạm**
- Format: "10 / 50" (10 sinh viên có vi phạm / 50 tổng số sinh viên)

**Card 3: Tổng thời gian vi phạm**
- Hiển thị tổng thời gian tất cả vi phạm (format: Xh Ym Zs)

---

## 🔄 Workflow mới

1. Admin vào trang violations
2. Hệ thống load danh sách sinh viên tham gia thi
3. Hiển thị student cards với badge vi phạm
4. Admin có thể:
   - Tìm kiếm sinh viên
   - Lọc theo trạng thái (có/không vi phạm)
   - Click "Chi tiết" để xem violations của sinh viên
5. Modal mở ra với:
   - Thông tin sinh viên
   - Thống kê vi phạm
   - Bảng chi tiết từng lần vi phạm
   - **Auto-refresh mỗi 5 giây**
6. Admin đóng modal khi xong

---

## 🚀 Cách test

1. Khởi động server
2. Đăng nhập với tài khoản admin
3. Vào "Quản lý kỳ thi" → Chọn 1 kỳ thi → "Vi phạm"
4. Kiểm tra:
   - ✅ Danh sách sinh viên hiển thị đúng
   - ✅ Badge vi phạm hiển thị đúng (đỏ/xanh)
   - ✅ Tìm kiếm hoạt động
   - ✅ Filter hoạt động
   - ✅ Click "Chi tiết" mở modal
   - ✅ Modal hiển thị đúng violations
   - ✅ Live update hoạt động (mỗi 5 giây)
   - ✅ Duration hiển thị đúng format

---

## 📝 Notes

- API cũ (`/api/admin/exams/:examId/violations`) vẫn giữ để backward compatibility
- Live update chỉ hoạt động khi modal đang mở
- Auto-refresh dừng khi đóng modal để tiết kiệm tài nguyên
- Duration được tính chính xác bằng giây và hiển thị đúng format
- UI responsive, hoạt động tốt trên mobile

---

## 🎯 Kết quả

✅ UI dễ nhìn, dễ sử dụng hơn
✅ Dễ dàng theo dõi từng sinh viên
✅ Live update giúp admin theo dõi real-time
✅ Duration hiển thị chính xác
✅ Performance tốt hơn (chỉ load violations khi cần)

