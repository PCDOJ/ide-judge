# Hướng dẫn Fix và Deploy - Tính năng Lưu Code

## Tóm tắt vấn đề
Tính năng lưu code bị lỗi khi deploy lên VPS do:
1. Schema database không nhất quán
2. Thiếu bảng `submission_history`
3. Thư mục uploads không được persist

## Các file đã được sửa
- ✅ `init.sql` - Cập nhật schema cho code_submissions và thêm submission_history
- ✅ `docker-entrypoint.sh` - Cập nhật logic tạo bảng và thư mục
- ✅ `docker-compose.yml` - Thêm volume cho uploads
- ✅ `migrations/fix_code_submissions_schema.sql` - Script migration
- ✅ `scripts/migrate-code-submissions.sh` - Script tự động migration

## Hướng dẫn Deploy

### A. Deploy mới (Chưa có database) - KHUYẾN NGHỊ

**Cách này tự động chạy tất cả migrations khi khởi động!**

```bash
# 1. Pull code mới
git pull origin main

# 2. Stop và xóa containers cũ (nếu có)
docker-compose down

# 3. Xóa volume database cũ (nếu muốn bắt đầu từ đầu)
docker volume rm ide-judge_mariadb_data

# 4. Build và start containers
docker-compose up -d --build

# 5. Kiểm tra logs
docker-compose logs -f web

# Database sẽ tự động:
# - Chạy init.sql (tạo tất cả bảng với schema mới)
# - Chạy migrations/02-fix_code_submissions_schema.sql (đảm bảo schema đúng)
# - Tạo thư mục uploads
```

### B. Cập nhật hệ thống đang chạy (Đã có database)

**Migration sẽ tự động chạy khi restart container!**

```bash
# 1. Pull code mới
git pull origin main

# 2. Backup database (khuyến nghị)
docker exec ide-judge-mariadb mysqldump -u root -p ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Rebuild và restart containers
docker-compose up -d --build

# 4. Kiểm tra logs
docker-compose logs -f web

# Migration sẽ tự động:
# - Kiểm tra và cập nhật schema code_submissions
# - Tạo bảng submission_history nếu chưa có
# - Tạo thư mục uploads
```

#### Option 2: Chỉ restart web service (nhanh hơn)

```bash
# 1. Pull code mới
git pull origin main

# 2. Restart web service
docker-compose restart web

# 3. Kiểm tra logs
docker-compose logs -f web
```

## Kiểm tra sau khi deploy

### 1. Kiểm tra database schema
```bash
# Kiểm tra bảng code_submissions
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; DESCRIBE code_submissions;"

# Kiểm tra bảng submission_history
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; DESCRIBE submission_history;"
```

Kết quả mong đợi cho `code_submissions`:
- ✅ Có trường `language_name VARCHAR(50)`
- ✅ Có trường `submitted_at DATETIME`
- ✅ `source_code` là `LONGTEXT`
- ✅ `status` là `ENUM('draft', 'submitted', 'auto_submitted')`
- ✅ Có `UNIQUE KEY unique_user_problem`
- ❌ KHÔNG có các trường: judge0_token, score, execution_time, memory_used, compile_output, stdout, stderr

### 2. Kiểm tra thư mục uploads
```bash
docker exec -it ide-judge-web ls -la /app/uploads/
```

Kết quả mong đợi:
```
drwxr-xr-x    3 node     node          4096 Oct 20 10:00 .
drwxr-xr-x   10 node     node          4096 Oct 20 10:00 ..
drwxr-xr-x    2 node     node          4096 Oct 20 10:00 exam-pdfs
```

### 3. Kiểm tra volumes
```bash
docker volume ls | grep ide-judge
```

Kết quả mong đợi:
```
ide-judge_mariadb_data
ide-judge_judge0-db-data
ide-judge_judge0-redis-data
ide-judge_uploads_data          <-- Volume mới
```

### 4. Test tính năng lưu code

1. **Đăng nhập** vào hệ thống
2. **Tham gia kỳ thi** đang diễn ra
3. **Viết code** trong editor
4. **Kiểm tra auto-save**: 
   - Mở Developer Console (F12)
   - Xem log `[SAVE] Saving to server`
   - Kiểm tra response từ API
5. **Reload trang**: Code phải được load lại
6. **Submit code**: Kiểm tra status chuyển thành 'submitted'

### 5. Kiểm tra logs
```bash
# Xem logs real-time
docker-compose logs -f web

# Xem logs lỗi
docker-compose logs web | grep -i error

# Xem logs database
docker-compose logs mariadb | tail -50
```

## Troubleshooting

### Lỗi: "Table 'code_submissions' doesn't exist"
```bash
# Chạy lại entrypoint để tạo bảng
docker-compose restart web
docker-compose logs -f web
```

### Lỗi: "Duplicate entry for key 'unique_user_problem'"
```bash
# Xóa dữ liệu trùng lặp
docker exec -it ide-judge-mariadb mysql -u root -p
USE ide_judge_db;
DELETE t1 FROM code_submissions t1
INNER JOIN code_submissions t2 
WHERE t1.id > t2.id 
AND t1.user_id = t2.user_id 
AND t1.exam_id = t2.exam_id 
AND t1.problem_id = t2.problem_id;
EXIT;
```

### Lỗi: "Cannot add foreign key constraint"
```bash
# Kiểm tra các bảng liên quan có tồn tại không
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; SHOW TABLES;"

# Nếu thiếu bảng, chạy lại init.sql
docker exec -i ide-judge-mariadb mysql -u root -p < init.sql
```

### Lỗi: "Permission denied" khi tạo thư mục uploads
```bash
# Tạo thư mục thủ công với quyền đúng
docker exec -it ide-judge-web mkdir -p /app/uploads/exam-pdfs
docker exec -it ide-judge-web chown -R node:node /app/uploads
```

### Code không được lưu
1. Kiểm tra logs: `docker-compose logs -f web`
2. Kiểm tra network: `docker-compose exec web wget -O- http://localhost:2308/api/submission/save`
3. Kiểm tra database connection: `docker-compose exec web node -e "require('./config/database').query('SELECT 1')"`

## Rollback (nếu cần)

```bash
# 1. Stop containers
docker-compose down

# 2. Restore database từ backup
docker exec -i ide-judge-mariadb mysql -u root -p ide_judge_db < backup_YYYYMMDD_HHMMSS.sql

# 3. Checkout code cũ
git checkout <commit-hash-trước-khi-fix>

# 4. Rebuild và restart
docker-compose build --no-cache
docker-compose up -d
```

## Liên hệ hỗ trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs: `docker-compose logs -f`
2. Kiểm tra file `MIGRATION_FIX_CODE_SUBMISSIONS.md` để biết chi tiết
3. Tạo issue với đầy đủ thông tin logs

## Checklist Deploy

- [ ] Pull code mới nhất
- [ ] Backup database hiện tại
- [ ] Chạy migration script
- [ ] Rebuild containers
- [ ] Kiểm tra schema database
- [ ] Kiểm tra thư mục uploads
- [ ] Kiểm tra volumes
- [ ] Test tính năng lưu code
- [ ] Test tính năng submit code
- [ ] Kiểm tra logs không có lỗi
- [ ] Test reload trang, code vẫn còn
- [ ] Xóa backup nếu mọi thứ OK

