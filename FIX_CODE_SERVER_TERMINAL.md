# Fix: Bảo vệ Code-Server Built-in Terminal

## ❌ Vấn đề

Hệ thống bảo vệ trước đó chỉ áp dụng cho terminal commands qua API endpoint `/execute-in-terminal`, **KHÔNG** bảo vệ terminal built-in của code-server.

User vẫn có thể:
```bash
cd ..
cd /workspace
sudo ls
```

## ✅ Giải pháp

Cấu hình **restricted bash wrapper** làm shell mặc định cho code-server terminal.

### Cơ chế hoạt động

1. **restricted-bash-wrapper.sh** - Shell wrapper với các hạn chế:
   - Override `cd` command để chặn `..`, absolute paths, `~`
   - Override `sudo`, `su`, `chown`, `chgrp`
   - Chỉ cho phép thao tác trong workspace directory
   - Hiển thị welcome message với thông tin hạn chế

2. **code-server-settings.json** - Cấu hình terminal profile:
   - Set `restricted-bash` làm default profile
   - Point đến `/usr/local/bin/restricted-bash-wrapper.sh`

3. **Dockerfile.codeserver** - Copy wrapper vào container:
   - Copy `restricted-bash-wrapper.sh` vào `/usr/local/bin/`
   - Set executable permissions

---

## 🚀 Deploy

### Bước 1: Rebuild code-server container

```bash
# Stop container
docker-compose stop code-server

# Rebuild với restricted bash wrapper
docker-compose build code-server

# Start lại
docker-compose up -d code-server
```

### Bước 2: Verify

```bash
# Check wrapper đã được copy
docker exec ide-judge-code-server ls -la /usr/local/bin/restricted-bash-wrapper.sh

# Check settings
docker exec ide-judge-code-server cat /home/coder/.local/share/code-server/User/settings.json | grep restricted
```

**Kết quả mong đợi:**
```
-rwxr-xr-x 1 root root 6789 ... /usr/local/bin/restricted-bash-wrapper.sh
"terminal.integrated.defaultProfile.linux": "restricted-bash",
```

### Bước 3: Test trong code-server UI

