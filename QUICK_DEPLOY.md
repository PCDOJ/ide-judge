# Hướng dẫn Deploy Nhanh - IDE Judge

## 🚀 Deploy mới hoàn toàn (Khuyến nghị)

```bash
# 1. Clone hoặc pull code mới nhất
git pull origin main

# 2. Stop và xóa containers cũ
docker-compose down
docker volume rm ide-judge_mariadb_data  # Xóa database cũ

# 3. Build và start
docker-compose up -d --build

# 4. Kiểm tra
docker-compose logs -f web
```

**✅ Tất cả sẽ tự động:**
- Tạo database với schema mới
- Chạy tất cả migrations
- Tạo thư mục uploads
- Khởi động ứng dụng

---

## 🔄 Cập nhật hệ thống đang chạy

```bash
# 1. Pull code mới
git pull origin main

# 2. Backup database (khuyến nghị)
docker exec ide-judge-mariadb mysqldump -u root -p ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql

# 3. Rebuild và restart
docker-compose up -d --build

# 4. Kiểm tra logs
docker-compose logs -f web
```

**✅ Migration tự động chạy khi restart!**

---

## 📋 Kiểm tra sau khi deploy

### 1. Kiểm tra containers đang chạy
```bash
docker-compose ps
```

Kết quả mong đợi: Tất cả containers đều `Up` và `healthy`

### 2. Kiểm tra database schema
```bash
docker exec -it ide-judge-mariadb mysql -u root -p -e "USE ide_judge_db; DESCRIBE code_submissions;"
```

Phải có các trường:
- ✅ `language_name VARCHAR(50)`
- ✅ `submitted_at DATETIME`
- ✅ `status ENUM('draft', 'submitted', 'auto_submitted')`
- ✅ `source_code LONGTEXT`

### 3. Kiểm tra thư mục uploads
```bash
docker exec -it ide-judge-web ls -la /app/uploads/
```

### 4. Test tính năng
1. Truy cập: http://localhost:2308 (hoặc IP VPS của bạn)
2. Đăng nhập với admin/admin123
3. Tạo kỳ thi và test lưu code

---

## 🐛 Troubleshooting

### Lỗi: Container không start
```bash
# Xem logs
docker-compose logs mariadb
docker-compose logs web

# Restart
docker-compose restart
```

### Lỗi: Database schema sai
```bash
# Chạy lại migration
docker-compose restart web
docker-compose logs -f web
```

### Lỗi: Port đã được sử dụng
```bash
# Kiểm tra port
lsof -i :2308
lsof -i :2310

# Hoặc thay đổi port trong .env
PORT=3000
```

---

## 📝 Các file quan trọng

- `docker-compose.yml` - Cấu hình containers
- `init.sql` - Schema database ban đầu
- `migrations/02-fix_code_submissions_schema.sql` - Migration tự động
- `docker-entrypoint.sh` - Script khởi động tự động
- `.env` - Cấu hình môi trường

---

## 🔐 Thông tin đăng nhập mặc định

- **Username:** admin
- **Password:** admin123

⚠️ **Lưu ý:** Đổi mật khẩu ngay sau khi deploy!

---

## 📞 Cần trợ giúp?

Xem thêm:
- `DEPLOY_FIX_GUIDE.md` - Hướng dẫn chi tiết
- `MIGRATION_FIX_CODE_SUBMISSIONS.md` - Chi tiết về migration
- Logs: `docker-compose logs -f`

