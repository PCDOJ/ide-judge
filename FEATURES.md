# Tính năng Hệ thống IDE Judge

## 1. Hệ thống Thi Online

### 1.1 Quy trình thi

```
Đăng ký trước → Tham gia kỳ thi → Xem đề → Code bài → Lưu/Nộp → Kết thúc
```

### 1.2 Chi tiết quy trình

#### Bước 1: Đăng ký trước (Pre-register)
- Thí sinh xem danh sách kỳ thi sắp diễn ra
- Click "Đăng ký" để đăng ký trước
- Có thể hủy đăng ký trước khi kỳ thi bắt đầu

#### Bước 2: Tham gia kỳ thi (Join)
- Khi kỳ thi bắt đầu, click "Tham gia"
- Nhập access code (nếu có)
- Vào được trang xem danh sách bài thi

#### Bước 3: Xem đề bài
- Click "Xem đề" để xem PDF đề bài
- PDF hiển thị trong iframe

#### Bước 4: Code bài
- Click "Code bài này" để mở code editor
- Giao diện split view: PDF bên trái, IDE bên phải
- Có thể resize panels theo ý muốn

#### Bước 5: Lưu và Nộp
- **Auto-save**: Tự động lưu mỗi 30 giây
- **Manual save**: Click nút "Lưu" để lưu ngay
- **Submit**: Click "Nộp bài" để nộp (không thể sửa sau khi nộp)
- **Auto-submit**: Hệ thống tự động nộp khi hết giờ

#### Bước 6: Kết thúc
- Sau khi hết giờ, tất cả code draft sẽ tự động nộp
- Thí sinh có thể xem lại đề bài nhưng không thể code

## 2. Code Editor Features

### 2.1 IDE Judge0 Integration

- **Monaco Editor**: Editor chuyên nghiệp (như VS Code)
- **Syntax Highlighting**: Tô màu cú pháp cho 60+ ngôn ngữ
- **Code Completion**: Gợi ý code tự động
- **Error Detection**: Phát hiện lỗi cú pháp
- **Multiple Themes**: Light/Dark themes

### 2.2 Supported Languages

- C, C++, C#
- Java, JavaScript, TypeScript
- Python 2, Python 3
- Ruby, Rust, Go
- PHP, Perl
- Kotlin, Scala, Clojure
- Swift, Objective-C
- Haskell, OCaml, F#
- Assembly (NASM)
- SQL (SQLite)
- Bash, PowerShell
- Và nhiều ngôn ngữ khác...

### 2.3 Code Execution

- **Compile**: Biên dịch code
- **Run**: Chạy code
- **Input**: Nhập dữ liệu đầu vào
- **Output**: Xem kết quả đầu ra
- **Error**: Xem lỗi compile/runtime

### 2.4 Auto-save System

```javascript
// Auto-save flow
User types code
    ↓
Wait 30 seconds (debounce)
    ↓
Send code to server
    ↓
Save to database
    ↓
Update "Last saved" timestamp
```

### 2.5 Submit System

```javascript
// Submit flow
User clicks "Nộp bài"
    ↓
Confirm dialog
    ↓
Save current code
    ↓
Mark as "submitted"
    ↓
Disable editing
    ↓
Show success message
```

### 2.6 Auto-submit System

```javascript
// Auto-submit flow
Timer reaches 00:00:00
    ↓
Get all draft submissions
    ↓
Mark as "auto_submitted"
    ↓
Disable editing
    ↓
Show notification
```

## 3. Split View Interface

### 3.1 Layout

```
┌─────────────────────────────────────────────────┐
│  Problem Title          Timer    Save   Submit  │
├──────────────────┬──────────────────────────────┤
│                  │                              │
│   PDF Viewer     │      Code Editor             │
│   (Đề bài)       │      (IDE Judge0)            │
│                  │                              │
│                  │                              │
├──────────────────┴──────────────────────────────┤
│  Status: Connected    Last saved: 10:30:45      │
└─────────────────────────────────────────────────┘
```

### 3.2 Resize Panels

