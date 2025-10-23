# Workspace Setup Guide

## Tổng quan

Hệ thống workspace cho phép thí sinh:
- ✅ Tạo nhiều file code trong cùng 1 bài
- ✅ Sử dụng terminal để compile và test
- ✅ Auto-save mỗi 5 phút
- ✅ LocalStorage với TTL 7 ngày
- ✅ 1 container code-server duy nhất cho tất cả users (tiết kiệm tài nguyên)

## Kiến trúc

```
┌─────────────────────────────────────────────────────────────┐
│                        Docker Compose                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   MariaDB    │  │  Judge0 API  │  │ Code-Server  │      │
│  │              │  │              │  │ (1 instance) │      │
│  │  - Users     │  │  - Single    │  │              │      │
│  │  - Exams     │  │    file      │  │  - Multi     │      │
│  │  - Workspace │  │    compile   │  │    file      │      │
│  │    Sessions  │  │              │  │  - Terminal  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Node.js Web Server                       │   │
│  │  - Routes: /api/workspace/*                          │   │
│  │  - Proxy: /code-server -> code-server:8080          │   │
│  │  - Scheduler: Cleanup expired workspaces (daily)    │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
└─────────────────────────────────────────────────────────────┘

Workspace Structure:
/workspace/
  ├── {username}/
  │   ├── contest_{id}/
  │   │   ├── problem_{id}/
  │   │   │   ├── PROB001.cpp  (main file)
  │   │   │   ├── utils.cpp
  │   │   │   ├── utils.h
  │   │   │   └── README.md
```

## Build và Deploy

### 1. Cấu hình Environment

Copy `.env.example` thành `.env`:

```bash
cp .env.example .env
```

Chỉnh sửa `.env`:

```env
# Database
DB_PASSWORD=your_strong_password
DB_NAME=ide_judge_db

# Session
SESSION_SECRET=your_secret_key_change_this

# Judge0
POSTGRES_PASSWORD=your_postgres_password

# Workspace
WORKSPACE_ROOT=/workspace
CODE_SERVER_URL=http://code-server:8080
```

### 2. Build và Start

**Lần đầu tiên hoặc khi có thay đổi:**

```bash
# Stop và xóa volumes cũ (nếu cần)
docker-compose down -v

# Build lại tất cả services
docker-compose up -d --build
```

**Chỉ restart:**

```bash
docker-compose restart
```

### 3. Kiểm tra Services

```bash
# Xem logs
docker-compose logs -f

# Kiểm tra status
docker-compose ps

# Kiểm tra code-server
curl http://localhost:8080/healthz
```

### 4. Verify Database Migration

```bash
# Vào container web
docker exec -it ide-judge-web bash

# Kiểm tra tables
mysql -h mariadb -u root -p ide_judge_db -e "SHOW TABLES LIKE 'workspace%';"

# Kết quả mong đợi:
# workspace_sessions
# workspace_files
# workspace_sync_log
```

## Sử dụng

### 1. Thí sinh làm bài với Judge0 (Single file)

1. Vào trang thi: `/exam-detail.html?id={examId}`
2. Click vào bài tập
3. Code trong Judge0 IDE (như cũ)
4. Hệ thống auto-save mỗi 5 phút

### 2. Thí sinh làm bài với Workspace (Multi-file + Terminal)

1. Vào trang thi: `/exam-detail.html?id={examId}`
2. Click vào bài tập
3. Click nút **"Workspace"** (màu xanh lá)
4. Confirm chuyển sang workspace mode
5. Hệ thống sẽ:
   - Tạo workspace folder: `{username}/contest_{id}/problem_{id}/`
   - Tạo file chính: `PROB001.cpp` (hoặc .py, .java tùy ngôn ngữ)
   - Load code-server IDE
   - Auto-save mỗi 5 phút

### 3. Tính năng Workspace

**Auto-save:**
- Mỗi 5 phút tự động sync files lên server
- LocalStorage lưu 7 ngày
- Có thể bấm nút "Lưu" để save thủ công

