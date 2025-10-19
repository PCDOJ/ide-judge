# IDE Judge - Hệ thống Đăng ký/Đăng nhập với Phân quyền

Ứng dụng web hoàn chỉnh với chức năng đăng ký, đăng nhập, phân quyền Admin/User, được xây dựng với Node.js, Express, MariaDB và Bootstrap.

## 🚀 Tính năng

- ✅ Đăng ký tài khoản mới
- ✅ Đăng nhập/Đăng xuất
- ✅ Phân quyền Admin và User
- ✅ Admin Panel với các chức năng:
  - Xem thống kê người dùng
  - Quản lý người dùng (CRUD)
  - Dashboard với số liệu thống kê
- ✅ Giao diện responsive với Bootstrap 5
- ✅ Bảo mật với bcrypt cho mật khẩu
- ✅ Session management
- ✅ Docker containerization
- ✅ MariaDB database

## 📋 Yêu cầu hệ thống

- Docker
- Docker Compose
- Port 2308 và 3307 phải trống

## 🛠️ Cấu trúc dự án

```
ide-judge/
├── docker-compose.yml          # Cấu hình Docker Compose
├── Dockerfile                  # Dockerfile cho ứng dụng web
├── package.json                # Dependencies Node.js
├── server.js                   # Server chính
├── .env                        # Biến môi trường
├── init.sql                    # Script khởi tạo database
├── config/
│   └── database.js            # Cấu hình kết nối database
├── middleware/
│   └── auth.js                # Middleware xác thực và phân quyền
├── routes/
│   ├── auth.js                # API routes cho authentication
│   ├── user.js                # API routes cho user
│   └── admin.js               # API routes cho admin
└── public/
    ├── login.html             # Trang đăng nhập
    ├── register.html          # Trang đăng ký
    ├── index.html             # Trang chủ (user/admin)
    ├── admin/
    │   ├── index.html         # Admin dashboard
    │   └── users.html         # Quản lý người dùng
    └── js/
        └── admin-users.js     # JavaScript cho quản lý users
```

## 🚀 Hướng dẫn cài đặt và chạy

### 1. Clone hoặc tải dự án

```bash
cd ide-judge
```

### 2. Chạy ứng dụng với Docker

```bash
# Build và start containers
docker-compose up -d

# Hoặc rebuild nếu có thay đổi
docker-compose up -d --build
```

### 3. Kiểm tra containers đang chạy

```bash
docker-compose ps
```

### 4. Truy cập ứng dụng

Mở trình duyệt và truy cập: **http://localhost:2308**

## 👤 Tài khoản mặc định

### Admin Account
- **Username:** admin
- **Password:** admin123
- **Email:** admin@example.com

## 📱 Các trang trong ứng dụng

### Public Pages (Không cần đăng nhập)
- `/login.html` - Trang đăng nhập
- `/register.html` - Trang đăng ký

### Protected Pages (Cần đăng nhập)
- `/index.html` - Trang chủ (cho cả user và admin)

### Admin Only Pages
- `/admin/index.html` - Admin Dashboard
- `/admin/users.html` - Quản lý người dùng

## 🔌 API Endpoints

### Authentication APIs
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/check-session` - Kiểm tra session

### User APIs (Cần authentication)
- `GET /api/user/profile` - Lấy thông tin profile
- `PUT /api/user/profile` - Cập nhật profile

### Admin APIs (Chỉ admin)
- `GET /api/admin/users` - Lấy danh sách tất cả users
- `GET /api/admin/users/:id` - Lấy thông tin user theo ID
- `POST /api/admin/users` - Tạo user mới
- `PUT /api/admin/users/:id` - Cập nhật user
- `DELETE /api/admin/users/:id` - Xóa user
- `GET /api/admin/stats` - Lấy thống kê

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

## 🔧 Các lệnh Docker hữu ích

```bash
# Xem logs
docker-compose logs -f

# Xem logs của service cụ thể
docker-compose logs -f web
docker-compose logs -f mariadb

# Dừng containers
docker-compose down

# Dừng và xóa volumes (xóa dữ liệu database)
docker-compose down -v

# Restart containers
docker-compose restart

# Truy cập vào container
docker-compose exec web sh
docker-compose exec mariadb bash

# Truy cập MariaDB
docker-compose exec mariadb mysql -u root -p
# Password: rootpassword
```

## 🔐 Bảo mật

- Mật khẩu được hash bằng bcrypt với salt rounds = 10
- Session được quản lý bằng express-session
- Middleware kiểm tra authentication và authorization
- Input validation cho tất cả API endpoints
- SQL injection prevention với prepared statements

## 🎨 Công nghệ sử dụng

### Backend
- Node.js
- Express.js
- MySQL2 (MariaDB driver)
- bcryptjs
- express-session
- body-parser
- dotenv

### Frontend
- HTML5
- CSS3
- Bootstrap 5.3
- Bootstrap Icons
- Vanilla JavaScript

### Database
- MariaDB (latest)

### DevOps
- Docker
- Docker Compose

## 📝 Ghi chú

1. **Port Configuration:**
   - Web Application: 2308
   - MariaDB: 3307 (external), 3306 (internal)

2. **Environment Variables:**
   - Tất cả cấu hình trong file `.env`
   - Có thể thay đổi SESSION_SECRET trong production

3. **Database:**
   - Database tự động được khởi tạo khi start container lần đầu
   - Data được lưu trong Docker volume `mariadb_data`

4. **Development:**
   - Code changes sẽ tự động sync vào container
   - Cần restart container để áp dụng thay đổi backend

## 🐛 Troubleshooting

### Port đã được sử dụng
```bash
# Kiểm tra port đang sử dụng
lsof -i :2308
lsof -i :3307

# Kill process nếu cần
kill -9 <PID>
```

### Database connection error
```bash
# Kiểm tra MariaDB container
docker-compose logs mariadb

# Restart MariaDB
docker-compose restart mariadb
```

### Reset database
```bash
# Xóa volume và rebuild
docker-compose down -v
docker-compose up -d --build
```

## 📄 License

MIT License

## 👨‍💻 Author

Developed for IDE Judge Project

