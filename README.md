# IDE Judge - Hệ thống Thi Lập trình Online

Hệ thống thi lập trình online hoàn chỉnh với IDE tích hợp, tự động chấm bài, quản lý kỳ thi, được xây dựng với Node.js, Express, MariaDB, Judge0 và Bootstrap.

## 🚀 Tính năng chính

### 👥 Quản lý người dùng
- ✅ Đăng ký/Đăng nhập/Đăng xuất
- ✅ Phân quyền Admin và User
- ✅ Quản lý profile

### 📝 Hệ thống thi
- ✅ Tạo và quản lý kỳ thi
- ✅ Upload đề bài (PDF)
- ✅ Đăng ký trước kỳ thi
- ✅ Tham gia kỳ thi với access code
- ✅ Xem đề bài trong kỳ thi
- ✅ Timer đếm ngược thời gian

### 💻 Code Editor
- ✅ IDE Judge0 tích hợp (Monaco Editor)
- ✅ Hỗ trợ 60+ ngôn ngữ lập trình
- ✅ Syntax highlighting & Code completion
- ✅ Split view: Đề bài + Code editor
- ✅ Auto-save code mỗi 30 giây
- ✅ Manual save & Submit
- ✅ Auto-submit khi hết giờ
- ✅ Compile và run code online

### 🔧 Hệ thống
- ✅ Docker containerization
- ✅ Judge0 CE integration
- ✅ MariaDB + PostgreSQL + Redis
- ✅ Responsive UI với Bootstrap 5
- ✅ Session management & Security

## 📋 Yêu cầu hệ thống

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM tối thiểu (khuyến nghị 8GB)
- 10GB dung lượng ổ cứng
- Ports: 2308, 2358, 3307 phải trống

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

### Cách 1: Sử dụng script (Khuyến nghị)

```bash
# Clone dự án
cd ide-judge

# Cấu hình môi trường
cp .env.example .env
# Chỉnh sửa .env nếu cần

# Cài đặt dependencies
npm install

# Khởi động hệ thống
chmod +x scripts/*.sh
./scripts/start.sh

# Chạy migrations
./scripts/migrate.sh
```

### Cách 2: Thủ công với Docker Compose

```bash
# Clone dự án
cd ide-judge

# Cấu hình môi trường
cp .env.example .env

# Cài đặt dependencies
npm install

# Build và start containers
docker-compose up -d --build

# Chạy migrations (tự động chạy khi start, hoặc chạy thủ công)
# Lưu ý: Thay YOUR_PASSWORD bằng password trong file .env
docker-compose exec -T mariadb mysql -uroot -pYOUR_PASSWORD ide_judge_db < migrations/add_exam_tables.sql
docker-compose exec -T mariadb mysql -uroot -pYOUR_PASSWORD ide_judge_db < migrations/add_code_submissions.sql

# Kiểm tra containers
docker-compose ps
```

### 3. Truy cập ứng dụng

- **Web Application**: http://localhost:2308
- **Judge0 API**: http://localhost:2358

## 👤 Tài khoản mặc định

### Admin Account
- **Username:** admin
- **Password:** admin123
- **Email:** admin@example.com

**⚠️ Lưu ý**: Đổi password ngay sau khi đăng nhập lần đầu trong môi trường production!

## 📱 Các trang trong ứng dụng

### Public Pages (Không cần đăng nhập)
- `/login.html` - Trang đăng nhập
- `/register.html` - Trang đăng ký

### Protected Pages (Cần đăng nhập)
- `/index.html` - Trang chủ
- `/exams.html` - Danh sách kỳ thi
- `/exam-view.html` - Xem chi tiết kỳ thi và đề bài
- `/exam-code.html` - Code editor (split view)

### Admin Only Pages
- `/admin/index.html` - Admin Dashboard
- `/admin/users.html` - Quản lý người dùng
- `/admin/exams.html` - Quản lý kỳ thi

## 🔌 API Endpoints

