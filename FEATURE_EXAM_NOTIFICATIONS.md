# 📢 Tính năng Thông báo từ Admin trong Contest

## 📋 Tổng quan

Tính năng cho phép admin gửi thông báo real-time đến tất cả thí sinh đang tham gia contest. Thông báo hiển thị dưới dạng popup và **KHÔNG conflict** với tính năng check out tab.

## ✅ Các tính năng đã implement

### 1. Backend (100%)

#### Database Schema
- **Bảng mới:** `exam_notifications` trong `init.sql`
  - `id`: Primary key
  - `exam_id`: Foreign key đến bảng exams
  - `message`: Nội dung thông báo (TEXT)
  - `created_by`: Admin tạo thông báo
  - `is_active`: Trạng thái thông báo
  - `created_at`, `updated_at`: Timestamps

#### Module & Routes
- **Module:** `utils/notification-manager.js`
  - Quản lý CRUD operations cho notifications
  - Tích hợp với SSE Manager để push real-time
  
- **Routes:** `routes/notification.js`
  - `POST /api/notifications/exams/:examId` - Admin tạo thông báo
  - `GET /api/notifications/exams/:examId` - Lấy danh sách thông báo
  - `GET /api/notifications/exams/:examId/stats` - Thống kê
  - `DELETE /api/notifications/:notificationId` - Xóa thông báo
  - `GET /api/notifications/exams/:examId/active` - Student lấy thông báo active

### 2. Frontend - Admin (100%)

#### Giao diện gửi thông báo
- **Vị trí 1:** Trang quản lý kỳ thi (`admin/exams.html`)
  - Nút "Thông báo" cho mỗi kỳ thi
  - Modal với 2 trường: Tiêu đề và Nội dung
  
- **Vị trí 2:** Trang xem bài làm (`admin/exam-submissions.html`)
  - Nút "Gửi thông báo" ở header
  - Modal tương tự

#### Tính năng
- Hiển thị số lượng thí sinh nhận được thông báo
- Validation input
- Feedback success/error

### 3. Frontend - Student (100%)

#### Module Listener
- **File:** `public/js/exam-notification-listener.js`
  - Lắng nghe SSE events
  - Tự động reconnect khi mất kết nối
  - Parse format thông báo (tiêu đề + nội dung)

#### Tích hợp
- **exam-view.html:** Xem danh sách bài thi
- **exam-code.html:** Trang code editor
- Modal Bootstrap hiển thị thông báo
- Âm thanh thông báo khi nhận notification

## 🔒 Không conflict với Check Out Tab

### Lý do không conflict:
1. **Modal hiển thị trong cùng trang**
   - Không trigger `visibilitychange` event
   - Không làm mất focus window
   - Không trigger `window.blur`

2. **Bootstrap Modal với backdrop="static"**
   - Modal không đóng khi click outside
   - Không trigger các event monitoring

3. **Thiết kế cẩn thận**
   - Modal chỉ hiển thị overlay trong DOM
   - Không mở tab/window mới
   - Không redirect

## 🚀 Hướng dẫn Deploy

### Bước 1: Rebuild Docker
```bash
# Stop containers
docker-compose down

# Rebuild và start lại
docker-compose up --build -d
```

### Bước 2: Kiểm tra Database
```bash
# Vào MariaDB container
docker exec -it ide-judge-mariadb-1 mysql -u root -p

# Kiểm tra bảng đã tạo
USE ide_judge_db;
SHOW TABLES LIKE 'exam_notifications';
DESCRIBE exam_notifications;
```

## 🧪 Hướng dẫn Testing

### Test 1: Admin gửi thông báo từ trang quản lý kỳ thi
1. Login với tài khoản admin
2. Vào `/admin/exams.html`
3. Click nút "Thông báo" ở một kỳ thi đang diễn ra
4. Nhập tiêu đề: "Thông báo quan trọng"
5. Nhập nội dung: "Các bạn còn 30 phút để hoàn thành bài thi"
6. Click "Gửi thông báo"
7. Kiểm tra message hiển thị số thí sinh nhận được

### Test 2: Admin gửi thông báo từ trang xem bài làm
1. Login với tài khoản admin
2. Vào `/admin/exam-submissions.html?id=<examId>`
3. Click nút "Gửi thông báo" ở header
4. Nhập nội dung và gửi
5. Kiểm tra feedback

