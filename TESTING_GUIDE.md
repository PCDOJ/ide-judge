# Hướng dẫn Test Tính năng Compile và Run Code

## 📋 Tổng quan

Tài liệu này hướng dẫn cách test các tính năng compile và run code trong workspace VSCode.

## 🎯 Các tính năng cần test

1. ✅ VSCode Tasks (Ctrl+Shift+B)
2. ✅ Auto-run script (.vscode/auto-run.sh)
3. ✅ Nút "Run Code" trong UI
4. ✅ Auto-detect ngôn ngữ từ file chính
5. ✅ C++ version selector (C++14, C++17, C++20, C++23)

## 🚀 Chuẩn bị

### 1. Khởi động hệ thống

```bash
cd ide-judge
docker-compose up -d
```

### 2. Truy cập hệ thống

- URL: http://localhost:2308
- Login với tài khoản admin hoặc user
- Tạo một kỳ thi mới (nếu chưa có)
- Thêm bài tập với mã bài: PROB001

### 3. Vào workspace

- Đăng ký và tham gia kỳ thi
- Click vào bài tập để mở workspace
- Workspace sẽ tự động tạo các file:
  - README.md
  - PROB001.cpp (file mặc định)
  - input.txt
  - .vscode/tasks.json
  - .vscode/auto-run.sh

## 📝 Test Cases

### Test 1: Compile và Run C++ với VSCode Tasks

**Bước 1:** Mở file PROB001.cpp trong VSCode

**Bước 2:** Nhập code mẫu:
```cpp
#include <iostream>
using namespace std;

int main() {
    int a, b;
    cin >> a >> b;
    cout << a + b << endl;
    return 0;
}
```

**Bước 3:** Tạo file input.txt:
```
5 3
```

**Bước 4:** Test compile với các phiên bản C++

- Nhấn `Ctrl+Shift+P` → "Run Task"
- Chọn "C++: Build (C++14)" → Kiểm tra compile thành công
- Chọn "C++: Build (C++17)" → Kiểm tra compile thành công
- Chọn "C++: Build (C++20)" → Kiểm tra compile thành công
- Chọn "C++: Build (C++23)" → Kiểm tra compile thành công

**Bước 5:** Test build and run

- Nhấn `Ctrl+Shift+P` → "Run Task"
- Chọn "C++: Build and Run (C++20)"
- Kiểm tra output trong terminal: Phải hiển thị "8"

**Kết quả mong đợi:**
- ✅ Compile thành công với tất cả phiên bản C++
- ✅ Run thành công và output = 8

---

### Test 2: Auto-run Script

**Bước 1:** Mở Terminal trong VSCode (Ctrl+`)

**Bước 2:** Chạy lệnh:
```bash
./.vscode/auto-run.sh PROB001.cpp c++20
```

**Kết quả mong đợi:**
```
=========================================
Auto Run Script
File: PROB001.cpp
Extension: cpp
=========================================

Detected: C++ file
Compiling with g++ -std=c++20...

✓ Compilation successful!
=========================================
Running program...
=========================================

Using input from input.txt

8

=========================================
Program exited with code: 0
=========================================
```

**Bước 3:** Test với các phiên bản C++ khác:
```bash
./.vscode/auto-run.sh PROB001.cpp c++14
./.vscode/auto-run.sh PROB001.cpp c++17
./.vscode/auto-run.sh PROB001.cpp c++23
```

**Kết quả mong đợi:**
- ✅ Tất cả đều compile và run thành công
- ✅ Output đều là 8

---

### Test 3: Python

**Bước 1:** Đổi tên file chính thành PROB001.py

```bash
mv PROB001.cpp PROB001.py
```

**Bước 2:** Nhập code Python:
```python
a, b = map(int, input().split())
print(a + b)
```

**Bước 3:** Run với auto-run script:
```bash
./.vscode/auto-run.sh PROB001.py
```

**Kết quả mong đợi:**
```
=========================================
Auto Run Script
File: PROB001.py
Extension: py
=========================================

Detected: Python file
Running with python3...
=========================================

Using input from input.txt

8

=========================================
Program exited with code: 0
=========================================
```

**Bước 4:** Test với VSCode Task

- Nhấn `Ctrl+Shift+P` → "Run Task"
- Chọn "Python: Run"
- Kiểm tra output = 8

**Kết quả mong đợi:**
- ✅ Python run thành công
- ✅ Output = 8

---

### Test 4: Java

**Bước 1:** Đổi tên file chính thành PROB001.java

```bash
mv PROB001.py PROB001.java
```

**Bước 2:** Nhập code Java:
```java
import java.util.Scanner;

public class PROB001 {
    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int a = sc.nextInt();
        int b = sc.nextInt();
        System.out.println(a + b);
        sc.close();
    }
}
```

**Bước 3:** Run với auto-run script:
```bash
./.vscode/auto-run.sh PROB001.java
```

**Kết quả mong đợi:**
```
=========================================
Auto Run Script
File: PROB001.java
Extension: java
=========================================