- Drag thanh giữa để điều chỉnh kích thước
- Tỷ lệ tối thiểu: 20% - 80%
- Tỷ lệ mặc định: 50% - 50%

### 3.3 Top Bar

- **Problem Title**: Tên bài thi
- **Timer**: Đếm ngược thời gian (HH:MM:SS)
- **Back**: Quay lại danh sách bài
- **Save**: Lưu code
- **Submit**: Nộp bài

### 3.4 Status Bar

- **Connection Status**: Trạng thái kết nối
- **Last Saved**: Thời gian lưu lần cuối

## 4. Database Schema

### 4.1 code_submissions

```sql
CREATE TABLE code_submissions (
    id INT PRIMARY KEY,
    user_id INT,
    exam_id INT,
    problem_id INT,
    source_code LONGTEXT,
    language_id INT,
    language_name VARCHAR(50),
    status ENUM('draft', 'submitted', 'auto_submitted'),
    submitted_at DATETIME,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### 4.2 submission_history

```sql
CREATE TABLE submission_history (
    id INT PRIMARY KEY,
    submission_id INT,
    user_id INT,
    exam_id INT,
    problem_id INT,
    source_code LONGTEXT,
    language_id INT,
    language_name VARCHAR(50),
    action_type ENUM('save', 'submit', 'auto_submit'),
    created_at TIMESTAMP
);
```

## 5. Security Features

### 5.1 Access Control

- Chỉ thí sinh đã join mới xem được đề
- Chỉ trong thời gian thi mới code được
- Không thể sửa code sau khi nộp
- Session timeout sau 24 giờ

### 5.2 Data Validation

- Validate exam_id, problem_id
- Validate user permissions
- Validate exam status (ongoing)
- Sanitize code input

### 5.3 Rate Limiting

- Giới hạn số lần save/submit
- Prevent spam requests
- Debounce auto-save

## 6. User Experience

### 6.1 Notifications

- ✅ "Code saved successfully"
- ✅ "Code submitted successfully"
- ⚠️ "Exam is ending in 5 minutes"
- ⏰ "Time's up! Auto-submitting..."
- ❌ "Cannot modify submitted code"

### 6.2 Visual Feedback

- Green dot: Connected
- Yellow dot: Saving...
- Red dot: Error
- Timer color: Red when < 5 minutes

### 6.3 Keyboard Shortcuts

- `Ctrl+S`: Save code
- `Ctrl+Enter`: Run code (in IDE)
- `Esc`: Close dialogs

## 7. Admin Features

### 7.1 Exam Management

- Create/Edit/Delete exams
- Set start/end time
- Set access code
- View registrations

### 7.2 Problem Management

- Add problems to exam
- Upload PDF files
- Set points
- Set display order

### 7.3 Submission Tracking

- View all submissions
- Filter by exam/user/problem
- Export submissions
- View submission history

## 8. Technical Stack

### 8.1 Frontend

- HTML5, CSS3, JavaScript
- Bootstrap 5
- Monaco Editor
- PDF.js (for PDF viewing)

### 8.2 Backend

- Node.js + Express
- MariaDB (main database)
- PostgreSQL (Judge0)
- Redis (Judge0 queue)

### 8.3 Services

- Judge0 CE (Code Execution)
- Docker + Docker Compose
- Nginx (optional, for production)

## 9. Performance

### 9.1 Optimization

- Debounced auto-save (30s)
- Lazy loading PDF
- Code minification
- Gzip compression

### 9.2 Scalability

- Horizontal scaling with load balancer
- Database replication
- Redis caching
- CDN for static files

## 10. Future Enhancements

### 10.1 Planned Features

- [ ] Test cases for problems
- [ ] Automatic grading
- [ ] Plagiarism detection
- [ ] Code review by admin
- [ ] Real-time leaderboard
- [ ] Discussion forum
- [ ] Video tutorials
- [ ] Mobile app

### 10.2 Improvements

- [ ] Better error messages
- [ ] More keyboard shortcuts
- [ ] Customizable themes
- [ ] Code templates
- [ ] Snippet library
- [ ] Collaborative coding
- [ ] Live chat support

