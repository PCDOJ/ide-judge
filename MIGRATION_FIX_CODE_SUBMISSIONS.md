# Migration Fix: Code Submissions Schema

## Vấn đề
Khi deploy lên VPS, tính năng lưu code bị lỗi do schema database không nhất quán giữa các file khởi tạo.

## Nguyên nhân
1. **Schema không khớp**: `init.sql` có schema cũ cho bảng `code_submissions` không khớp với code trong `routes/submission.js`
2. **Thiếu bảng**: Thiếu bảng `submission_history` trong `init.sql`
3. **Thiếu volume**: Thư mục `uploads` không được persist trong docker-compose

## Các thay đổi đã thực hiện

### 1. Cập nhật `init.sql`
- Sửa schema bảng `code_submissions`:
  - Thay đổi `source_code` từ `TEXT` thành `LONGTEXT`
  - Thêm trường `language_name VARCHAR(50)`
  - Thêm trường `submitted_at DATETIME`
  - Thay đổi `status` từ `VARCHAR(50)` thành `ENUM('draft', 'submitted', 'auto_submitted')`
  - Xóa các trường không dùng: `judge0_token`, `score`, `execution_time`, `memory_used`, `compile_output`, `stdout`, `stderr`
  - Thêm `UNIQUE KEY unique_user_problem (user_id, exam_id, problem_id)`
  - Thêm index cho `submitted_at`
- Thêm bảng `submission_history` mới

### 2. Cập nhật `docker-entrypoint.sh`
- Sửa schema tạo bảng `code_submissions` trong entrypoint cho khớp với migration
- Thêm logic tạo bảng `submission_history`
- Thêm logic tạo thư mục `uploads/exam-pdfs` khi container khởi động

### 3. Cập nhật `docker-compose.yml`
- Thêm volume `uploads_data` để persist thư mục uploads
- Map volume `uploads_data:/app/uploads` cho service web

## Hướng dẫn Migration cho Database hiện có

### Nếu bạn đã có database cũ trên VPS:

#### Option 1: Migration thủ công (Khuyến nghị - Giữ lại dữ liệu)

```bash
# 1. Kết nối vào container MariaDB
docker exec -it ide-judge-mariadb mysql -u root -p

# 2. Chọn database
USE ide_judge_db;

# 3. Kiểm tra cấu trúc bảng hiện tại
DESCRIBE code_submissions;

# 4. Nếu bảng có schema cũ, chạy các lệnh ALTER sau:

-- Thêm cột language_name nếu chưa có
ALTER TABLE code_submissions 
ADD COLUMN language_name VARCHAR(50) AFTER language_id;

-- Thêm cột submitted_at nếu chưa có
ALTER TABLE code_submissions 
ADD COLUMN submitted_at DATETIME DEFAULT NULL AFTER status;

-- Thay đổi kiểu dữ liệu source_code
ALTER TABLE code_submissions 
MODIFY COLUMN source_code LONGTEXT;

-- Thay đổi kiểu dữ liệu status
ALTER TABLE code_submissions 
MODIFY COLUMN status ENUM('draft', 'submitted', 'auto_submitted') NOT NULL DEFAULT 'draft';

-- Xóa các cột không dùng (nếu có)
ALTER TABLE code_submissions 
DROP COLUMN IF EXISTS judge0_token,
DROP COLUMN IF EXISTS score,
DROP COLUMN IF EXISTS execution_time,
DROP COLUMN IF EXISTS memory_used,
DROP COLUMN IF EXISTS compile_output,
DROP COLUMN IF EXISTS stdout,
DROP COLUMN IF EXISTS stderr;

-- Thêm unique constraint
ALTER TABLE code_submissions 
ADD UNIQUE KEY unique_user_problem (user_id, exam_id, problem_id);

-- Thêm index cho submitted_at
ALTER TABLE code_submissions 
ADD INDEX idx_submitted_at (submitted_at);

# 5. Tạo bảng submission_history nếu chưa có
CREATE TABLE IF NOT EXISTS submission_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    user_id INT NOT NULL,
    exam_id INT NOT NULL,
    problem_id INT NOT NULL,
    source_code LONGTEXT,
    language_id INT NOT NULL,
    language_name VARCHAR(50),
    action_type ENUM('save', 'submit', 'auto_submit') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES code_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    INDEX idx_submission_id (submission_id),
    INDEX idx_user_id (user_id),
    INDEX idx_exam_id (exam_id),
    INDEX idx_problem_id (problem_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

# 6. Thoát khỏi MySQL
EXIT;
```

#### Option 2: Xóa và tạo lại (Mất dữ liệu - Chỉ dùng khi test)

```bash
# 1. Stop containers
docker-compose down

# 2. Xóa volume database cũ
docker volume rm ide-judge_mariadb_data

# 3. Start lại containers (sẽ tạo database mới với schema đúng)
docker-compose up -d
```

### Nếu deploy mới lên VPS:

```bash
# 1. Clone code mới nhất
git pull origin main

# 2. Stop containers cũ (nếu có)
docker-compose down

# 3. Build lại image
docker-compose build --no-cache

# 4. Start containers
docker-compose up -d

# 5. Kiểm tra logs
docker-compose logs -f web
```

## Kiểm tra sau khi migration

### 1. Kiểm tra schema database:
```bash
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; DESCRIBE code_submissions;"
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; DESCRIBE submission_history;"
```

### 2. Kiểm tra thư mục uploads:
```bash
docker exec -it ide-judge-web ls -la /app/uploads/
```

### 3. Test tính năng lưu code:
1. Đăng nhập vào hệ thống
2. Tham gia một kỳ thi
3. Viết code và kiểm tra auto-save
4. Reload trang và kiểm tra code có được load lại không
5. Submit code và kiểm tra status

## Lưu ý quan trọng

1. **Backup database trước khi migration**: 
   ```bash
   docker exec ide-judge-mariadb mysqldump -u root -p ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Kiểm tra volume mapping**: Đảm bảo volume `uploads_data` được tạo và map đúng

3. **Kiểm tra permissions**: Thư mục uploads phải có quyền write cho container

4. **Monitoring**: Theo dõi logs sau khi deploy để phát hiện lỗi sớm
   ```bash
   docker-compose logs -f web
   ```

## Rollback (nếu cần)

Nếu có vấn đề sau khi migration:

```bash
# 1. Stop containers
docker-compose down

# 2. Restore database từ backup
docker exec -i ide-judge-mariadb mysql -u root -p ide_judge_db < backup_YYYYMMDD_HHMMSS.sql

# 3. Checkout code cũ
git checkout <commit-hash-cũ>

# 4. Rebuild và restart
docker-compose build --no-cache
docker-compose up -d
```

