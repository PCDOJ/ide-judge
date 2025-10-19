# 🚀 Quick Start - IDE Judge System

## Khởi động hệ thống (1 lệnh duy nhất)

```bash
docker-compose up -d --build
```

**Chờ 2-3 phút** - Hệ thống sẽ tự động:
- ✅ Cài đặt dependencies (npm install)
- ✅ Khởi tạo database
- ✅ Chạy migrations
- ✅ Khởi động Judge0
- ✅ Khởi động web server

## Kiểm tra trạng thái

```bash
# Xem trạng thái
docker-compose ps

# Xem logs
docker-compose logs -f web
```

Khi thấy:
```
✓ Migrations completed successfully!
Server is running on port 2308
```
→ Hệ thống đã sẵn sàng!

## Truy cập

- **Web**: http://localhost:2308
- **Admin**: username `admin`, password `admin123`

## Tạo kỳ thi đầu tiên

1. Đăng nhập admin → Admin Panel → Quản lý kỳ thi
2. Tạo kỳ thi mới
3. Thêm bài thi + Upload PDF
4. Đăng ký/Tham gia với tài khoản user
5. Code và nộp bài!

## Lệnh hữu ích

```bash
# Xem logs
docker-compose logs -f

# Restart
docker-compose restart

# Dừng
docker-compose down

# Reset toàn bộ
docker-compose down -v && docker-compose up -d --build
```

## Tài liệu đầy đủ

- [README.md](README.md) - Tổng quan
- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Triển khai
- [FEATURES.md](FEATURES.md) - Tính năng

---

**Happy Coding! 🎯**