**Multi-file:**
- Tạo nhiều file: `.cpp`, `.h`, `.py`, `.java`, etc.
- File chính phải có tên theo mã bài (VD: `PROB001.cpp`)

**Terminal:**
- Compile: `g++ PROB001.cpp -o PROB001`
- Run: `./PROB001`
- Test với input: `./PROB001 < input.txt`

**Submit:**
- Click nút "Nộp bài"
- Hệ thống sync tất cả files
- Lưu vào database dưới dạng JSON

## API Endpoints

### POST /api/workspace/create
Tạo hoặc lấy workspace session

**Request:**
```json
{
  "contestId": 1,
  "problemId": 5
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": 123,
    "workspacePath": "user123/contest_1/problem_5"
  }
}
```

### POST /api/workspace/sync
Sync files từ code-server vào database

**Request:**
```json
{
  "sessionId": 123,
  "contestId": 1,
  "problemId": 5
}
```

**Response:**
```json
{
  "success": true,
  "filesCount": 3,
  "totalSize": 1024
}
```

### GET /api/workspace/files/:contestId/:problemId
Lấy danh sách files

**Response:**
```json
{
  "success": true,
  "files": [
    {
      "file_name": "PROB001.cpp",
      "file_size": 512,
      "is_main_file": true
    }
  ]
}
```

### POST /api/workspace/submit
Submit code

**Request:**
```json
{
  "sessionId": 123,
  "contestId": 1,
  "problemId": 5
}
```

**Response:**
```json
{
  "success": true,
  "filesCount": 3,
  "mainFile": "PROB001.cpp"
}
```

## Cleanup và Maintenance

### Auto Cleanup (Scheduler)

Hệ thống tự động cleanup mỗi ngày lúc 2h sáng:

1. **Soft delete:** Mark `is_active = FALSE` cho sessions hết hạn
2. **Hard delete:** Xóa sessions đã soft delete > 30 ngày
3. **Filesystem:** Xóa folders tương ứng

### Manual Cleanup

```bash
# Vào container web
docker exec -it ide-judge-web bash

# Chạy cleanup manually
node -e "
const workspaceManager = require('./utils/workspace-manager');
workspaceManager.cleanupExpiredWorkspaces().then(() => {
  console.log('Cleanup completed');
  process.exit(0);
});
"
```

## Troubleshooting

### Code-server không load

```bash
# Kiểm tra logs
docker-compose logs code-server

# Restart code-server
docker-compose restart code-server

# Kiểm tra port
curl http://localhost:8080/healthz
```

### Workspace không tạo được

```bash
# Kiểm tra permissions
docker exec -it ide-judge-code-server ls -la /workspace

# Fix permissions
docker exec -it ide-judge-code-server chown -R coder:coder /workspace
```

### Migration không chạy

```bash
# Xem logs
docker-compose logs web | grep migration

# Chạy lại migration manually
docker exec -it ide-judge-web bash
mysql -h mariadb -u root -p ide_judge_db < /app/migrations/07-add_workspace_management.sql
```

## Performance

### Tài nguyên sử dụng

- **Judge0 mode:** ~100MB RAM/user (nếu mỗi user 1 container)
- **Workspace mode:** ~500MB RAM total (1 container cho tất cả users)
- **Tiết kiệm:** 100 users = 10GB → 500MB (giảm 95%)

### Giới hạn

- **Max concurrent users:** Phụ thuộc vào RAM server
- **Recommended:** 4GB RAM = ~100 concurrent users
- **Storage:** ~10MB/user/contest (tùy số files)

## Security

- ✅ Authentication: Session-based
- ✅ Authorization: Chỉ truy cập workspace của mình
- ✅ Isolation: Filesystem-based (mỗi user 1 folder)
- ✅ Auto-cleanup: Xóa data sau 7 ngày
- ✅ No shell escape: Code-server chạy trong Docker container

## Next Steps

1. ✅ Tích hợp Judge0 grading vào workspace submissions
2. ✅ Add syntax highlighting cho nhiều ngôn ngữ
3. ✅ Add code templates cho từng ngôn ngữ
4. ✅ Add file size limits
5. ✅ Add rate limiting cho sync API