1. **Mở code-server** trong browser
2. **Mở Terminal** (Ctrl + `)
3. **Kiểm tra welcome message:**

```
=========================================
  Restricted Terminal Mode
=========================================
Workspace: /workspace/admin/contest_16/problem_9

⚠️  Restrictions:
  - Cannot use 'cd ..' to go to parent directory
  - Cannot access directories outside workspace
  - Cannot use sudo, su, chown, chgrp
  - Can only modify files in current workspace

✅ Allowed:
  - Compile and run code (g++, python3, java, etc.)
  - View and edit files in workspace
  - Use programming tools and utilities
=========================================
```

4. **Test các lệnh bị chặn:**

```bash
# Test cd .. (phải bị chặn)
cd ..
# Output: ❌ Error: Parent directory access (..) is not allowed

# Test cd /workspace (phải bị chặn)
cd /workspace
# Output: ❌ Error: Cannot access directory outside workspace

# Test sudo (phải bị chặn)
sudo ls
# Output: ❌ Error: sudo is not allowed
```

5. **Test các lệnh hợp lệ:**

```bash
# Compile C++
g++ solution.cpp -o solution

# Run
./solution < input.txt

# Python
python3 solution.py

# List files
ls -la

# View file
cat solution.cpp
```

---

## 🧪 Test Cases

### ❌ Các lệnh phải bị chặn

| Lệnh | Kết quả mong đợi |
|------|------------------|
| `cd ..` | ❌ Error: Parent directory access (..) is not allowed |
| `cd /workspace` | ❌ Error: Cannot access directory outside workspace |
| `cd ~` | ❌ Error: Home directory access is not allowed |
| `sudo ls` | ❌ Error: sudo is not allowed |
| `su` | ❌ Error: su is not allowed |
| `chown root:root file.txt` | ❌ Error: chown is not allowed |
| `chmod 777 /etc/passwd` | ❌ Error: chmod outside workspace is not allowed |

### ✅ Các lệnh phải hoạt động

| Lệnh | Kết quả mong đợi |
|------|------------------|
| `ls` | ✅ List files |
| `pwd` | ✅ Show current directory |
| `cat solution.cpp` | ✅ Display file content |
| `g++ solution.cpp` | ✅ Compile C++ |
| `python3 solution.py` | ✅ Run Python |
| `cd subdir` | ✅ Change to subdirectory (if within workspace) |
| `chmod 755 solution` | ✅ Change permissions (within workspace) |

---

## 🔧 Troubleshooting

### Lỗi: Terminal vẫn dùng bash thông thường

**Nguyên nhân**: Settings chưa được apply hoặc container chưa rebuild

**Giải pháp**:
```bash
# Rebuild container
docker-compose build code-server
docker-compose up -d code-server

# Clear browser cache và reload
```

### Lỗi: restricted-bash-wrapper.sh not found

**Nguyên nhân**: File chưa được copy vào container

**Giải pháp**:
```bash
# Check file exists
ls -la restricted-bash-wrapper.sh

# Rebuild
docker-compose build code-server
docker-compose up -d code-server

# Verify
docker exec ide-judge-code-server ls -la /usr/local/bin/restricted-bash-wrapper.sh
```

### Lỗi: Permission denied

**Nguyên nhân**: File không có quyền execute

**Giải pháp**:
```bash
# Fix permissions locally
chmod +x restricted-bash-wrapper.sh

# Rebuild
docker-compose build code-server
docker-compose up -d code-server
```

### Terminal không hiển thị welcome message

**Nguyên nhân**: Terminal đang dùng profile khác

**Giải pháp**:
1. Mở Terminal trong code-server
2. Click vào dropdown bên cạnh "+"
3. Chọn "restricted-bash"
4. Hoặc close tất cả terminals và mở lại

---

## 📊 So sánh trước và sau

### Trước khi fix

```bash
coder@container:/workspace/admin/contest_16/problem_9$ cd ..
coder@container:/workspace/admin/contest_16$ cd ..
coder@container:/workspace/admin$ sudo ls
# ✅ Thành công - KHÔNG AN TOÀN!
```

### Sau khi fix

```bash
[RESTRICTED] coder@container:/workspace/admin/contest_16/problem_9$ cd ..
❌ Error: Parent directory access (..) is not allowed
You can only operate within: /workspace/admin/contest_16/problem_9

[RESTRICTED] coder@container:/workspace/admin/contest_16/problem_9$ sudo ls
❌ Error: sudo is not allowed
You do not have root privileges in this environment
```

---

## 🔒 Security Notes

### Các lớp bảo vệ

1. **Backend Validation** (routes/workspace.js)
   - Validate commands từ API endpoint
   - Chặn trước khi gửi đến container

2. **Shell Wrapper for API** (restricted-shell.sh)
   - Validate commands trong container
   - Dùng cho API terminal execution

3. **Shell Wrapper for Built-in Terminal** (restricted-bash-wrapper.sh) ⭐ **MỚI**
   - Override bash commands
   - Dùng cho code-server built-in terminal
   - Bảo vệ ngay cả khi user mở terminal trực tiếp

### Điểm mạnh

- ✅ Bảo vệ cả API terminal và built-in terminal
- ✅ Override commands ở shell level
- ✅ User-friendly error messages
- ✅ Không ảnh hưởng đến compile/run code
- ✅ Hiển thị rõ ràng workspace được phép

### Hạn chế

- ⚠️ User có thể switch sang bash profile khác (nếu biết cách)
- ⚠️ Cần educate users về restricted mode

---

## 📝 Checklist

- [ ] Rebuild code-server container
- [ ] Verify restricted-bash-wrapper.sh trong container
- [ ] Verify settings.json đã update
- [ ] Test cd .. trong terminal (phải bị chặn)
- [ ] Test sudo trong terminal (phải bị chặn)
- [ ] Test compile C++ (phải hoạt động)
- [ ] Test với nhiều users khác nhau
- [ ] Test với nhiều contests khác nhau
- [ ] Clear browser cache và test lại

---

## 🎯 Kết luận

Sau khi deploy, hệ thống có **3 lớp bảo vệ**:

1. ✅ Backend validation (API endpoint)
2. ✅ Shell wrapper for API (restricted-shell.sh)
3. ✅ Shell wrapper for built-in terminal (restricted-bash-wrapper.sh)

User **KHÔNG THỂ**:
- ❌ Dùng `cd ..` để ra ngoài workspace
- ❌ Truy cập workspace của user khác
- ❌ Dùng `sudo`, `su`, `chown`, `chgrp`
- ❌ Truy cập system directories

User **VẪN CÓ THỂ**:
- ✅ Compile và run code bình thường
- ✅ Xem và edit files trong workspace
- ✅ Sử dụng tất cả programming tools

