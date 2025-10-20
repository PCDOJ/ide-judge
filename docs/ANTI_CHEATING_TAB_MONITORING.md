# Tính năng Chống Gian Lận - Giám sát và Ngăn chặn Thoát Tab

## Tổng quan

Tính năng này cho phép admin bật chế độ giám sát tab trong kỳ thi để phát hiện và ghi log các hành vi thoát tab của thí sinh, giúp phát hiện gian lận.

## Các thành phần chính

### 1. Database Schema

#### Bảng `exams`
- **Cột mới**: `prevent_tab_switch` (BOOLEAN, DEFAULT FALSE)
- **Mục đích**: Bật/tắt tính năng giám sát tab cho kỳ thi

#### Bảng `exam_tab_violations` (Mới)
```sql
- id: INT (Primary Key)
- exam_id: INT (Foreign Key -> exams.id)
- user_id: INT (Foreign Key -> users.id)
- problem_id: INT (Foreign Key -> exam_problems.id, nullable)
- left_at: DATETIME (Thời điểm rời khỏi tab)
- returned_at: DATETIME (Thời điểm quay lại tab, nullable)
- duration_seconds: INT (Thời gian rời tab tính bằng giây, nullable)
- violation_type: ENUM('tab_hidden', 'window_blur', 'page_unload')
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

### 2. Migration Files

Tất cả migration files đã được cấu hình để tự động chạy khi khởi động Docker container:

- `migrations/03-add_prevent_tab_switch.sql`: Thêm cột prevent_tab_switch
- `migrations/04-add_exam_tab_violations.sql`: Tạo bảng exam_tab_violations
- `migrations/run-all-migrations.sql`: Script tổng hợp chạy tất cả migrations

**Lưu ý**: Tất cả migrations đều có logic "IF NOT EXISTS" nên an toàn khi chạy nhiều lần.

### 3. Admin UI

#### Tạo/Chỉnh sửa kỳ thi (`/admin/exams.html`)
- Checkbox "Ngăn chặn thoát tab (Chống gian lận)" trong form
- Khi bật, tính năng giám sát sẽ được kích hoạt cho kỳ thi

#### Danh sách kỳ thi
- Nút "Vi phạm" (màu đỏ) xuất hiện cho các kỳ thi có `prevent_tab_switch = true`
- Click vào nút để xem chi tiết vi phạm

#### Trang xem vi phạm (`/admin/exam-violations.html`)
- **Thống kê tổng quan**:
  - Tổng số vi phạm
  - Số thí sinh vi phạm
  - Tổng thời gian vi phạm
  
- **Bộ lọc**:
  - Tìm theo tên/email thí sinh
  - Lọc theo bài thi
  - Lọc theo loại vi phạm
  
- **Bảng danh sách vi phạm**:
  - Thông tin thí sinh
  - Bài thi đang làm
  - Loại vi phạm (badge màu)
  - Thời gian rời/quay lại
  - Thời lượng (color-coded: đỏ > 5 phút, vàng > 1 phút, xanh < 1 phút)

### 4. Client-side Monitoring (`/exam-code.html`)

#### Các sự kiện được giám sát:
1. **visibilitychange**: Phát hiện khi tab bị ẩn (switch tab, minimize window)
2. **blur**: Phát hiện khi window mất focus
3. **beforeunload**: Phát hiện khi cố gắng thoát trang

#### Flow hoạt động:
```
1. Thí sinh thoát tab
   ↓
2. Hiển thị popup cảnh báo ngay lập tức
   ↓
3. Ghi log vi phạm lên server (POST /api/exam-violations/log)
   ↓
4. Thí sinh quay lại tab
   ↓
