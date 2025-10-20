# Hệ thống Migration Tự động

## Tổng quan

Hệ thống migration được thiết kế để tự động chạy mỗi khi container khởi động, đảm bảo database schema luôn được cập nhật và nhất quán trên mọi môi trường (dev, staging, production).

## Kiến trúc

### 1. Entrypoint Script (`docker-entrypoint.sh`)

Script này được chạy tự động khi container web khởi động. Nó thực hiện các bước sau:

```
1. Chờ MariaDB sẵn sàng
2. Chạy tất cả migrations theo thứ tự
3. Verify tables và columns
4. Tạo directories cần thiết
5. Khởi động Node.js application
```

### 2. Migration Files

Tất cả migration files nằm trong thư mục `/app/migrations/` và được chạy theo thứ tự:

1. `add_exam_tables.sql` - Tạo bảng exams, exam_problems, exam_registrations
2. `add_code_submissions.sql` - Tạo bảng code_submissions
3. `02-fix_code_submissions_schema.sql` - Cập nhật schema code_submissions
4. `add_has_access_code_field.sql` - Thêm cột has_access_code
5. `03-add_prevent_tab_switch.sql` - Thêm cột prevent_tab_switch
6. `04-add_exam_tab_violations.sql` - Tạo bảng exam_tab_violations

### 3. Idempotent Design

Tất cả migrations được thiết kế để **idempotent** (có thể chạy nhiều lần mà không gây lỗi):

- Sử dụng `CREATE TABLE IF NOT EXISTS`
- Sử dụng `ALTER TABLE` với conditional checks
- Kiểm tra sự tồn tại của columns/indexes trước khi thêm

## Cách hoạt động

### Khi khởi động container lần đầu

```bash
docker-compose up -d
```

1. MariaDB container khởi động
2. File `init.sql` được chạy tự động (tạo database và user table)
3. Web container khởi động
4. `docker-entrypoint.sh` được thực thi
5. Tất cả migrations được chạy theo thứ tự
6. Application khởi động

### Khi restart container

```bash
docker-compose restart web
```

1. Container dừng
2. Container khởi động lại
3. `docker-entrypoint.sh` được thực thi lại
4. Migrations được chạy lại (nhưng không làm gì vì đã tồn tại)
5. Application khởi động

### Khi deploy lên môi trường mới

```bash
# Clone repository
git clone <repo-url>
cd ide-judge

# Cấu hình .env
cp .env.example .env
# Edit .env với thông tin phù hợp

# Khởi động
docker-compose up -d
```

Migrations sẽ tự động chạy và tạo đầy đủ schema!

## Logs và Monitoring

### Xem logs migrations

```bash
# Xem logs của web container
docker-compose logs web | grep -A 20 "Running migrations"

# Kết quả mong đợi:
# ✓ Migration add_exam_tables.sql completed
# ✓ Migration add_code_submissions.sql completed
# ✓ Migration 02-fix_code_submissions_schema.sql completed
# ✓ Migration add_has_access_code_field.sql completed
# ✓ Migration 03-add_prevent_tab_switch.sql completed
# ✓ Migration 04-add_exam_tab_violations.sql completed
```

### Verify schema

```bash
# Kiểm tra tables
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "SHOW TABLES;"

# Kiểm tra cột prevent_tab_switch
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exams;"

# Kiểm tra bảng exam_tab_violations
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exam_tab_violations;"
```

## Thêm Migration Mới

### Bước 1: Tạo migration file

```bash
# Tạo file migration mới
touch migrations/05-add_new_feature.sql
```

### Bước 2: Viết migration với idempotent design

```sql
-- migrations/05-add_new_feature.sql
USE ide_judge_db;

-- Thêm cột mới (với check IF NOT EXISTS)
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'exams' 
    AND COLUMN_NAME = 'new_column'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE exams ADD COLUMN new_column VARCHAR(255) DEFAULT NULL',
    'SELECT "Column new_column already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Hoặc tạo bảng mới
CREATE TABLE IF NOT EXISTS new_table (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### Bước 3: Cập nhật docker-entrypoint.sh

Thêm migration mới vào danh sách trong `docker-entrypoint.sh`:

```bash
migrations=(
    "/app/migrations/add_exam_tables.sql"
    "/app/migrations/add_code_submissions.sql"
    "/app/migrations/02-fix_code_submissions_schema.sql"
    "/app/migrations/add_has_access_code_field.sql"
    "/app/migrations/03-add_prevent_tab_switch.sql"
    "/app/migrations/04-add_exam_tab_violations.sql"
    "/app/migrations/05-add_new_feature.sql"  # <-- Thêm dòng này
)
```

### Bước 4: Thêm verification (optional)

Thêm verification cho table/column mới:

```bash
# Trong function run_migrations()
if table_exists "new_table"; then
    echo "  ✓ Table 'new_table' exists"
