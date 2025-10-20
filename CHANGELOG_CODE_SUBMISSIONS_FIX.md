# Changelog - Fix Code Submissions Feature

## Ngày: 2025-10-20

### 🎯 Mục tiêu
Sửa lỗi tính năng lưu code khi deploy lên VPS và đảm bảo tính nhất quán của database schema.

---

## 🔍 Vấn đề phát hiện

### 1. Schema database không nhất quán
- `init.sql` có schema cũ cho bảng `code_submissions`
- `migrations/add_code_submissions.sql` có schema mới
- `docker-entrypoint.sh` tạo bảng với schema cũ
- ➡️ Kết quả: Khi deploy lên VPS, schema không khớp với code trong `routes/submission.js`

### 2. Thiếu bảng `submission_history`
- Code trong `routes/submission.js` sử dụng bảng `submission_history`
- Nhưng `init.sql` không có bảng này
- ➡️ Kết quả: Lỗi khi lưu code vào database

### 3. Thư mục uploads không được persist
- Thư mục `uploads/exam-pdfs` được tạo runtime
- Nhưng không có volume trong docker-compose
- ➡️ Kết quả: Mất dữ liệu khi restart container

---

## ✅ Các thay đổi đã thực hiện

### 1. Cập nhật `init.sql`
**File:** `init.sql`

**Thay đổi bảng `code_submissions`:**
```sql
-- CŨ:
source_code TEXT NOT NULL
status VARCHAR(50) DEFAULT 'pending'
-- Thiếu: language_name, submitted_at
-- Có thừa: judge0_token, score, execution_time, memory_used, compile_output, stdout, stderr

-- MỚI:
source_code LONGTEXT
language_name VARCHAR(50)
status ENUM('draft', 'submitted', 'auto_submitted') NOT NULL DEFAULT 'draft'
submitted_at DATETIME DEFAULT NULL
UNIQUE KEY unique_user_problem (user_id, exam_id, problem_id)
```

**Thêm bảng `submission_history`:**
```sql
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
    -- Foreign keys và indexes
);
```

### 2. Cập nhật `docker-entrypoint.sh`
**File:** `docker-entrypoint.sh`

**Thay đổi:**
- ❌ Xóa logic tạo bảng thủ công (đã có trong init.sql)
- ✅ Thêm logic chạy migration tự động
- ✅ Thêm logic tạo thư mục uploads
- ✅ Thêm verification cho các bảng quan trọng

**Code mới:**
```bash
# Tự động chạy migration
if [ -f "/app/migrations/02-fix_code_submissions_schema.sql" ]; then
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < /app/migrations/02-fix_code_submissions_schema.sql
fi

# Tạo thư mục uploads
mkdir -p /app/uploads/exam-pdfs
```

### 3. Cập nhật `docker-compose.yml`
**File:** `docker-compose.yml`

**Thay đổi:**
```yaml
# Thêm volume cho uploads
volumes:
  - .:/app
  - /app/node_modules
  - uploads_data:/app/uploads  # ← MỚI

# Khai báo volume
volumes:
  mariadb_data:
  judge0-db-data:
  judge0-redis-data:
  uploads_data:  # ← MỚI
```

### 4. Tạo migration script tự động
**File mới:** `migrations/02-fix_code_submissions_schema.sql`

**Chức năng:**
- Kiểm tra và thêm các cột thiếu
- Xóa các cột không dùng
- Thay đổi kiểu dữ liệu
- Thêm constraints và indexes
- Tạo bảng `submission_history` nếu chưa có
- **Idempotent:** Chạy nhiều lần không gây lỗi

### 5. Tạo script migration thủ công
**File mới:** `scripts/migrate-code-submissions.sh`

**Chức năng:**
- Backup database trước khi migration
- Chạy migration script
- Verify schema sau khi migration
- Hiển thị kết quả

### 6. Tạo tài liệu hướng dẫn
**Files mới:**
- `MIGRATION_FIX_CODE_SUBMISSIONS.md` - Hướng dẫn chi tiết migration
- `DEPLOY_FIX_GUIDE.md` - Hướng dẫn deploy và troubleshooting
- `QUICK_DEPLOY.md` - Hướng dẫn deploy nhanh
- `CHANGELOG_CODE_SUBMISSIONS_FIX.md` - File này

---

## 🚀 Cách hoạt động tự động

