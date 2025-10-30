# Tính năng Compile và Run Code trong Workspace

## 📋 Tổng quan

Tài liệu này mô tả tính năng compile và run code trực tiếp trong workspace VSCode, bao gồm:
- VSCode Tasks với phím tắt
- Auto-run script tự động detect ngôn ngữ
- Nút "Run Code" trong UI với C++ version selector
- Auto-detect ngôn ngữ khi save/submit

## 🎯 Tính năng đã triển khai

### 1. VSCode Tasks (Giải pháp 2)

**File:** `templates/vscode-tasks.json`

**Tính năng:**
- ✅ Build C++ với 4 phiên bản: C++14, C++17, C++20, C++23
- ✅ Build and Run C++ với tất cả phiên bản
- ✅ Run Python
- ✅ Compile và Run Java
- ✅ Auto-detect task

**Phím tắt:**
- `Ctrl+Shift+B`: Build code
- `Ctrl+Shift+P` → "Run Task": Chọn task cụ thể

**Compiler flags:**
- `-std=c++XX`: Chọn phiên bản C++
- `-Wall -Wextra`: Hiển thị tất cả warnings
- `-O2`: Optimization level 2

### 2. Auto-run Script

**File:** `templates/auto-run.sh`

**Tính năng:**
- ✅ Tự động detect ngôn ngữ từ extension
- ✅ Compile và run với một lệnh
- ✅ Hỗ trợ input từ file `input.txt`
- ✅ Hiển thị output đẹp với màu sắc
- ✅ Tự động cleanup file executable

**Ngôn ngữ hỗ trợ:**
- C++ (.cpp, .cc, .cxx)
- C (.c)
- Python (.py)
- Java (.java)
- Go (.go)
- Rust (.rs)
- JavaScript (.js)

**Cách dùng:**
```bash
# C++ với version cụ thể
./.vscode/auto-run.sh solution.cpp c++20

# Python
./.vscode/auto-run.sh solution.py

# Java
./.vscode/auto-run.sh Solution.java
```

### 3. Nút "Run Code" trong UI

**File:** `public/workspace-demo.html`

**Tính năng:**
- ✅ Nút "Run Code" màu xanh lá trên toolbar
- ✅ Modal hiển thị ngôn ngữ được detect
- ✅ C++ version selector (C++14, C++17, C++20, C++23)
- ✅ Hướng dẫn chạy code trong terminal
- ✅ Auto-detect ngôn ngữ từ file chính

**UI Components:**
- Button "Run Code" với icon play
- Bootstrap modal với form select
- Notification hướng dẫn user

### 4. Auto-detect Language

**File:** `routes/workspace.js`, `utils/workspace-manager.js`

**Tính năng:**
- ✅ Detect ngôn ngữ từ extension của file chính
- ✅ File chính = file có tên bắt đầu bằng problem code
- ✅ Lưu language_id và language_name vào database
- ✅ Hỗ trợ đổi ngôn ngữ (đổi file .cpp → .py)

**Language mapping:**
```javascript
{
    'cpp': { id: 54, name: 'C++' },
    'c': { id: 50, name: 'C' },
    'py': { id: 71, name: 'Python' },
    'java': { id: 62, name: 'Java' },
    'js': { id: 63, name: 'JavaScript' },
    'go': { id: 60, name: 'Go' },
    'rs': { id: 73, name: 'Rust' }
}
```

### 5. Workspace Manager Updates

**File:** `utils/workspace-manager.js`

**Tính năng:**
- ✅ Tự động tạo `.vscode/tasks.json` khi init workspace
- ✅ Tự động tạo `.vscode/auto-run.sh` với quyền execute
- ✅ Tạo file `input.txt` mẫu
- ✅ README.md với hướng dẫn đầy đủ

**Workflow:**
1. User mở workspace
2. System tạo folder `.vscode/`
3. Copy `tasks.json` từ template
4. Copy `auto-run.sh` từ template và chmod +x
5. Tạo `input.txt` và `README.md`

### 6. README Template

**File:** `utils/workspace-manager.js` (getReadmeTemplate)

**Nội dung:**
- 📄 Hướng dẫn xem đề bài
- 🚀 3 phương pháp compile và run:
  - VSCode Tasks (phím tắt)
  - Terminal (lệnh thủ công)
  - Auto-run script
- 📝 Hướng dẫn test với input.txt
- 💾 Hướng dẫn save và submit
- 📌 Lưu ý về file chính và ngôn ngữ

## 📁 Cấu trúc File

```
ide-judge/
├── templates/
│   ├── vscode-tasks.json          # VSCode tasks template
│   ├── auto-run.sh                # Auto-run script template
│   └── test-samples/              # Sample code for testing
│       ├── PROB001.cpp
│       ├── PROB001.py
│       ├── PROB001.java
│       └── input.txt
├── utils/
│   └── workspace-manager.js       # Updated with auto-create logic
├── routes/
│   └── workspace.js               # Updated with language detection
├── public/
│   └── workspace-demo.html        # Updated with Run Code button
├── TESTING_GUIDE.md               # Hướng dẫn test chi tiết
└── FEATURE_COMPILE_RUN_CODE.md    # Tài liệu này
```

## 🔄 Workflow

### Khi user mở workspace:

1. **Init workspace** (`/api/workspace/create`)
   - Tạo session
   - Tạo folder structure
   - Copy templates (tasks.json, auto-run.sh)
   - Tạo README.md và input.txt
   - Tạo file chính (mặc định .cpp)

