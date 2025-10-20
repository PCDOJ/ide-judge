# 🔄 Tự Động Khởi Tạo Database

## Cơ Chế Hoạt Động

Hệ thống IDE Judge đã được cấu hình để **TỰ ĐỘNG** kiểm tra và tạo database mỗi khi container khởi động.

### 📋 Quy Trình Tự Động

Khi bạn chạy `docker-compose up` hoặc `docker-compose restart web`, file `docker-entrypoint.sh` sẽ:

1. **Chờ MariaDB sẵn sàng** (tối đa 60 lần thử, mỗi lần 3 giây)
2. **Kiểm tra từng bảng:**
   - `users` - Bảng người dùng
   - `exams` - Bảng kỳ thi
   - `exam_problems` - Bảng bài thi
   - `exam_registrations` - Bảng đăng ký
   - `code_submissions` - Bảng nộp bài

3. **Hành động dựa trên trạng thái:**
   - ✅ **Bảng đã tồn tại:** Bỏ qua, không làm gì
   - ⚠️ **Bảng chưa tồn tại:** Tạo bảng mới với đầy đủ cấu trúc
   - 🔧 **Bảng thiếu cột:** Thêm cột còn thiếu (ví dụ: `has_access_code`)

4. **Khởi động ứng dụng Node.js**

---

## 🎯 Nguyên Tắc Hoạt Động

### "Có rồi thì khỏi tạo, chưa có thì tạo"

```bash
# Kiểm tra bảng
if table_exists "exams"; then
    echo "✓ Table 'exams' exists"
    
    # Kiểm tra cột
    if column_exists "exams" "has_access_code"; then
        echo "✓ Column 'has_access_code' exists"
    else
        # Thêm cột nếu thiếu
        ALTER TABLE exams ADD COLUMN has_access_code ...
    fi
else
    # Tạo bảng nếu chưa có
    CREATE TABLE exams (...)
fi
```

---

## 🚀 Khi Nào Tự Động Chạy?

### 1. Deploy Lần Đầu
```bash
./scripts/start.sh
```
→ Tất cả bảng sẽ được tạo tự động

### 2. Restart Container
```bash
docker-compose restart web
```
→ Kiểm tra và tạo bảng thiếu (nếu có)

### 3. Rebuild Container
```bash
docker-compose up -d --build
```
→ Kiểm tra và tạo bảng thiếu (nếu có)

### 4. Sau Khi Pull Code Mới
```bash
git pull
docker-compose restart web
```
→ Tự động cập nhật schema nếu có thay đổi

---

## 📊 Xem Logs Tự Động

### Xem quá trình kiểm tra và tạo bảng:

```bash
docker-compose logs web | grep -A 20 "Running database migrations"
```

**Kết quả mẫu:**
```
Running database migrations and checks...
  ✓ Table 'users' exists
  ✓ Table 'exams' exists
    ✓ Column 'has_access_code' exists
  ✓ Table 'exam_problems' exists
  ✓ Table 'exam_registrations' exists
  ✓ Table 'code_submissions' exists
✓ All database tables verified and created!
```

### Xem logs realtime:

```bash
docker-compose logs -f web
```

---

## 🔧 Cấu Trúc Files

### 1. `docker-entrypoint.sh`
File chính chứa logic tự động:
- Hàm `table_exists()` - Kiểm tra bảng tồn tại
- Hàm `column_exists()` - Kiểm tra cột tồn tại
- Hàm `run_migrations()` - Chạy kiểm tra và tạo bảng

### 2. `init.sql`
File khởi tạo database lần đầu (chạy bởi MariaDB):
- Tạo database `ide_judge_db`
- Tạo tất cả bảng với cấu trúc đầy đủ
- Insert admin user mặc định

### 3. `migrations/*.sql`
Các file migration bổ sung (backup, không bắt buộc):
- `add_exam_tables.sql` - Tạo bảng exam
- `add_code_submissions.sql` - Tạo bảng submissions
- `add_has_access_code_field.sql` - Thêm cột has_access_code

---

## ⚙️ Cấu Hình

### Biến Môi Trường Cần Thiết (`.env`):

```env
DB_HOST=mariadb
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=ide_judge_db
DB_PORT=3306
```

### Docker Compose Volumes:

```yaml
volumes:
  - ./init.sql:/docker-entrypoint-initdb.d/01-init.sql
  - ./migrations:/docker-entrypoint-initdb.d/migrations
```

---

## 🛠️ Xử Lý Sự Cố

### Vấn đề: Bảng không được tạo tự động

**Kiểm tra:**
```bash
# 1. Xem logs
docker-compose logs web | grep -i "error\|fail"

# 2. Kiểm tra kết nối database
docker-compose exec web node -e "
const db = require('./config/database');
db.query('SELECT 1').then(() => console.log('OK')).catch(console.error);
"

# 3. Kiểm tra biến môi trường
docker-compose exec web env | grep DB_
```

### Vấn đề: Cột `has_access_code` vẫn thiếu

**Giải pháp:**
```bash
# Restart lại web service
docker-compose restart web

# Hoặc chạy script thủ công
./scripts/fix-database.sh
```

### Vấn đề: MariaDB không sẵn sàng

**Kiểm tra:**
```bash
# Xem logs MariaDB
docker-compose logs mariadb

# Kiểm tra health
docker-compose ps mariadb
```

---

## 📝 Lưu Ý Quan Trọng

### ✅ Ưu Điểm
- Tự động hoàn toàn, không cần can thiệp thủ công
- An toàn: Không xóa dữ liệu hiện có
- Idempotent: Chạy nhiều lần không gây lỗi
- Dễ maintain: Thêm bảng mới chỉ cần cập nhật `docker-entrypoint.sh`

### ⚠️ Lưu Ý
- Chỉ tạo bảng/cột mới, **KHÔNG XÓA** bảng/cột cũ
- Nếu muốn xóa database hoàn toàn: `docker-compose down -v`
- Luôn backup trước khi thay đổi schema quan trọng

### 🔒 Bảo Mật
- Password được lấy từ biến môi trường `DB_PASSWORD`
- Không hardcode password trong code
- Admin user mặc định nên đổi password ngay sau deploy

---

## 🎓 Ví Dụ Thực Tế

### Scenario 1: Deploy lần đầu
```bash
# Clone project
git clone <repo> ide-judge
cd ide-judge

# Tạo .env
cp .env.example .env
nano .env  # Cập nhật DB_PASSWORD

# Start
./scripts/start.sh

# Kết quả: Tất cả bảng được tạo tự động
```

### Scenario 2: Update code có thêm bảng mới
```bash
# Pull code mới
git pull

# Restart (tự động tạo bảng mới)
docker-compose restart web

# Kiểm tra logs
docker-compose logs web | tail -50
```

### Scenario 3: Server cũ thiếu bảng
```bash
# Chỉ cần restart
docker-compose restart web

# Hoặc rebuild
docker-compose up -d --build

# Bảng thiếu sẽ được tạo tự động
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, cung cấp:
1. Logs: `docker-compose logs web > logs.txt`
2. Database tables: `docker-compose exec mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "SHOW TABLES;"`
3. Container status: `docker-compose ps`