### Khi deploy mới (chưa có database):
1. `docker-compose up -d --build`
2. MariaDB container khởi động
3. MariaDB tự động chạy:
   - `01-init.sql` (tạo tất cả bảng với schema mới)
   - `migrations/02-fix_code_submissions_schema.sql` (đảm bảo schema đúng)
4. Web container khởi động
5. `docker-entrypoint.sh` chạy:
   - Chờ MariaDB ready
   - Chạy migration fix (nếu cần)
   - Verify các bảng quan trọng
   - Tạo thư mục uploads
   - Start Node.js app

### Khi cập nhật hệ thống đang chạy:
1. `docker-compose up -d --build`
2. Web container restart
3. `docker-entrypoint.sh` chạy:
   - Chờ MariaDB ready
   - Chạy migration fix (cập nhật schema nếu cần)
   - Verify các bảng
   - Tạo thư mục uploads (nếu chưa có)
   - Start Node.js app

---

## 📋 Checklist kiểm tra

### Schema database
- [x] Bảng `code_submissions` có trường `language_name`
- [x] Bảng `code_submissions` có trường `submitted_at`
- [x] Trường `source_code` là `LONGTEXT`
- [x] Trường `status` là `ENUM('draft', 'submitted', 'auto_submitted')`
- [x] Có `UNIQUE KEY unique_user_problem`
- [x] Không có các trường: judge0_token, score, execution_time, etc.
- [x] Bảng `submission_history` tồn tại

### Docker configuration
- [x] Volume `uploads_data` được khai báo
- [x] Volume được mount vào `/app/uploads`
- [x] Migrations folder được mount vào MariaDB
- [x] `init.sql` được mount với prefix `01-`
- [x] Migration file có prefix `02-`

### Scripts và automation
- [x] `docker-entrypoint.sh` tự động chạy migration
- [x] `docker-entrypoint.sh` tự động tạo thư mục uploads
- [x] `docker-entrypoint.sh` verify các bảng quan trọng
- [x] Script migration có thể chạy nhiều lần (idempotent)

### Documentation
- [x] Hướng dẫn deploy mới
- [x] Hướng dẫn cập nhật hệ thống đang chạy
- [x] Hướng dẫn troubleshooting
- [x] Hướng dẫn rollback
- [x] Changelog chi tiết

---

## 🎉 Kết quả

### Trước khi fix:
- ❌ Deploy lên VPS bị lỗi
- ❌ Không lưu được code
- ❌ Schema không nhất quán
- ❌ Thiếu bảng submission_history
- ❌ Mất dữ liệu uploads khi restart

### Sau khi fix:
- ✅ Deploy tự động, không cần can thiệp thủ công
- ✅ Lưu code hoạt động bình thường
- ✅ Schema nhất quán giữa tất cả các file
- ✅ Có đầy đủ các bảng cần thiết
- ✅ Dữ liệu uploads được persist
- ✅ Migration tự động khi restart
- ✅ Có đầy đủ tài liệu hướng dẫn

---

## 📝 Lưu ý quan trọng

1. **Backup trước khi deploy:** Luôn backup database trước khi cập nhật
2. **Kiểm tra logs:** Theo dõi logs sau khi deploy để phát hiện lỗi sớm
3. **Test đầy đủ:** Test tính năng lưu code, submit code, reload trang
4. **Volume persistence:** Đảm bảo volume `uploads_data` không bị xóa
5. **Migration idempotent:** Migration script có thể chạy nhiều lần an toàn

---

## 🔄 Rollback (nếu cần)

```bash
# 1. Stop containers
docker-compose down

# 2. Restore database
docker exec -i ide-judge-mariadb mysql -u root -p ide_judge_db < backup_YYYYMMDD_HHMMSS.sql

# 3. Checkout code cũ
git checkout <commit-hash-trước-khi-fix>

# 4. Rebuild và restart
docker-compose build --no-cache
docker-compose up -d
```

---

## 👨‍💻 Người thực hiện
- AI Assistant (Augment Agent)
- Ngày: 2025-10-20

## 📞 Liên hệ
Nếu có vấn đề, vui lòng kiểm tra:
1. Logs: `docker-compose logs -f`
2. File `DEPLOY_FIX_GUIDE.md`
3. File `MIGRATION_FIX_CODE_SUBMISSIONS.md`

