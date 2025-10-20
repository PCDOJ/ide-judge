# Hướng dẫn Deployment - Tính năng Chống Gian Lận

## Quick Start

### 1. Chuẩn bị

Đảm bảo bạn đã có:
- Docker và Docker Compose đã cài đặt
- File `.env` đã được cấu hình đúng
- Source code đã được pull về

### 2. Deployment

**LƯU Ý QUAN TRỌNG**: Migrations trong `/docker-entrypoint-initdb.d/` chỉ chạy khi database được khởi tạo lần đầu. Nếu database đã tồn tại, bạn cần chạy migrations thủ công.

#### Option 1: Chạy migrations thủ công (Khuyến nghị cho database đã tồn tại)

```bash
# Bước 1: Đảm bảo containers đang chạy
docker-compose up -d

# Bước 2: Chạy migrations
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/03-add_prevent_tab_switch.sql
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/04-add_exam_tab_violations.sql

# Bước 3: Verify migrations
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exams;" | grep prevent_tab_switch
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "SHOW TABLES;" | grep exam_tab_violations
```

#### Option 2: Khởi tạo lại database từ đầu (Chỉ dùng cho môi trường dev)

```bash
# CẢNH BÁO: Lệnh này sẽ XÓA TOÀN BỘ DỮ LIỆU!
docker-compose down -v  # -v để xóa volumes
docker-compose up -d    # Migrations sẽ tự động chạy khi khởi tạo database mới
```

### 3. Verify Migrations

```bash
# Kết nối vào MariaDB
docker exec -it ide-judge-mariadb mysql -u root -p

# Trong MySQL prompt:
USE ide_judge_db;

# Kiểm tra cột prevent_tab_switch đã được thêm
DESCRIBE exams;
# Kết quả mong đợi: Có cột prevent_tab_switch (BOOLEAN)

# Kiểm tra bảng exam_tab_violations đã được tạo
DESCRIBE exam_tab_violations;
# Kết quả mong đợi: Bảng có các cột: id, exam_id, user_id, problem_id, left_at, returned_at, duration_seconds, violation_type

# Thoát MySQL
exit;
```

### 4. Test Tính năng

#### Test 1: Admin UI
1. Truy cập `http://localhost:2308/admin/exams.html`
2. Click "Thêm kỳ thi mới"
3. Kiểm tra checkbox "Ngăn chặn thoát tab (Chống gian lận)" có hiển thị
4. Tạo kỳ thi với checkbox được tick
5. Kiểm tra nút "Vi phạm" (màu đỏ) xuất hiện trong danh sách

#### Test 2: Client-side Monitoring
1. Đăng nhập với tài khoản thí sinh
2. Tham gia kỳ thi vừa tạo
3. Mở một bài thi
4. Switch sang tab khác
5. Kiểm tra popup cảnh báo xuất hiện
6. Quay lại tab thi

#### Test 3: Violations View
1. Đăng nhập với tài khoản admin
2. Vào danh sách kỳ thi
3. Click nút "Vi phạm" của kỳ thi vừa test
4. Kiểm tra:
   - Thống kê hiển thị đúng
   - Bảng vi phạm có dữ liệu
   - Bộ lọc hoạt động

## Rollback (Nếu cần)

### Rollback Database

```bash
# Kết nối vào MariaDB
docker exec -it ide-judge-mariadb mysql -u root -p

# Trong MySQL prompt:
USE ide_judge_db;

# Xóa bảng exam_tab_violations
DROP TABLE IF EXISTS exam_tab_violations;

# Xóa cột prevent_tab_switch
ALTER TABLE exams DROP COLUMN IF EXISTS prevent_tab_switch;

exit;
```

### Rollback Code

```bash
# Checkout về commit trước đó
git log --oneline  # Tìm commit hash
git checkout <commit-hash>

# Restart containers
docker-compose down
docker-compose up -d
```

## Troubleshooting

### Lỗi: Migrations không chạy

**Triệu chứng**: Không thấy cột `prevent_tab_switch` hoặc bảng `exam_tab_violations`

**Giải pháp**:
```bash
# Chạy migrations thủ công
docker exec -it ide-judge-mariadb bash

# Trong container:
cd /docker-entrypoint-initdb.d/migrations
mysql -u root -p ide_judge_db < 03-add_prevent_tab_switch.sql
mysql -u root -p ide_judge_db < 04-add_exam_tab_violations.sql
exit
```

### Lỗi: Popup không hiển thị

**Triệu chứng**: Thí sinh thoát tab nhưng không thấy popup cảnh báo

**Kiểm tra**:
1. Mở Developer Console (F12)
2. Kiểm tra tab Console có lỗi JavaScript không
3. Kiểm tra tab Network, xem API call `/api/exam-violations/log` có được gọi không
4. Kiểm tra `prevent_tab_switch` của kỳ thi = true

