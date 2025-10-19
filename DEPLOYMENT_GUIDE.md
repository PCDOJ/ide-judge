# Hướng dẫn Triển khai IDE Judge System

## Tổng quan

Hệ thống IDE Judge tích hợp:
- **Web Application**: Node.js + Express + MariaDB
- **IDE Judge0**: Online code editor
- **Judge0 Compiler**: Code execution engine
- **Exam System**: Quản lý kỳ thi, bài thi, nộp code

## Kiến trúc

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                        │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   MariaDB    │  │  Web Server  │  │ Judge0 Server│  │
│  │   (3307)     │  │   (2308)     │  │   (2358)     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│                           │                  │           │
│                           │                  │           │
│                    ┌──────┴──────┐    ┌──────┴──────┐  │
│                    │ PostgreSQL  │    │   Redis     │  │
│                    │  (Judge0)   │    │  (Judge0)   │  │
│                    └─────────────┘    └─────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Yêu cầu hệ thống

- Docker 20.10+
- Docker Compose 2.0+
- 4GB RAM tối thiểu (khuyến nghị 8GB)
- 10GB dung lượng ổ cứng

## Cài đặt

### 1. Clone repository

```bash
git clone <repository-url>
cd ide-judge
```

### 2. Cấu hình môi trường

Tạo file `.env` (nếu chưa có):

```bash
# Database
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=ide_judge_db

# Session
SESSION_SECRET=your-secret-key-here

# Judge0 API
JUDGE0_API_URL=http://judge0-server:2358

# Server
PORT=2308
NODE_ENV=production
```

### 3. Chạy migrations

Migrations sẽ tự động chạy khi khởi động container, nhưng bạn có thể chạy thủ công:

```bash
# Chạy migration cho exam tables
docker-compose exec mariadb mysql -uroot -prootpassword ide_judge_db < migrations/add_exam_tables.sql

# Chạy migration cho code submissions
docker-compose exec mariadb mysql -uroot -prootpassword ide_judge_db < migrations/add_code_submissions.sql
```

### 4. Khởi động hệ thống

```bash
# Build và start tất cả services
docker-compose up -d --build

# Xem logs
docker-compose logs -f

# Kiểm tra trạng thái
docker-compose ps
```

### 5. Cài đặt dependencies (nếu cần)

```bash
# Vào container web
docker-compose exec web sh

# Cài đặt dependencies
npm install

# Thoát container
exit
```

## Truy cập hệ thống

- **Web Application**: http://localhost:2308
- **Judge0 API**: http://localhost:2358
- **MariaDB**: localhost:3307

### Tài khoản mặc định

- **Admin**:
  - Username: `admin`
  - Password: `admin123`

## Tính năng chính

### 1. Quản lý Kỳ thi (Admin)

- Tạo/sửa/xóa kỳ thi
- Thêm bài thi (upload PDF đề bài)
- Quản lý thí sinh đăng ký
- Xem submissions

### 2. Tham gia Kỳ thi (User)

- Xem danh sách kỳ thi
- Đăng ký trước kỳ thi
- Tham gia kỳ thi đang diễn ra
- Xem đề bài (PDF)
- Code bài thi với IDE tích hợp

### 3. Code Editor

- **Auto-save**: Tự động lưu code mỗi 30 giây
- **Manual save**: Nút "Lưu" để lưu thủ công
- **Submit**: Nộp bài (không thể sửa sau khi nộp)
- **Auto-submit**: Tự động nộp khi hết giờ
- **Timer**: Đếm ngược thời gian còn lại
- **Split view**: Xem đề bài và code cùng lúc
- **Resize panels**: Điều chỉnh kích thước panels

### 4. Judge0 Integration

- Hỗ trợ 60+ ngôn ngữ lập trình
- Compile và run code online
- Input/Output testing
- Syntax highlighting
- Code completion

## Cấu trúc Database

### Tables