5. Cập nhật thời gian quay lại (PUT /api/exam-violations/update-return)
```

### 5. Backend API (`/routes/exam.js`)

#### Endpoints mới:

**POST `/api/exam-violations/log`**
- Ghi log vi phạm mới
- Body: `{ exam_id, user_id, problem_id, violation_type }`
- Response: `{ success, violationId }`

**PUT `/api/exam-violations/update-return`**
- Cập nhật thời gian quay lại
- Body: `{ violationId }`
- Response: `{ success, duration_seconds }`

**GET `/api/admin/exams/:examId/violations`**
- Lấy danh sách vi phạm của kỳ thi
- Response:
```json
{
  "success": true,
  "exam": { ... },
  "violations": [ ... ],
  "stats": {
    "totalViolations": 10,
    "uniqueStudents": 5,
    "totalDuration": 300
  }
}
```

## Hướng dẫn sử dụng

### Cho Admin

1. **Tạo kỳ thi với tính năng chống gian lận**:
   - Vào `/admin/exams.html`
   - Click "Thêm kỳ thi mới"
   - Điền thông tin kỳ thi
   - ✅ Tick vào checkbox "Ngăn chặn thoát tab (Chống gian lận)"
   - Lưu kỳ thi

2. **Xem vi phạm**:
   - Trong danh sách kỳ thi, click nút "Vi phạm" (màu đỏ)
   - Xem thống kê và danh sách vi phạm
   - Sử dụng bộ lọc để tìm kiếm cụ thể

3. **Phân tích vi phạm**:
   - **Màu đỏ** (> 5 phút): Vi phạm nghiêm trọng, có thể gian lận
   - **Màu vàng** (> 1 phút): Vi phạm trung bình, cần xem xét
   - **Màu xanh** (< 1 phút): Vi phạm nhẹ, có thể do nhầm lẫn

### Cho Thí sinh

1. **Khi tham gia kỳ thi có bật chống gian lận**:
   - Hệ thống sẽ tự động giám sát tab
   - **KHÔNG** được thoát khỏi tab thi
   - **KHÔNG** được switch sang tab/window khác
   - **KHÔNG** được minimize browser

2. **Nếu vô tình thoát tab**:
   - Popup cảnh báo sẽ hiển thị ngay lập tức
   - Vi phạm sẽ được ghi log
   - Quay lại tab thi ngay để giảm thời gian vi phạm

## Deployment

### Chạy migrations

Migrations sẽ tự động chạy khi khởi động Docker container:

```bash
# Khởi động lại container để chạy migrations
docker-compose down
docker-compose up -d

# Kiểm tra logs
docker-compose logs mariadb
```

### Kiểm tra migrations đã chạy

```bash
# Kết nối vào MariaDB container
docker exec -it ide-judge-mariadb mysql -u root -p

# Kiểm tra cột prevent_tab_switch
USE ide_judge_db;
DESCRIBE exams;

# Kiểm tra bảng exam_tab_violations
DESCRIBE exam_tab_violations;
```

## Testing

### Test flow hoàn chỉnh:

1. **Tạo kỳ thi**:
   - Tạo kỳ thi mới với prevent_tab_switch = true
   - Thêm bài thi vào kỳ thi

2. **Thí sinh tham gia**:
   - Đăng nhập với tài khoản thí sinh
   - Tham gia kỳ thi
   - Mở bài thi

3. **Test vi phạm**:
   - Switch sang tab khác → Popup cảnh báo xuất hiện
   - Quay lại tab thi
   - Minimize window → Popup cảnh báo xuất hiện
   - Quay lại window

4. **Xem vi phạm**:
   - Đăng nhập với tài khoản admin
   - Vào danh sách kỳ thi
   - Click nút "Vi phạm"
   - Kiểm tra vi phạm đã được ghi log

## Troubleshooting

### Migrations không chạy

```bash
# Chạy migrations thủ công
docker exec -it ide-judge-mariadb mysql -u root -p ide_judge_db < migrations/03-add_prevent_tab_switch.sql
docker exec -it ide-judge-mariadb mysql -u root -p ide_judge_db < migrations/04-add_exam_tab_violations.sql
```

### Popup cảnh báo không hiển thị

- Kiểm tra `prevent_tab_switch` của kỳ thi = true
- Kiểm tra console log trong browser
- Kiểm tra API endpoint `/api/exam-violations/log` hoạt động

### Vi phạm không được ghi log

- Kiểm tra bảng `exam_tab_violations` đã được tạo
- Kiểm tra API endpoint trả về success
- Kiểm tra console log trong browser

## Security Considerations

1. **Client-side monitoring có thể bị bypass**: Tính năng này chỉ là một lớp bảo vệ, không thể ngăn chặn 100% gian lận
2. **Chỉ ghi log, không block**: Hệ thống chỉ ghi log vi phạm, không ngăn chặn thí sinh tiếp tục làm bài
3. **Admin review**: Admin cần xem xét từng trường hợp vi phạm để quyết định xử lý

## Future Enhancements

- [ ] Thêm tùy chọn số lần vi phạm tối đa
- [ ] Tự động khóa bài thi khi vi phạm quá nhiều
- [ ] Gửi email cảnh báo cho admin khi có vi phạm
- [ ] Thêm webcam monitoring
- [ ] Thêm screen recording