**Giải pháp**:
```bash
# Clear browser cache
# Hard reload: Ctrl + Shift + R (Windows/Linux) hoặc Cmd + Shift + R (Mac)

# Kiểm tra file exam-code.html đã được cập nhật
docker exec -it ide-judge-web cat /app/public/exam-code.html | grep "initTabMonitoring"
```

### Lỗi: Vi phạm không được ghi log

**Triệu chứng**: Popup hiển thị nhưng không thấy vi phạm trong admin panel

**Kiểm tra**:
```bash
# Kiểm tra bảng exam_tab_violations
docker exec -it ide-judge-mariadb mysql -u root -p

USE ide_judge_db;
SELECT * FROM exam_tab_violations ORDER BY created_at DESC LIMIT 10;
exit;
```

**Giải pháp**:
- Nếu không có dữ liệu: Kiểm tra API endpoint `/api/exam-violations/log`
- Nếu có dữ liệu: Kiểm tra file `admin-exam-violations.js` đã được load đúng

### Lỗi: Foreign Key Constraint

**Triệu chứng**: Lỗi khi tạo bảng `exam_tab_violations`

**Giải pháp**:
```sql
-- Kiểm tra các bảng liên quan đã tồn tại
SHOW TABLES LIKE 'exams';
SHOW TABLES LIKE 'users';
SHOW TABLES LIKE 'exam_problems';

-- Nếu thiếu bảng, chạy lại migration tương ứng
```

## Monitoring

### Kiểm tra số lượng vi phạm

```sql
-- Tổng số vi phạm
SELECT COUNT(*) as total_violations FROM exam_tab_violations;

-- Vi phạm theo kỳ thi
SELECT 
    e.title,
    COUNT(*) as violations_count,
    COUNT(DISTINCT etv.user_id) as unique_students
FROM exam_tab_violations etv
JOIN exams e ON etv.exam_id = e.id
GROUP BY e.id, e.title
ORDER BY violations_count DESC;

-- Vi phạm theo loại
SELECT 
    violation_type,
    COUNT(*) as count
FROM exam_tab_violations
GROUP BY violation_type;

-- Thí sinh vi phạm nhiều nhất
SELECT 
    u.fullname,
    u.email,
    COUNT(*) as violations_count,
    SUM(etv.duration_seconds) as total_duration_seconds
FROM exam_tab_violations etv
JOIN users u ON etv.user_id = u.id
GROUP BY u.id, u.fullname, u.email
ORDER BY violations_count DESC
LIMIT 10;
```

### Logs

```bash
# Xem logs của web container
docker-compose logs -f web

# Xem logs của MariaDB container
docker-compose logs -f mariadb

# Xem logs của tất cả containers
docker-compose logs -f
```

## Performance Considerations

### Database Indexes

Bảng `exam_tab_violations` đã có các indexes:
- `idx_exam_user (exam_id, user_id)`: Tăng tốc query theo kỳ thi và thí sinh
- `idx_left_at (left_at)`: Tăng tốc query theo thời gian
- `idx_violation_type (violation_type)`: Tăng tốc query theo loại vi phạm

### Cleanup Old Data

```sql
-- Xóa vi phạm cũ hơn 6 tháng
DELETE FROM exam_tab_violations 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);

-- Hoặc archive vào bảng khác
CREATE TABLE exam_tab_violations_archive LIKE exam_tab_violations;

INSERT INTO exam_tab_violations_archive
SELECT * FROM exam_tab_violations
WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);

DELETE FROM exam_tab_violations 
WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH);
```

## Backup

### Backup Database

```bash
# Backup toàn bộ database
docker exec ide-judge-mariadb mysqldump -u root -p ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup chỉ bảng exam_tab_violations
docker exec ide-judge-mariadb mysqldump -u root -p ide_judge_db exam_tab_violations > violations_backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
# Restore từ backup
docker exec -i ide-judge-mariadb mysql -u root -p ide_judge_db < backup_20251020_120000.sql
```

## Security Checklist

- [ ] Migrations đã chạy thành công
- [ ] Bảng `exam_tab_violations` đã được tạo với đúng foreign keys
- [ ] API endpoints có authentication middleware (isAdmin, isAuthenticated)
- [ ] Client-side validation hoạt động
- [ ] Popup cảnh báo hiển thị đúng
- [ ] Vi phạm được ghi log chính xác
- [ ] Admin panel hiển thị đúng dữ liệu
- [ ] Bộ lọc hoạt động
- [ ] Không có lỗi JavaScript trong console
- [ ] Không có lỗi SQL trong logs

## Support

Nếu gặp vấn đề, kiểm tra:
1. Logs của containers: `docker-compose logs -f`
2. Browser console: F12 → Console tab
3. Network requests: F12 → Network tab
4. Database data: Kết nối vào MariaDB và query trực tiếp

Liên hệ team dev nếu cần hỗ trợ thêm.

