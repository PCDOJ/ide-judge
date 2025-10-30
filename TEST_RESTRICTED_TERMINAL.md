# Test Restricted Terminal - Hướng dẫn kiểm tra

## Tổng quan

Hệ thống đã được cài đặt **2 lớp bảo vệ** để hạn chế user chỉ được thao tác trong folder hiện tại:

### Lớp 1: Command Validation (Backend)
- File: `utils/command-validator.js`
- Kiểm tra và chặn lệnh nguy hiểm trước khi execute
- Blacklist: cd, sudo, .., rm -rf, v.v.

### Lớp 2: Restricted Shell Wrapper (Container)
- File: `restricted-shell.sh`
- Override các lệnh cd, pushd, popd trong shell
- Kiểm tra path traversal và dangerous operations

---

## Cách triển khai

### 1. Rebuild code-server container

```bash
# Stop container hiện tại
docker-compose stop code-server

# Rebuild với restricted shell
docker-compose build code-server

# Start lại
docker-compose up -d code-server

# Verify
docker-compose logs code-server
```

### 2. Restart web service (để load command validator)

```bash
docker-compose restart web
```

---

## Test Cases

### ✅ Test 1: Lệnh hợp lệ (phải PASS)

```bash
# Compile C++
g++ -std=c++17 solution.cpp -o solution

# Run
./solution < input.txt

# Python
python3 solution.py < input.txt

# Java
javac Solution.java
java Solution < input.txt

# List files
ls -la

# View file
cat solution.cpp

# Create file
touch test.txt
echo "hello" > test.txt

# Grep
cat solution.cpp | grep "int main"
```

### ❌ Test 2: Lệnh bị cấm (phải FAIL)

```bash
# Test cd
cd ..
cd /workspace
cd /etc

# Test sudo
sudo ls
sudo rm -rf /

# Test path traversal
cat ../problem_1/solution.cpp
ls ../../
cat /etc/passwd

# Test dangerous operations
rm -rf *
rm -rf /
chmod 777 /etc/passwd

# Test command injection
ls; rm -rf /
ls && sudo reboot
ls | sudo cat /etc/shadow
```

### 🔍 Test 3: Edge cases

```bash
# Pipe hợp lệ (phải PASS)
ls | grep cpp
cat solution.cpp | wc -l
g++ solution.cpp 2>&1 | grep error

# Redirect hợp lệ (phải PASS)
./solution < input.txt > output.txt
echo "test" > test.txt

# Multiple commands (phải FAIL)
ls; cd ..
ls && cd /etc
```

---

## Kết quả mong đợi

### Khi lệnh bị chặn (Backend validation)

```json
{
  "success": false,
  "data": {
    "stdout": "",
    "stderr": "❌ Lệnh bị chặn: Lệnh \"cd\" không được phép sử dụng\n\nCác lệnh không được phép:\n- cd (di chuyển thư mục)\n- sudo (quyền root)\n- .. (truy cập thư mục cha)\n- Các lệnh nguy hiểm khác\n\nBạn chỉ được phép thao tác trong thư mục hiện tại.",
    "command": "cd ..",
    "workspacePath": "/workspace/user1/contest_1/problem_1",
    "blocked": true,
    "reason": "Lệnh \"cd\" không được phép sử dụng"
  }
}
```

### Khi lệnh bị chặn (Shell wrapper)

```
❌ Error: Command 'cd' is not allowed
You can only operate within the current directory.
```

### Khi lệnh hợp lệ

```json
{
  "success": true,
  "data": {
    "stdout": "solution.cpp\ninput.txt\noutput.txt\n",
    "stderr": "",
    "command": "ls",
    "workspacePath": "/workspace/user1/contest_1/problem_1"
  }
}
```

---

## Debugging

### Xem logs backend validation

```bash
docker-compose logs -f web | grep "Execute in terminal"
```

### Xem logs shell wrapper

```bash
docker exec -it ide-judge-code-server bash
cat /usr/local/bin/restricted-shell.sh
```

### Test trực tiếp trong container

```bash
# Vào container
docker exec -it ide-judge-code-server bash

# Test restricted shell
cd /workspace/user1/contest_1/problem_1
/usr/local/bin/restricted-shell.sh "cd .."
/usr/local/bin/restricted-shell.sh "ls"
/usr/local/bin/restricted-shell.sh "g++ solution.cpp"
```

---

## Whitelist/Blacklist Configuration

### Thêm lệnh vào blacklist

Edit `utils/command-validator.js`:

```javascript
this.blacklistedCommands = [
    'cd',
    'sudo',
    // Thêm lệnh mới
    'wget',
    'curl',
];
```

### Thêm lệnh vào whitelist

```javascript
this.allowedCommands = [
    'g++',
    'python3',
    // Thêm lệnh mới
    'rustc',
    'cargo',
];
```

### Thêm pattern nguy hiểm

```javascript
this.dangerousPatterns = [
    /\.\./,
    /\/etc\//,
    // Thêm pattern mới
    /\/proc\//,
    /\/sys\//,
];
```

---

## Lưu ý quan trọng

1. **2 lớp bảo vệ độc lập**: Nếu 1 lớp bị bypass, lớp còn lại vẫn bảo vệ
2. **Backend validation chạy trước**: Nhanh hơn, tiết kiệm tài nguyên
3. **Shell wrapper là lớp cuối**: Đảm bảo an toàn ngay cả khi backend bị bypass
4. **Không ảnh hưởng code-server UI**: User vẫn dùng terminal bình thường
5. **Cho phép compile và run**: Các lệnh lập trình vẫn hoạt động bình thường

---

## Troubleshooting

### Lỗi: restricted-shell.sh not found

```bash
# Rebuild container
docker-compose build code-server
docker-compose up -d code-server
```

### Lỗi: Permission denied

```bash
# Check permissions
docker exec -it ide-judge-code-server ls -la /usr/local/bin/restricted-shell.sh

# Fix permissions
docker exec -it ide-judge-code-server chmod +x /usr/local/bin/restricted-shell.sh
```

### Lệnh hợp lệ bị chặn nhầm

1. Check logs để xem lý do
2. Thêm lệnh vào whitelist hoặc safe patterns
3. Restart web service

---

## Security Best Practices

1. **Thường xuyên review logs** để phát hiện bypass attempts
2. **Update blacklist** khi phát hiện lệnh nguy hiểm mới
3. **Test kỹ** trước khi deploy production
4. **Monitor resource usage** để phát hiện abuse
5. **Backup workspace** thường xuyên

---

## Kết luận

Hệ thống đã được bảo vệ với 2 lớp:
- ✅ Backend validation (fast, flexible)
- ✅ Shell wrapper (secure, reliable)

User chỉ có thể:
- ✅ Compile và run code
- ✅ Xem và chỉnh sửa files trong thư mục hiện tại
- ✅ Sử dụng các lệnh lập trình cơ bản

User KHÔNG thể:
- ❌ Di chuyển ra ngoài thư mục hiện tại (cd, ..)
- ❌ Truy cập workspace của user khác
- ❌ Sử dụng quyền root (sudo)
- ❌ Thực hiện các lệnh nguy hiểm (rm -rf, chmod, v.v.)

