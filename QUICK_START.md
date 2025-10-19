# Hướng dẫn nhanh - IDE Judge Auth System

## 🚀 Khởi động nhanh

### 1. Start ứng dụng
```bash
docker-compose up -d --build
```

### 2. Truy cập ứng dụng
Mở trình duyệt và truy cập: **http://localhost:2308**

## 👤 Tài khoản mặc định

### Admin
- **Username:** admin
- **Password:** admin123
- **Quyền:** Toàn quyền quản trị

### Test User (đã tạo sẵn)
- **Username:** testuser
- **Password:** test123
- **Quyền:** Người dùng thường

## 📱 Các trang chính

1. **Trang đăng nhập:** http://localhost:2308/login.html
2. **Trang đăng ký:** http://localhost:2308/register.html
3. **Trang chủ:** http://localhost:2308/index.html (cần đăng nhập)
4. **Admin Dashboard:** http://localhost:2308/admin/index.html (chỉ admin)
5. **Quản lý Users:** http://localhost:2308/admin/users.html (chỉ admin)

## ✨ Tính năng chính

### Cho tất cả người dùng:
- ✅ Đăng ký tài khoản mới (với họ và tên)
- ✅ Đăng nhập/Đăng xuất
- ✅ Xem thông tin cá nhân (bao gồm họ và tên)
- ✅ Giao diện responsive (mobile-friendly)

### Chỉ dành cho Admin:
- ✅ Xem dashboard với thống kê
- ✅ Quản lý người dùng (CRUD)
- ✅ Thay đổi vai trò người dùng
- ✅ Xóa người dùng

## 🔧 Lệnh Docker hữu ích

```bash
# Xem logs
docker-compose logs -f

# Dừng ứng dụng
docker-compose down

# Restart
docker-compose restart

# Xóa toàn bộ (bao gồm database)
docker-compose down -v
```

## 🐛 Khắc phục sự cố

### Lỗi kết nối database
```bash
docker-compose restart mariadb
docker-compose restart web
```

### Reset database
```bash
docker-compose down -v
docker-compose up -d --build
```

### Kiểm tra logs
```bash
docker-compose logs web
docker-compose logs mariadb
```

## 📝 Ghi chú quan trọng

1. **Port:** Ứng dụng chạy trên port **2308**
2. **Database:** MariaDB chạy trên port **3307** (external)
3. **Session:** Sử dụng MemoryStore (chỉ phù hợp cho development)
4. **Bảo mật:** Mật khẩu được hash bằng bcrypt

## 🎯 Hướng dẫn test

### Test đăng ký:
1. Truy cập http://localhost:2308/register.html
2. Điền thông tin và đăng ký
3. Sẽ được chuyển đến trang đăng nhập

### Test đăng nhập:
1. Truy cập http://localhost:2308/login.html
2. Đăng nhập với tài khoản admin hoặc user
3. Sẽ được chuyển đến trang chủ

### Test Admin Panel:
1. Đăng nhập với tài khoản admin
2. Click vào "Admin Panel" trên navbar
3. Thử các chức năng quản lý user

## 📞 Hỗ trợ

Nếu gặp vấn đề, vui lòng kiểm tra:
1. Docker đang chạy
2. Port 2308 và 3307 không bị chiếm
3. Logs của containers

