# 🚨 Khắc Phục Nhanh Lỗi "Không Tải Được Kỳ Thi"

## Vấn Đề
API exam trả về: `{"success":false,"message":"Server error"}`

## Nguyên Nhân
Database thiếu các bảng exam hoặc thiếu cột `has_access_code`

## ✅ Giải Pháp Nhanh (Cho Server Đang Chạy)

### Bước 1: Chạy Script Sửa Database

```bash
# Cấp quyền thực thi
chmod +x scripts/fix-database.sh

# Chạy script
./scripts/fix-database.sh
```

Script này sẽ:
- ✅ Kiểm tra tất cả các bảng cần thiết
- ✅ Tạo các bảng thiếu (nếu có)
- ✅ Thêm cột `has_access_code` vào bảng `exams` (nếu thiếu)
- ✅ Hiển thị danh sách bảng hiện có

### Bước 2: Restart Web Service

```bash
docker-compose restart web
```

### Bước 3: Kiểm Tra

```bash
# Kiểm tra logs
docker-compose logs -f web

# Kiểm tra API
curl http://localhost:2308/api/admin/exams
```

---

## 🔄 Giải Pháp Triệt Để (Xóa Database và Tạo Mới)

**⚠️ CẢNH BÁO: Sẽ MẤT TẤT CẢ DỮ LIỆU!**

```bash
# Dừng hệ thống
docker-compose down

# Xóa volumes (bao gồm database)
docker-compose down -v

# Khởi động lại (database sẽ được tạo mới từ init.sql)
./scripts/start.sh
```

---

## 📊 Kiểm Tra Database

### Kiểm tra các bảng hiện có:

```bash
docker-compose exec mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "SHOW TABLES;"
```

**Kết quả mong đợi:**
```
+-------------------------+
| Tables_in_ide_judge_db  |
+-------------------------+
| code_submissions        |
| exam_problems           |
| exam_registrations      |
| exams                   |
| users                   |
+-------------------------+
```

### Kiểm tra cấu trúc bảng exams:

```bash
docker-compose exec mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "DESCRIBE exams;"
```

**Phải có cột `has_access_code`:**
```
+------------------+--------------+------+-----+---------+----------------+
| Field            | Type         | Null | Key | Default | Extra          |
+------------------+--------------+------+-----+---------+----------------+
| id               | int(11)      | NO   | PRI | NULL    | auto_increment |
| title            | varchar(255) | NO   |     | NULL    |                |
| description      | text         | YES  |     | NULL    |                |
| start_time       | datetime     | NO   | MUL | NULL    |                |
| end_time         | datetime     | NO   | MUL | NULL    |                |
| access_code      | varchar(50)  | YES  |     | NULL    |                |
| has_access_code  | tinyint(1)   | NO   |     | 0       |                |
| created_by       | int(11)      | NO   | MUL | NULL    |                |
| created_at       | timestamp    | NO   |     | current |                |
| updated_at       | timestamp    | NO   |     | current |                |
+------------------+--------------+------+-----+---------+----------------+
```

---

## 🐛 Debug Thêm

### Xem logs chi tiết:

```bash
# Logs của web service
docker-compose logs --tail=100 web

# Logs của MariaDB
docker-compose logs --tail=100 mariadb
```

### Kiểm tra kết nối database:

```bash
docker-compose exec web node -e "
const db = require('./config/database');
db.query('SELECT 1')
  .then(() => console.log('✓ Database connected'))
  .catch(err => console.error('✗ Database error:', err.message));
"
```

### Test API trực tiếp:

```bash
# Đăng nhập và lấy session cookie
curl -c cookies.txt -X POST http://localhost:2308/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Test API exams
curl -b cookies.txt http://localhost:2308/api/admin/exams
```

---

## 📝 Các Thay Đổi Đã Thực Hiện

### 1. File `init.sql`
- ✅ Thêm tất cả bảng exam (exams, exam_problems, exam_registrations, code_submissions)
- ✅ Thêm cột `has_access_code` vào bảng `exams`
- ✅ Thêm ENGINE=InnoDB và CHARSET=utf8mb4 cho tất cả bảng

### 2. File `docker-compose.yml`
- ✅ Mount init.sql với tên `01-init.sql`
- ✅ Mount thư mục migrations

### 3. File `scripts/migrate.sh`
- ✅ Sử dụng biến môi trường `${DB_PASSWORD}`

### 4. File `scripts/fix-database.sh` (MỚI)
- ✅ Script kiểm tra và sửa database tự động

---

## 💡 Lưu Ý

1. **Luôn backup database trước khi thực hiện thay đổi:**
   ```bash
   docker-compose exec mariadb mysqldump -uroot -p"${DB_PASSWORD}" ide_judge_db > backup.sql
   ```

2. **Restore từ backup:**
   ```bash
   docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db < backup.sql
   ```

3. **Nếu vẫn gặp lỗi, kiểm tra:**
   - File `.env` có đúng cấu hình không
   - MariaDB có đang chạy không: `docker-compose ps mariadb`
   - Port 2310 có bị chiếm không: `sudo netstat -tulpn | grep 2310`

---

## 📞 Cần Hỗ Trợ?

Nếu vẫn gặp vấn đề, cung cấp thông tin sau:

```bash
# 1. Danh sách bảng
docker-compose exec mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "SHOW TABLES;"

# 2. Logs web service
docker-compose logs --tail=50 web

# 3. Trạng thái services
docker-compose ps
```

