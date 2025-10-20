# Hướng Dẫn Deploy IDE Judge Lên Server Mới

## 🔧 Vấn Đề Đã Được Khắc Phục

### Vấn đề trước đây:
1. ❌ File `init.sql` chỉ tạo bảng `users`, không tạo các bảng exam
2. ❌ Docker-compose không mount thư mục migrations vào MariaDB
3. ❌ Script `migrate.sh` sử dụng password cứng thay vì biến môi trường

### Giải pháp đã áp dụng:
1. ✅ Cập nhật `init.sql` để bao gồm TẤT CẢ các bảng cần thiết:
   - `users` - Quản lý người dùng
   - `exams` - Quản lý kỳ thi
   - `exam_problems` - Quản lý bài thi trong kỳ thi
   - `exam_registrations` - Quản lý đăng ký tham gia kỳ thi
   - `code_submissions` - Quản lý bài nộp code

2. ✅ Cập nhật `docker-compose.yml` để mount migrations:
   ```yaml
   volumes:
     - ./init.sql:/docker-entrypoint-initdb.d/01-init.sql
     - ./migrations:/docker-entrypoint-initdb.d/migrations
   ```

3. ✅ Cập nhật `migrate.sh` để sử dụng biến môi trường `DB_PASSWORD`

---

## 📋 Yêu Cầu Hệ Thống

- Docker Engine 20.10+
- Docker Compose 2.0+
- Ít nhất 4GB RAM
- Ít nhất 10GB dung lượng ổ cứng

---

## 🚀 Hướng Dẫn Deploy Lên Server Mới

### Bước 1: Chuẩn Bị Server

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài đặt Docker (nếu chưa có)
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Cài đặt Docker Compose (nếu chưa có)
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Kiểm tra cài đặt
docker --version
docker-compose --version
```

### Bước 2: Clone Project

```bash
# Clone repository
git clone <repository-url> ide-judge
cd ide-judge
```

### Bước 3: Cấu Hình Biến Môi Trường

```bash
# Tạo file .env
cp .env.example .env

# Chỉnh sửa file .env
nano .env
```

**Nội dung file `.env` cần thiết:**

```env
# Database Configuration
DB_HOST=mariadb
DB_USER=root
DB_PASSWORD=your_secure_password_here
DB_NAME=ide_judge_db
DB_PORT=3306

# Judge0 Database Configuration
POSTGRES_DB=judge0
POSTGRES_USER=judge0
POSTGRES_PASSWORD=your_judge0_password_here

# Application Configuration
NODE_ENV=production
PORT=2308
SESSION_SECRET=your_session_secret_here

# Judge0 Configuration
JUDGE0_API_URL=http://judge0-server:2358

