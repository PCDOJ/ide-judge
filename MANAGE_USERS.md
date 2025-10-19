# 👤 Hướng dẫn quản lý User với manage.py

Script `manage.py` cho phép bạn quản lý users trực tiếp qua database mà không cần giao diện web.

## 📋 Yêu cầu

- Python 3.6+
- File `.env` với cấu hình database

## 🚀 Cài đặt

### Trên VPS (Ubuntu/Debian):

```bash
# 1. Cài đặt Python3 và pip (nếu chưa có)
sudo apt update
sudo apt install -y python3 python3-pip

# 2. Cài đặt dependencies
pip3 install -r requirements-manage.txt

# Hoặc cài thủ công:
pip3 install mysql-connector-python python-dotenv bcrypt
```

### Trên máy local:

```bash
# Cài đặt dependencies
pip install -r requirements-manage.txt
```

## 📝 Cách sử dụng

### 1. Chạy script

```bash
# Trên VPS hoặc máy local
python3 manage.py
```

### 2. Menu chính

Sau khi chạy, bạn sẽ thấy menu:

```
==================================================
  IDE JUDGE - USER MANAGEMENT
==================================================
  1. Liệt kê tất cả users
  2. Tạo user mới
  3. Xóa user
  4. Đổi password
  5. Đổi vai trò (user/admin)
  0. Thoát
==================================================
```

## 🎯 Các chức năng

### 1️⃣ Liệt kê tất cả users

- Chọn `1` để xem danh sách tất cả users
- Hiển thị: ID, Họ tên, Username, Email, Vai trò, Ngày tạo

### 2️⃣ Tạo user mới

Chọn `2` và nhập thông tin:

```
Họ và tên: Nguyễn Văn A
Username: nguyenvana
Email: nguyenvana@example.com
Password: ********
Xác nhận password: ********

Chọn vai trò:
  1. User (người dùng thường)
  2. Admin (quản trị viên)
Lựa chọn (1/2): 2
```

✅ User sẽ được tạo với password đã hash bằng bcrypt

### 3️⃣ Xóa user

- Chọn `3`
- Xem danh sách users
- Nhập ID user cần xóa
- Xác nhận bằng cách gõ `yes`

⚠️ **Cảnh báo**: Không thể hoàn tác sau khi xóa!

### 4️⃣ Đổi password

- Chọn `4`
- Xem danh sách users
- Nhập ID user cần đổi password
- Nhập password mới và xác nhận

### 5️⃣ Đổi vai trò

- Chọn `5`
- Xem danh sách users
- Nhập ID user cần đổi vai trò
- Chọn vai trò mới (user/admin)

## 🔧 Sử dụng trên VPS với Docker

### ⭐ Cách 1: Chạy trực tiếp trên VPS (Khuyến nghị)

Script sẽ **tự động detect** database host và port từ Docker container!

```bash
# 1. SSH vào VPS
ssh root@your-vps-ip

# 2. Di chuyển vào thư mục project
cd /path/to/ide-judge

# 3. Cài đặt Python dependencies (chỉ cần 1 lần)
pip3 install -r requirements-manage.txt

# Hoặc cài thủ công:
pip3 install mysql-connector-python python-dotenv bcrypt

# 4. Chạy script
python3 manage.py
```

**Script sẽ tự động:**
- ✅ Phát hiện Docker container `ide-judge-mariadb`
- ✅ Lấy port mapping (ví dụ: `2310:3306`)
- ✅ Kết nối qua `localhost:2310`
- ✅ Không cần sửa file `.env`!

### Cách 2: Chạy trong Docker container

```bash
# 1. Vào container web
docker-compose exec web sh

# 2. Cài đặt Python và dependencies
apk add --no-cache python3 py3-pip
pip3 install mysql-connector-python python-dotenv bcrypt

# 3. Chạy script
python3 manage.py

# 4. Thoát container
exit
```

## 📖 Ví dụ: Tạo admin mới trên VPS

```bash
# 1. SSH vào VPS
ssh root@your-vps-ip

# 2. Di chuyển vào thư mục project
cd /path/to/ide-judge

# 3. Chạy script
python3 manage.py

# 4. Chọn option 2 (Tạo user mới)
# 5. Nhập thông tin:
Họ và tên: Admin VPS
Username: adminvps
Email: admin@yourdomain.com
Password: your-secure-password
Xác nhận password: your-secure-password
Lựa chọn (1/2): 2  # Chọn Admin

# 6. Hoàn thành! Bây giờ bạn có thể login với:
#    Username: adminvps
#    Password: your-secure-password
```

## 🔐 Bảo mật

- ✅ Password được hash bằng bcrypt với salt rounds = 10
- ✅ Password không hiển thị khi nhập (dùng getpass)
- ✅ Kết nối database qua biến môi trường (.env)
- ⚠️ Không commit file `.env` lên Git
- ⚠️ Sử dụng password mạnh cho tài khoản admin

## 🐛 Xử lý lỗi

### Lỗi: "Cannot connect to database"

```bash
# Kiểm tra file .env có đúng không
cat .env

# Kiểm tra MariaDB có chạy không
docker-compose ps mariadb

# Kiểm tra kết nối
docker-compose exec mariadb mysql -u root -p
```

### Lỗi: "Username or email already exists"

- Username hoặc email đã tồn tại trong database
- Chọn username/email khác hoặc xóa user cũ

### Lỗi: "Module not found"

```bash
# Cài lại dependencies
pip3 install -r requirements-manage.txt
```

## 💡 Tips

1. **Tạo admin đầu tiên**: Nếu không login được với admin mặc định, dùng script này để tạo admin mới
2. **Reset password**: Nếu quên password, dùng chức năng "Đổi password"
3. **Backup trước khi xóa**: Luôn backup database trước khi xóa users quan trọng
4. **Kiểm tra vai trò**: Đảm bảo có ít nhất 1 admin trong hệ thống

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. File `.env` có đúng cấu hình không
2. Database có chạy không
3. Python dependencies đã cài đủ chưa
4. Có quyền truy cập database không

---

**Happy Managing! 🎯**

