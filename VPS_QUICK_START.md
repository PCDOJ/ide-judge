# 🚀 VPS Quick Start Guide

Hướng dẫn nhanh deploy và tạo admin trên VPS.

## 📋 Yêu cầu

- VPS Ubuntu/Debian
- Docker và Docker Compose đã cài đặt
- Git đã cài đặt

## 🎯 Các bước deploy

### 1. Clone project

```bash
cd ~
git clone https://github.com/your-repo/ide-judge.git
cd ide-judge
```

### 2. Tạo file .env

```bash
# Copy từ example
cp .env.example .env

# Sửa file .env
nano .env
```

**Cấu hình tối thiểu trong .env:**

```env
# Database
DB_HOST=mariadb
DB_USER=root
DB_PASSWORD=your-strong-password-here
DB_NAME=ide_judge_db
DB_PORT=3306

# Application
SESSION_SECRET=your-session-secret-here
PORT=2308

# Judge0
POSTGRES_PASSWORD=your-postgres-password-here
```

💡 **Tip**: Dùng script tạo password mạnh:
```bash
./scripts/generate-secrets.sh
```

### 3. Deploy với Docker

```bash
# Build và start
docker-compose up -d --build

# Xem logs
docker-compose logs -f web
```

Chờ 2-3 phút cho đến khi thấy:
```
✓ Migrations completed successfully!
Server is running on port 2308
```

### 4. Kiểm tra

```bash
# Xem trạng thái containers
docker-compose ps

# Tất cả containers phải ở trạng thái "Up"
```

### 5. Truy cập

Mở trình duyệt: `http://your-vps-ip:2308`

## 👤 Tạo Admin Account

### Cách 1: Sử dụng admin mặc định

```
Username: admin
Password: admin123
```

⚠️ **Đổi password ngay sau khi login!**

### Cách 2: Tạo admin mới bằng script (Nếu không login được)

```bash
# Chạy script quản lý user
./manage-users.sh

# Hoặc:
pip3 install -r requirements-manage.txt
python3 manage.py
```

**Trong menu:**
1. Chọn `2` (Tạo user mới)
2. Nhập thông tin:
   ```
   Họ và tên: Admin VPS
   Username: adminvps
   Email: admin@yourdomain.com
   Password: [nhập password mạnh]
   Xác nhận password: [nhập lại]
   Lựa chọn (1/2): 2  ← Chọn Admin
   ```
3. ✅ Login với username `adminvps`

## 🔥 Firewall (Quan trọng!)

Mở port 2308 để truy cập từ bên ngoài:

```bash
# UFW (Ubuntu)
sudo ufw allow 2308/tcp
sudo ufw reload

# Firewalld (CentOS)
sudo firewall-cmd --permanent --add-port=2308/tcp
sudo firewall-cmd --reload

# iptables
sudo iptables -A INPUT -p tcp --dport 2308 -j ACCEPT
sudo iptables-save
```

## 🔧 Các lệnh hữu ích

### Xem logs

```bash
# Tất cả services
docker-compose logs -f

# Chỉ web service
docker-compose logs -f web

# Chỉ MariaDB
docker-compose logs -f mariadb
```

### Restart services

```bash
# Restart tất cả
docker-compose restart

# Restart web service
docker-compose restart web
```

### Stop/Start

```bash
# Stop
docker-compose down

# Start
docker-compose up -d

# Rebuild và start
docker-compose up -d --build
```

### Truy cập database

```bash
# Vào MariaDB container
docker-compose exec mariadb mysql -u root -p

# Nhập password từ .env (DB_PASSWORD)

# Trong MySQL:
USE ide_judge_db;
SHOW TABLES;
SELECT * FROM users;
```

### Backup database

```bash
# Backup
docker-compose exec mariadb mysqldump -u root -p ide_judge_db > backup.sql

# Restore
docker-compose exec -T mariadb mysql -u root -p ide_judge_db < backup.sql
```

## 🐛 Xử lý lỗi thường gặp

### Lỗi: MariaDB không khởi động

```bash
# Xem logs
docker-compose logs mariadb

# Xóa và tạo lại
docker-compose down -v
docker-compose up -d
```

### Lỗi: Port đã được sử dụng

```bash
# Kiểm tra port 2308
sudo lsof -i :2308

# Kill process đang dùng port
sudo kill -9 <PID>

# Hoặc đổi port trong .env
PORT=2309
```

### Lỗi: Không kết nối được database

```bash
# Kiểm tra MariaDB có chạy không
docker-compose ps mariadb

# Restart MariaDB
docker-compose restart mariadb

# Kiểm tra password trong .env
cat .env | grep DB_PASSWORD
```

### Lỗi: Judge0 không hoạt động

```bash
# Judge0 cần thời gian khởi động (2-3 phút)
docker-compose logs -f judge0-server

# Restart Judge0
docker-compose restart judge0-server
```

## 🔐 Bảo mật Production

### 1. Đổi tất cả passwords mặc định

- ✅ Admin password
- ✅ DB_PASSWORD
- ✅ SESSION_SECRET
- ✅ POSTGRES_PASSWORD

### 2. Cấu hình HTTPS (Khuyến nghị)

Sử dụng Nginx + Let's Encrypt:

```bash
# Cài đặt Nginx
sudo apt install nginx certbot python3-certbot-nginx

# Cấu hình reverse proxy
sudo nano /etc/nginx/sites-available/ide-judge

# Lấy SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### 3. Giới hạn truy cập

```bash
# Chỉ cho phép IP cụ thể
sudo ufw allow from YOUR_IP to any port 2308
```

### 4. Backup định kỳ

```bash
# Tạo cron job backup hàng ngày
crontab -e

# Thêm dòng:
0 2 * * * cd /root/ide-judge && docker-compose exec -T mariadb mysqldump -u root -pYOUR_PASSWORD ide_judge_db > /backup/ide-judge-$(date +\%Y\%m\%d).sql
```

## 📊 Monitoring

### Kiểm tra resource usage

```bash
# CPU, Memory
docker stats

# Disk usage
df -h
docker system df
```

### Xem số lượng users

```bash
docker-compose exec mariadb mysql -u root -p -e "SELECT COUNT(*) FROM ide_judge_db.users;"
```

## 🆘 Hỗ trợ

Nếu gặp vấn đề:

1. Xem logs: `docker-compose logs -f`
2. Kiểm tra file .env
3. Kiểm tra firewall
4. Restart services: `docker-compose restart`

---

**Happy Deploying! 🎯**