# Timezone
TZ=Asia/Ho_Chi_Minh
```

**⚠️ QUAN TRỌNG:** 
- Thay đổi `DB_PASSWORD` thành mật khẩu mạnh
- Thay đổi `POSTGRES_PASSWORD` thành mật khẩu mạnh
- Thay đổi `SESSION_SECRET` thành chuỗi ngẫu nhiên dài

### Bước 4: Tạo Secrets (Tùy chọn nhưng khuyến nghị)

```bash
# Chạy script tạo secrets tự động
chmod +x scripts/generate-secrets.sh
./scripts/generate-secrets.sh
```

### Bước 5: Deploy Hệ Thống

```bash
# Cấp quyền thực thi cho scripts
chmod +x scripts/*.sh

# Khởi động hệ thống
./scripts/start.sh
```

Script `start.sh` sẽ tự động:
1. Kiểm tra Docker đang chạy
2. Dừng các container cũ (nếu có)
3. Build và khởi động tất cả services
4. Chờ services sẵn sàng
5. Hiển thị trạng thái và thông tin truy cập

### Bước 6: Kiểm Tra Database Đã Được Khởi Tạo

```bash
# Kiểm tra các bảng đã được tạo
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

### Bước 7: Kiểm Tra Hệ Thống

```bash
# Kiểm tra logs
docker-compose logs -f web

# Kiểm tra trạng thái services
docker-compose ps

# Kiểm tra health của MariaDB
docker-compose exec mariadb healthcheck.sh --connect --innodb_initialized
```

### Bước 8: Truy Cập Hệ Thống

- **Web Application:** `http://your-server-ip:2308`
- **Judge0 API:** `http://your-server-ip:2358`
- **MariaDB:** `your-server-ip:2310`

**Tài khoản admin mặc định:**
- Username: `admin`
- Password: `admin123`

**⚠️ QUAN TRỌNG:** Đổi mật khẩu admin ngay sau khi đăng nhập lần đầu!

---

## 🔄 Nếu Database Đã Tồn Tại (Server Cũ)

Nếu bạn đang deploy lên server đã có database cũ:

### Option 1: Xóa Database Cũ và Tạo Mới (Mất Dữ Liệu)

```bash
# Dừng hệ thống
docker-compose down

# Xóa volumes (bao gồm database)
docker-compose down -v

# Khởi động lại
./scripts/start.sh
```

### Option 2: Chạy Migrations Thủ Công (Giữ Dữ Liệu)

```bash
# Chạy migrations
./scripts/migrate.sh
```

Script này sẽ:
1. Kiểm tra MariaDB đang chạy
2. Chạy tất cả migrations còn thiếu
3. Bỏ qua các bảng đã tồn tại

---

## 🐛 Xử Lý Sự Cố

### Vấn đề 1: Không tải được kỳ thi

**Nguyên nhân:** Các bảng exam chưa được tạo

**Giải pháp:**
```bash
# Kiểm tra bảng
docker-compose exec mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "SHOW TABLES;"

# Nếu thiếu bảng, chạy migrations
./scripts/migrate.sh
```

### Vấn đề 2: MariaDB không khởi động

**Nguyên nhân:** Port 2310 đã được sử dụng hoặc volume bị lỗi

**Giải pháp:**
```bash
# Kiểm tra port
sudo netstat -tulpn | grep 2310

# Nếu port bị chiếm, thay đổi port trong docker-compose.yml
# Hoặc dừng service đang chiếm port

# Nếu volume bị lỗi
docker-compose down -v
docker volume prune
./scripts/start.sh
```

### Vấn đề 3: Web service không kết nối được database

**Nguyên nhân:** Biến môi trường không đúng hoặc MariaDB chưa sẵn sàng

**Giải pháp:**
```bash
# Kiểm tra logs
docker-compose logs web

# Kiểm tra biến môi trường
docker-compose exec web env | grep DB_

# Restart web service
docker-compose restart web
```

### Vấn đề 4: Judge0 không hoạt động

**Nguyên nhân:** Judge0 cần thời gian khởi động lâu

**Giải pháp:**
```bash
# Chờ thêm 2-3 phút
# Kiểm tra logs
docker-compose logs judge0-server

# Kiểm tra health
curl http://localhost:2358/about
```

---

## 📊 Monitoring và Logs

### Xem Logs Realtime

```bash
# Tất cả services
docker-compose logs -f

# Chỉ web service
docker-compose logs -f web

# Chỉ MariaDB
docker-compose logs -f mariadb

# Chỉ Judge0
docker-compose logs -f judge0-server
```

### Kiểm Tra Resource Usage

```bash
# CPU và Memory usage
docker stats

# Disk usage
docker system df
```

---

## 🔒 Bảo Mật

### 1. Đổi Mật Khẩu Admin

Sau khi đăng nhập lần đầu, vào trang quản lý người dùng và đổi mật khẩu admin.

### 2. Cấu Hình Firewall

```bash
# Chỉ mở các port cần thiết
sudo ufw allow 2308/tcp  # Web Application
sudo ufw allow 2358/tcp  # Judge0 API (nếu cần public)
sudo ufw enable
```

### 3. Sử dụng HTTPS

Khuyến nghị sử dụng reverse proxy như Nginx với Let's Encrypt SSL:

```bash
# Cài đặt Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Cấu hình Nginx reverse proxy
# Tạo file /etc/nginx/sites-available/ide-judge
```

---

## 🔄 Backup và Restore

### Backup Database

```bash
# Backup toàn bộ database
docker-compose exec mariadb mysqldump -uroot -p"${DB_PASSWORD}" ide_judge_db > backup_$(date +%Y%m%d_%H%M%S).sql

# Backup chỉ structure
docker-compose exec mariadb mysqldump -uroot -p"${DB_PASSWORD}" --no-data ide_judge_db > structure.sql
```

### Restore Database

```bash
# Restore từ backup
docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db < backup_file.sql
```

---

## 📞 Hỗ Trợ

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs: `docker-compose logs -f`
2. Kiểm tra file `.env` đã cấu hình đúng
3. Đảm bảo tất cả ports không bị chiếm bởi services khác
4. Liên hệ team support với thông tin logs chi tiết