Detected: Java file
Compiling with javac...

✓ Compilation successful!
=========================================
Running program...
=========================================

Using input from input.txt

8

=========================================
Program exited with code: 0
=========================================
```

**Bước 4:** Test với VSCode Task

- Nhấn `Ctrl+Shift+P` → "Run Task"
- Chọn "Java: Compile and Run"
- Kiểm tra output = 8

**Kết quả mong đợi:**
- ✅ Java compile và run thành công
- ✅ Output = 8

---

### Test 5: Nút "Run Code" trong UI

**Bước 1:** Click nút "Run Code" trên toolbar

**Bước 2:** Kiểm tra modal hiển thị:
- ✅ Detected Language: Java (hoặc ngôn ngữ hiện tại)
- ✅ C++ Version selector chỉ hiện khi là C++

**Bước 3:** Click "Run"

**Kết quả mong đợi:**
- ✅ Modal đóng
- ✅ Hiển thị notification với lệnh cần chạy
- ✅ Hướng dẫn mở terminal và chạy lệnh

---

### Test 6: Auto-detect Language khi Save/Submit

**Bước 1:** Với file PROB001.cpp, click "Lưu"

**Bước 2:** Kiểm tra database:
```sql
SELECT language_id, language_name FROM code_submissions 
WHERE problem_id = 1 ORDER BY updated_at DESC LIMIT 1;
```

**Kết quả mong đợi:**
- language_id = 54
- language_name = 'C++'

**Bước 3:** Đổi file thành PROB001.py, click "Lưu"

**Bước 4:** Kiểm tra database lại

**Kết quả mong đợi:**
- language_id = 71
- language_name = 'Python'

**Bước 5:** Đổi file thành PROB001.java, click "Lưu"

**Bước 6:** Kiểm tra database lại

**Kết quả mong đợi:**
- language_id = 62
- language_name = 'Java'

---

## ✅ Checklist tổng hợp

- [ ] VSCode Tasks compile C++ với C++14
- [ ] VSCode Tasks compile C++ với C++17
- [ ] VSCode Tasks compile C++ với C++20
- [ ] VSCode Tasks compile C++ với C++23
- [ ] VSCode Tasks build and run C++
- [ ] Auto-run script với C++ (tất cả versions)
- [ ] Auto-run script với Python
- [ ] Auto-run script với Java
- [ ] Nút "Run Code" hiển thị đúng ngôn ngữ
- [ ] C++ version selector chỉ hiện với C++
- [ ] Auto-detect language khi save (C++)
- [ ] Auto-detect language khi save (Python)
- [ ] Auto-detect language khi save (Java)
- [ ] Input từ file input.txt hoạt động đúng
- [ ] README.md có hướng dẫn đầy đủ

## 🐛 Troubleshooting

### Lỗi: Permission denied khi chạy auto-run.sh

**Giải pháp:**
```bash
chmod +x .vscode/auto-run.sh
```

### Lỗi: g++ not found

**Giải pháp:**
Kiểm tra Dockerfile.codeserver đã cài đặt build-essential chưa:
```bash
docker exec -it ide-judge-code-server bash
g++ --version
```

### Lỗi: Tasks không hiển thị

**Giải pháp:**
- Reload VSCode window: Ctrl+Shift+P → "Reload Window"
- Kiểm tra file .vscode/tasks.json đã được tạo chưa

## 📊 Kết quả Test

Ghi lại kết quả test tại đây:

| Test Case | Status | Note |
|-----------|--------|------|
| C++ C++14 | ⏳ | |
| C++ C++17 | ⏳ | |
| C++ C++20 | ⏳ | |
| C++ C++23 | ⏳ | |
| Python | ⏳ | |
| Java | ⏳ | |
| Auto-detect | ⏳ | |
| Run Code UI | ⏳ | |

## 📝 Notes

Ghi chú thêm trong quá trình test...