2. **User viết code**
   - Có thể đổi extension (cpp → py → java)
   - File chính phải có tên = problem code

3. **User compile và run**
   - **Option 1:** Dùng VSCode Tasks (Ctrl+Shift+B)
   - **Option 2:** Dùng Terminal với auto-run.sh
   - **Option 3:** Click nút "Run Code" → Xem hướng dẫn

4. **User save code** (`/api/workspace/save-code`)
   - Sync files to database
   - Detect language từ main file
   - Lưu vào code_submissions với language_id/name

5. **User submit** (`/api/workspace/submit`)
   - Tương tự save nhưng mark status = 'submitted'

## 🎨 UI/UX

### Toolbar

```
[← Quay lại] [PROB001 - Tổng hai số]     [⏰ 01:23:45] [📄 Đề bài] [▶ Run Code] [💾 Lưu] [📤 Nộp bài]
```

### Run Code Modal

```
┌─────────────────────────────────────┐
│ ▶ Run Code                      [X] │
├─────────────────────────────────────┤
│ Detected Language: C++              │
│                                     │
│ C++ Version:                        │
│ [C++20 (Default)        ▼]         │
│                                     │
│ ℹ Code sẽ được compile và run      │
│   trong VSCode terminal.            │
│   Vui lòng kiểm tra terminal.      │
├─────────────────────────────────────┤
│              [Hủy]  [▶ Run]        │
└─────────────────────────────────────┘
```

## 🧪 Testing

Xem file `TESTING_GUIDE.md` để biết chi tiết cách test.

**Quick test:**
```bash
# 1. Khởi động hệ thống
docker-compose up -d

# 2. Truy cập workspace
# http://localhost:2308

# 3. Mở terminal trong VSCode
# Ctrl+`

# 4. Test auto-run
./.vscode/auto-run.sh PROB001.cpp c++20

# 5. Kiểm tra output
# Expected: 8 (nếu input.txt = "5 3")
```

## 📊 Metrics

**Files created:** 8
- templates/vscode-tasks.json
- templates/auto-run.sh
- templates/test-samples/* (4 files)
- TESTING_GUIDE.md
- FEATURE_COMPILE_RUN_CODE.md

**Files modified:** 3
- utils/workspace-manager.js
- routes/workspace.js (đã có sẵn logic, không cần sửa)
- public/workspace-demo.html

**Lines of code:** ~800 lines
- vscode-tasks.json: ~200 lines
- auto-run.sh: ~250 lines
- workspace-manager.js: ~100 lines (added)
- workspace-demo.html: ~150 lines (added)
- Documentation: ~100 lines

## 🚀 Deployment

**Không cần restart server!**

Các file template sẽ được copy vào workspace khi user mở workspace lần đầu hoặc khi workspace được recreate.

**Nếu muốn apply cho workspace đã tồn tại:**

```bash
# SSH vào container
docker exec -it ide-judge-code-server bash

# Vào workspace cụ thể
cd /workspace/username/contest_1/problem_1

# Copy templates
cp /app/templates/vscode-tasks.json .vscode/tasks.json
cp /app/templates/auto-run.sh .vscode/auto-run.sh
chmod +x .vscode/auto-run.sh
```

## 🔐 Security

**Auto-run script:**
- ✅ Chỉ chạy trong workspace của user
- ✅ Không có sudo/root access
- ✅ Timeout và resource limits từ Docker
- ✅ Isolated trong container

**VSCode Tasks:**
- ✅ Chạy trong user context
- ✅ Không có network access (nếu cần)
- ✅ Chỉ compile/run code trong workspace

## 📝 Future Enhancements

1. **API endpoint để trigger run từ UI**
   - POST /api/workspace/run-code
   - Execute auto-run.sh via WebSocket
   - Stream output real-time

2. **Output panel trong UI**
   - Hiển thị output trực tiếp trong web
   - Không cần mở terminal

3. **Debug support**
   - VSCode debugger integration
   - Breakpoints và step-through

4. **Custom test cases**
   - UI để thêm multiple test cases
   - Auto-run với tất cả test cases

5. **Performance metrics**
   - Đo thời gian compile
   - Đo thời gian execution
   - Memory usage

## 🐛 Known Issues

1. **postMessage to iframe không hoạt động**
   - VSCode trong iframe không nhận postMessage
   - Workaround: Hiển thị hướng dẫn cho user

2. **C++23 có thể không compile**
   - Phụ thuộc vào version của g++ trong container
   - Cần g++ 11+ để hỗ trợ C++23

## 📞 Support

Nếu có vấn đề, kiểm tra:
1. File .vscode/tasks.json đã được tạo chưa
2. File .vscode/auto-run.sh có quyền execute chưa (chmod +x)
3. Compiler đã được cài đặt trong container chưa
4. Input.txt có đúng format không

## ✅ Checklist

- [x] Tạo VSCode tasks template
- [x] Tạo auto-run script
- [x] Cập nhật workspace-manager
- [x] Thêm nút Run Code vào UI
- [x] Auto-detect language
- [x] Cập nhật README template
- [x] Tạo test samples
- [x] Viết testing guide
- [x] Viết documentation

## 🎉 Kết luận

Tính năng compile và run code đã được triển khai hoàn chỉnh với 3 phương pháp:
1. VSCode Tasks (phím tắt, chuyên nghiệp)
2. Auto-run script (linh hoạt, dễ dùng)
3. Run Code button (thân thiện với người mới)

User có thể chọn phương pháp phù hợp với trình độ và sở thích của mình.