1. **users**: Người dùng (admin, user)
2. **exams**: Kỳ thi
3. **exam_problems**: Bài thi trong kỳ thi
4. **exam_registrations**: Đăng ký tham gia kỳ thi
5. **code_submissions**: Code đã lưu/nộp
6. **submission_history**: Lịch sử lưu/nộp code

## API Endpoints

### Authentication
- `POST /api/auth/register` - Đăng ký
- `POST /api/auth/login` - Đăng nhập
- `POST /api/auth/logout` - Đăng xuất
- `GET /api/auth/check-session` - Kiểm tra session

### Exam (User)
- `GET /api/user/exams` - Danh sách kỳ thi
- `GET /api/user/exams/:id` - Chi tiết kỳ thi
- `POST /api/user/exams/:id/pre-register` - Đăng ký trước
- `POST /api/user/exams/:id/join` - Tham gia kỳ thi
- `POST /api/user/exams/:id/leave` - Rời kỳ thi
- `GET /api/user/problems/:id/pdf` - Xem PDF đề bài

### Submission
- `POST /api/submission/save` - Lưu code
- `GET /api/submission/load/:examId/:problemId` - Load code đã lưu
- `POST /api/submission/submit` - Nộp bài
- `GET /api/submission/exam/:examId` - Danh sách submissions
- `POST /api/submission/auto-submit/:examId` - Tự động nộp

### Admin
- `GET /api/admin/exams` - Quản lý kỳ thi
- `POST /api/admin/exams` - Tạo kỳ thi
- `PUT /api/admin/exams/:id` - Sửa kỳ thi
- `DELETE /api/admin/exams/:id` - Xóa kỳ thi
- `POST /api/admin/exams/:id/problems` - Thêm bài thi
- `PUT /api/admin/problems/:id` - Sửa bài thi
- `DELETE /api/admin/problems/:id` - Xóa bài thi

## Troubleshooting

### 1. Judge0 không hoạt động

```bash
# Kiểm tra logs
docker-compose logs judge0-server

# Restart service
docker-compose restart judge0-server

# Kiểm tra kết nối
curl http://localhost:2358/about
```

### 2. Database connection error

```bash
# Kiểm tra MariaDB
docker-compose logs mariadb

# Restart MariaDB
docker-compose restart mariadb

# Kiểm tra kết nối
docker-compose exec mariadb mysql -uroot -prootpassword -e "SHOW DATABASES;"
```

### 3. Code không lưu được

- Kiểm tra console browser (F12)
- Kiểm tra network requests
- Kiểm tra session còn hạn không
- Kiểm tra exam đang ongoing

### 4. Port conflicts

```bash
# Thay đổi ports trong docker-compose.yml
# Ví dụ: "2308:2308" -> "3000:2308"

# Restart
docker-compose down
docker-compose up -d
```

## Backup & Restore

### Backup Database

```bash
# Backup MariaDB
docker-compose exec mariadb mysqldump -uroot -prootpassword ide_judge_db > backup.sql

# Backup Judge0 PostgreSQL
docker-compose exec judge0-db pg_dump -U judge0 judge0 > judge0_backup.sql
```

### Restore Database

```bash
# Restore MariaDB
docker-compose exec -T mariadb mysql -uroot -prootpassword ide_judge_db < backup.sql

# Restore Judge0 PostgreSQL
docker-compose exec -T judge0-db psql -U judge0 judge0 < judge0_backup.sql
```

## Production Deployment

### 1. Security

- Đổi tất cả passwords mặc định
- Sử dụng HTTPS (SSL/TLS)
- Cấu hình firewall
- Giới hạn rate limiting
- Enable CORS properly

### 2. Performance

- Tăng resources cho containers
- Sử dụng Redis cho session store
- Enable caching
- Optimize database queries
- Use CDN for static files

### 3. Monitoring

- Setup logging (ELK stack)
- Monitor resources (Prometheus + Grafana)
- Setup alerts
- Regular backups

## Support

Nếu gặp vấn đề, vui lòng:
1. Kiểm tra logs: `docker-compose logs -f`
2. Kiểm tra documentation
3. Tạo issue trên GitHub

## License

MIT License