else
    echo "  ❌ Table 'new_table' missing!"
    exit 1
fi
```

### Bước 5: Test

```bash
# Restart container để test migration
docker-compose restart web

# Xem logs
docker-compose logs web | grep "05-add_new_feature"

# Verify
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE new_table;"
```

## Best Practices

### 1. Luôn sử dụng Idempotent Design

✅ **Đúng**:
```sql
CREATE TABLE IF NOT EXISTS my_table (...);

SET @column_exists = (...);
SET @sql = IF(@column_exists = 0, 'ALTER TABLE ...', 'SELECT ...');
```

❌ **Sai**:
```sql
CREATE TABLE my_table (...);  -- Sẽ lỗi nếu table đã tồn tại
ALTER TABLE my_table ADD COLUMN ...;  -- Sẽ lỗi nếu column đã tồn tại
```

### 2. Đặt tên migration rõ ràng

✅ **Đúng**:
- `03-add_prevent_tab_switch.sql`
- `04-add_exam_tab_violations.sql`
- `05-add_user_roles.sql`

❌ **Sai**:
- `migration.sql`
- `update.sql`
- `fix.sql`

### 3. Thêm comments đầy đủ

```sql
-- Migration: Add user roles feature
-- Created: 2025-10-20
-- Purpose: Add role-based access control
-- Dependencies: users table must exist

USE ide_judge_db;

-- Add role column to users table
...
```

### 4. Test trên môi trường dev trước

```bash
# Test migration trên local
docker-compose down -v  # Xóa data
docker-compose up -d    # Khởi tạo lại

# Verify
docker-compose logs web | grep "Migration"
```

### 5. Backup trước khi deploy production

```bash
# Backup database
docker exec ide-judge-mariadb mysqldump -uroot -p${DB_PASSWORD} ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Deploy
git pull
docker-compose restart web

# Verify
docker-compose logs web | tail -100
```

## Troubleshooting

### Migration không chạy

**Triệu chứng**: Không thấy logs "Running migrations"

**Kiểm tra**:
```bash
# Kiểm tra entrypoint script có được mount không
docker exec ide-judge-web ls -la /app/docker-entrypoint.sh

# Kiểm tra quyền thực thi
docker exec ide-judge-web ls -la /app/docker-entrypoint.sh | grep "x"
```

**Giải pháp**:
```bash
chmod +x docker-entrypoint.sh
docker-compose restart web
```

### Migration lỗi

**Triệu chứng**: Thấy error trong logs

**Kiểm tra**:
```bash
# Xem chi tiết lỗi
docker-compose logs web | grep -i error

# Kết nối vào database để debug
docker exec -it ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db
```

**Giải pháp**:
1. Fix migration file
2. Restart container: `docker-compose restart web`

### Table/Column không tồn tại sau migration

**Triệu chứng**: Application báo lỗi "Unknown column" hoặc "Table doesn't exist"

**Kiểm tra**:
```bash
# Verify migration đã chạy
docker-compose logs web | grep "Migration.*completed"

# Verify table/column
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "SHOW TABLES;"
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exams;"
```

**Giải pháp**:
1. Kiểm tra migration file có lỗi syntax không
2. Chạy migration thủ công để xem lỗi chi tiết
3. Fix và restart

## Rollback

Nếu cần rollback migration:

```bash
# Kết nối vào database
docker exec -it ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db

# Xóa table/column đã tạo
DROP TABLE IF EXISTS exam_tab_violations;
ALTER TABLE exams DROP COLUMN IF EXISTS prevent_tab_switch;

# Thoát
exit;

# Xóa migration file khỏi docker-entrypoint.sh
# Edit docker-entrypoint.sh và remove migration từ danh sách

# Restart
docker-compose restart web
```

## Tài liệu tham khảo

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) - Hướng dẫn deployment
- [ANTI_CHEATING_TAB_MONITORING.md](./ANTI_CHEATING_TAB_MONITORING.md) - Chi tiết tính năng
- [migrations/README.md](../migrations/README.md) - Hướng dẫn migrations