### Authentication APIs
- `POST /api/auth/register` - Đăng ký tài khoản mới
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/check-session` - Kiểm tra session

### User APIs (Cần authentication)
- `GET /api/user/profile` - Lấy thông tin profile
- `PUT /api/user/profile` - Cập nhật profile
- `GET /api/user/exams` - Danh sách kỳ thi
- `GET /api/user/exams/:id` - Chi tiết kỳ thi
- `POST /api/user/exams/:id/pre-register` - Đăng ký trước
- `POST /api/user/exams/:id/join` - Tham gia kỳ thi
- `POST /api/user/exams/:id/leave` - Rời kỳ thi
- `GET /api/user/problems/:id/pdf` - Xem PDF đề bài

### Submission APIs (Cần authentication)
- `POST /api/submission/save` - Lưu code
- `GET /api/submission/load/:examId/:problemId` - Load code đã lưu
- `POST /api/submission/submit` - Nộp bài
- `GET /api/submission/exam/:examId` - Danh sách submissions
- `POST /api/submission/auto-submit/:examId` - Tự động nộp

### Admin APIs (Chỉ admin)
- `GET /api/admin/users` - Lấy danh sách tất cả users
- `GET /api/admin/users/:id` - Lấy thông tin user theo ID
- `POST /api/admin/users` - Tạo user mới
- `PUT /api/admin/users/:id` - Cập nhật user
- `DELETE /api/admin/users/:id` - Xóa user
- `GET /api/admin/stats` - Lấy thống kê
- `GET /api/admin/exams` - Quản lý kỳ thi
- `POST /api/admin/exams` - Tạo kỳ thi
- `PUT /api/admin/exams/:id` - Sửa kỳ thi
- `DELETE /api/admin/exams/:id` - Xóa kỳ thi
- `POST /api/admin/exams/:id/problems` - Thêm bài thi
- `PUT /api/admin/problems/:id` - Sửa bài thi
- `DELETE /api/admin/problems/:id` - Xóa bài thi

## 🗄️ Database Schema

### Main Tables

1. **users** - Người dùng (admin, user)
2. **exams** - Kỳ thi
3. **exam_problems** - Bài thi trong kỳ thi
4. **exam_registrations** - Đăng ký tham gia kỳ thi
5. **code_submissions** - Code đã lưu/nộp
6. **submission_history** - Lịch sử lưu/nộp code

Chi tiết schema xem trong các file migration:
- `init.sql` - Users table
- `migrations/add_exam_tables.sql` - Exam tables
- `migrations/add_code_submissions.sql` - Submission tables

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
# Password: Nhập password từ file .env (DB_PASSWORD)
```

## 🔐 Bảo mật

- Mật khẩu được hash bằng bcrypt với salt rounds = 10
- Session được quản lý bằng express-session
- Middleware kiểm tra authentication và authorization
- Input validation cho tất cả API endpoints
- SQL injection prevention với prepared statements

## 🎨 Công nghệ sử dụng

### Backend
- Node.js + Express.js
- MySQL2 (MariaDB driver)
- bcryptjs (password hashing)
- express-session (session management)
- http-proxy-middleware (Judge0 proxy)
- multer (file upload)
- body-parser
- dotenv

### Frontend
- HTML5, CSS3, JavaScript
- Bootstrap 5.3
- Bootstrap Icons
- Monaco Editor (IDE)
- PDF.js (PDF viewer)

### Database
- MariaDB (main database)
- PostgreSQL (Judge0)
- Redis (Judge0 queue)

### Services
- Judge0 CE 1.13.0 (Code Execution Engine)

### DevOps
- Docker + Docker Compose
- Multi-container architecture

## 📝 Ghi chú

1. **Port Configuration:**
   - Web Application: 2308
   - Judge0 API: 2358
   - MariaDB: 3307 (external), 3306 (internal)

2. **Environment Variables:**
   - Tất cả cấu hình trong file `.env`
   - Copy từ `.env.example` và chỉnh sửa
   - Đổi passwords trong production

3. **Database:**
   - MariaDB: Main application database
   - PostgreSQL: Judge0 database
   - Redis: Judge0 queue
   - Data được lưu trong Docker volumes

4. **Judge0:**
   - Có thể mất vài phút để khởi động lần đầu
   - Kiểm tra: `curl http://localhost:2358/about`
   - Hỗ trợ 60+ ngôn ngữ lập trình

5. **Development:**
   - Code changes sẽ tự động sync vào container
   - Cần restart container để áp dụng thay đổi backend
   - Frontend changes không cần restart

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

## � Tài liệu bổ sung

- **[START_HERE.md](START_HERE.md)** - ⭐ Bắt đầu nhanh trong 5 phút
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Hướng dẫn triển khai chi tiết
- [FEATURES.md](FEATURES.md) - Mô tả chi tiết các tính năng

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## �📄 License

MIT License

## 👨‍💻 Author

Developed for IDE Judge Project

---

**⭐ Nếu project hữu ích, hãy cho một star nhé!**