### Test 3: Student nhận thông báo
1. Login với tài khoản student
2. Join một contest đang diễn ra
3. Vào trang xem bài thi hoặc code editor
4. Để admin gửi thông báo
5. **Kiểm tra:**
   - Popup hiển thị ngay lập tức
   - Có âm thanh thông báo
   - Tiêu đề và nội dung hiển thị đúng
   - Thời gian hiển thị đúng

### Test 4: Không conflict với Check Out Tab
1. Student đang trong contest có bật prevent_tab_switch
2. Admin gửi thông báo
3. Popup hiển thị
4. **Kiểm tra:**
   - KHÔNG có cảnh báo vi phạm thoát tab
   - KHÔNG ghi log vào `exam_tab_violations`
   - Student có thể đóng popup bình thường
   - Monitoring vẫn hoạt động sau khi đóng popup

### Test 5: Real-time với nhiều students
1. Mở 3-5 tabs với các tài khoản student khác nhau
2. Tất cả join cùng một contest
3. Admin gửi thông báo
4. **Kiểm tra:**
   - Tất cả students nhận được thông báo cùng lúc
   - Số lượng clients hiển thị đúng
   - Không có student nào bị miss notification

### Test 6: Reconnection khi mất kết nối
1. Student đang trong contest
2. Restart server (hoặc simulate network issue)
3. Đợi 5 giây
4. Admin gửi thông báo
5. **Kiểm tra:**
   - SSE tự động reconnect
   - Student vẫn nhận được thông báo

## 📁 Cấu trúc Files

### Backend
```
init.sql                          # Database schema
utils/notification-manager.js     # Notification business logic
routes/notification.js            # API routes
server.js                         # Routes integration
```

### Frontend - Admin
```
public/admin/exams.html           # Nút thông báo + modal
public/admin/exam-submissions.html # Nút thông báo + modal
public/js/admin-exams.js          # Logic gửi thông báo
```

### Frontend - Student
```
public/js/exam-notification-listener.js  # SSE listener module
public/exam-view.html                    # Modal + script integration
public/exam-code.html                    # Modal + script integration
public/js/user-exam-view.js              # Init listener
```

## 🎯 API Endpoints

### Admin APIs
- `POST /api/notifications/exams/:examId`
  - Body: `{ message: string }`
  - Response: `{ success, notification, clientCount }`

- `GET /api/notifications/exams/:examId`
  - Query: `?activeOnly=true`
  - Response: `{ success, notifications }`

- `DELETE /api/notifications/:notificationId`
  - Response: `{ success, message }`

### Student APIs
- `GET /api/notifications/exams/:examId/active`
  - Response: `{ success, notifications }`

### SSE Endpoint (existing)
- `GET /api/exams/:examId/events`
  - Event: `exam_notification`
  - Data: `{ id, message, createdAt, creatorName, examTitle }`
  - Event: `exam_stopped` (existing)

## 💡 Format Thông báo

Admin nhập:
- **Tiêu đề:** "Thông báo quan trọng"
- **Nội dung:** "Các bạn còn 30 phút"

Lưu trong database:
```
**Thông báo quan trọng**

Các bạn còn 30 phút
```

Hiển thị cho student:
- Modal title: "Thông báo quan trọng"
- Modal body: "Các bạn còn 30 phút"

## 🔧 Troubleshooting

### Thông báo không hiển thị
1. Kiểm tra SSE connection: Mở DevTools > Network > Filter "sse"
2. Kiểm tra console logs: `[NOTIFICATION]` prefix
3. Kiểm tra modal element tồn tại: `document.getElementById('examNotificationModal')`

### Conflict với check out tab
1. Kiểm tra modal có `data-bs-backdrop="static"`
2. Kiểm tra không có redirect trong code
3. Kiểm tra logs trong `exam_tab_violations`

### Database không tạo bảng
1. Kiểm tra `init.sql` có schema
2. Rebuild Docker: `docker-compose up --build -d`
3. Kiểm tra logs: `docker-compose logs mariadb`

## 📝 Notes

- Tính năng sử dụng SSE (Server-Sent Events) cho real-time
- Module hóa code để dễ bảo trì
- Tương thích với tính năng exam monitoring hiện tại
- Không cần thêm dependencies mới

