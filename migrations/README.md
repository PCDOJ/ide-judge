# Database Migrations

## Tổng quan

Thư mục này chứa các migration files để cập nhật database schema.

## Danh sách Migrations

1. `add_exam_tables.sql` - Tạo các bảng exams, exam_problems, exam_registrations
2. `add_code_submissions.sql` - Tạo bảng code_submissions
3. `02-fix_code_submissions_schema.sql` - Cập nhật schema của code_submissions
4. `add_has_access_code_field.sql` - Thêm cột has_access_code vào exams
5. `03-add_prevent_tab_switch.sql` - Thêm cột prevent_tab_switch vào exams
6. `04-add_exam_tab_violations.sql` - Tạo bảng exam_tab_violations
7. `05-update_violation_types.sql` - Cập nhật các loại vi phạm
8. `06-add_exam_notifications.sql` - Tạo bảng exam_notifications (Thông báo từ admin)
9. `run-all-migrations.sql` - Script tổng hợp chạy tất cả migrations

## Cách chạy Migrations

### Tự động (Chỉ khi khởi tạo database lần đầu)

Migrations sẽ tự động chạy khi Docker container được khởi tạo lần đầu tiên:

```bash
docker-compose down -v  # Xóa volumes (CẢNH BÁO: Mất toàn bộ dữ liệu!)
docker-compose up -d    # Migrations tự động chạy
```

### Thủ công (Khuyến nghị cho database đã tồn tại)

Nếu database đã tồn tại, bạn cần chạy migrations thủ công:

```bash
# Chạy từng migration
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/03-add_prevent_tab_switch.sql
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/04-add_exam_tab_violations.sql
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/06-add_exam_notifications.sql
```

Hoặc sử dụng script helper:

```bash
# Từ thư mục gốc của project
chmod +x scripts/run-migrations.sh
./scripts/run-migrations.sh
```

## Verify Migrations

Kiểm tra xem migrations đã chạy thành công:

```bash
# Kiểm tra cột prevent_tab_switch
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exams;"

# Kiểm tra bảng exam_tab_violations
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exam_tab_violations;"

# Kiểm tra bảng exam_notifications
docker exec ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db -e "DESCRIBE exam_notifications;"
```

Kết quả mong đợi:
- Bảng `exams` có cột `prevent_tab_switch` (BOOLEAN)
- Bảng `exam_tab_violations` tồn tại với các cột: id, exam_id, user_id, problem_id, left_at, returned_at, duration_seconds, violation_type
- Bảng `exam_notifications` tồn tại với các cột: id, exam_id, message, created_by, is_active, created_at, updated_at

## Rollback

Nếu cần rollback migrations:

```bash
# Kết nối vào MariaDB
docker exec -it ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db

# Xóa bảng exam_tab_violations
DROP TABLE IF EXISTS exam_tab_violations;

# Xóa cột prevent_tab_switch
ALTER TABLE exams DROP COLUMN IF EXISTS prevent_tab_switch;

# Thoát
exit;
```

## Lưu ý

- Tất cả migrations đều có logic "IF NOT EXISTS" hoặc conditional checks
- An toàn khi chạy nhiều lần (idempotent)
- Không làm mất dữ liệu hiện có
- Migrations chỉ thêm/sửa schema, không xóa dữ liệu

## Troubleshooting

### Lỗi: "Unknown column 'prevent_tab_switch'"

**Nguyên nhân**: Migration chưa được chạy

**Giải pháp**: Chạy migration thủ công như hướng dẫn ở trên

### Lỗi: "Table 'exam_tab_violations' doesn't exist"

**Nguyên nhân**: Migration 04 chưa được chạy

**Giải pháp**: 
```bash
docker exec -i ide-judge-mariadb mariadb -uroot -p${DB_PASSWORD} ide_judge_db < migrations/04-add_exam_tab_violations.sql
```

### Lỗi: "Access denied for user 'root'"

**Nguyên nhân**: Sai password hoặc biến môi trường chưa được set

**Giải pháp**: 
```bash
# Kiểm tra file .env
cat .env | grep DB_PASSWORD

# Hoặc thay ${DB_PASSWORD} bằng password thực tế
docker exec -i ide-judge-mariadb mariadb -uroot -pYOUR_PASSWORD ide_judge_db < migrations/03-add_prevent_tab_switch.sql
```

## Tài liệu tham khảo

- [ANTI_CHEATING_TAB_MONITORING.md](../docs/ANTI_CHEATING_TAB_MONITORING.md) - Chi tiết về tính năng
- [DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) - Hướng dẫn deployment đầy đủ

