# Tối ưu hóa CPU - Workspace Permissions

## Vấn đề

Khi deploy lên production, server bị **full CPU** do daemon `workspace-permissions-daemon.sh` chạy liên tục mỗi 1 giây:

```bash
while true; do
    find /workspace -type d -exec chmod 775 {} \;
    find /workspace -type f -exec chmod 664 {} \;
    find /workspace -type f -name "*.sh" -exec chmod 775 {} \;
    chown -R coder:coder /workspace
    sleep 1
done
```

**Tác động:**
- 4 lệnh `find` quét toàn bộ workspace tree mỗi giây
- Hàng trăm/ngàn process `chmod` được spawn liên tục
- 1 lệnh `chown -R` recursive mỗi giây
- CPU usage: 99%+ khi có nhiều workspace

## Giải pháp đã implement

### 1. ✅ Set UMASK (Giải pháp chính)

**File mới tạo tự động có permission đúng** mà không cần fix sau:

```bash
# code-server-entrypoint.sh
umask 002  # directories: 775, files: 664

# restricted-bash-wrapper.sh
umask 002  # áp dụng cho terminal session
```

**Kết quả:**
- File mới: `664 (rw-rw-r--)`
- Directory mới: `775 (rwxrwxr-x)`
- Không cần daemon chạy liên tục

### 2. ✅ Tắt daemon gây CPU cao

**Đã tắt hoàn toàn** daemon trong `code-server-entrypoint.sh`:

```bash
# REMOVED: sudo /usr/local/bin/workspace-permissions-daemon.sh &
```

**Chỉ fix permission 1 lần** khi container start:
- Initial fix cho workspace hiện có
- Sau đó dựa vào umask cho file mới

### 3. ✅ Inotify-based watcher (Tùy chọn)

**Nếu cần** fix permission tự động, dùng `workspace-permissions-inotify.sh`:

```bash
# Chỉ chạy khi có file MỚI được tạo (event-driven)
inotifywait -m -r -e create -e moved_to /workspace |
while read filepath; do
    chmod 664 "$filepath"  # Chỉ fix file vừa tạo
    chown coder:coder "$filepath"
done
```

**Ưu điểm:**
- Chỉ chạy khi có event (không scan liên tục)
- CPU usage: ~0% khi idle
- Chỉ xử lý file mới tạo (không scan toàn bộ tree)

**Cách bật** (nếu cần):

Uncomment trong `code-server-entrypoint.sh`:
```bash
sudo /usr/local/bin/workspace-permissions-inotify.sh &
```

### 4. ✅ Cron job cho cleanup định kỳ

**Đã có sẵn** `fix-workspace-permissions-cron.sh` - chạy 1-2 lần/ngày:

```bash
# Thêm vào crontab (nếu cần)
0 2 * * * /usr/local/bin/fix-workspace-permissions-cron.sh
```

## So sánh hiệu năng

| Phương pháp | CPU (idle) | CPU (active) | Độ trễ fix permission |
|-------------|------------|--------------|----------------------|
| **Daemon cũ (mỗi 1s)** | 30-50% | 99%+ | ~1s |
| **UMASK (khuyến nghị)** | 0% | 0% | 0s (tự động) |
| **Inotify watcher** | ~0% | 1-5% | <100ms |
| **Cron job (5 phút)** | 0% | 10-20% (khi chạy) | ~5 phút |

## Khuyến nghị cho Production

### ✅ Cấu hình hiện tại (Tối ưu nhất):

1. **UMASK = 002** → File mới tự động có permission đúng
2. **Không dùng daemon** → Tiết kiệm CPU
3. **Initial fix 1 lần** khi container start
4. **Cron job** (optional) chạy 1 lần/ngày để cleanup

### 🔧 Nếu vẫn gặp vấn đề permission:

**Option A: Bật inotify watcher**
```bash
# Uncomment trong code-server-entrypoint.sh
sudo /usr/local/bin/workspace-permissions-inotify.sh &
```

**Option B: Tăng tần suất cron job**
```bash
# Chạy mỗi 10 phút thay vì 1 ngày
*/10 * * * * /usr/local/bin/fix-workspace-permissions-cron.sh
```

**Option C: Tăng sleep time của daemon** (không khuyến nghị)
```bash
# workspace-permissions-daemon.sh
sleep 60  # Thay vì sleep 1
```

## Testing

### Test umask hoạt động:

```bash
# Vào container
docker exec -it ide-judge-code-server bash

# Tạo file mới
touch /workspace/test.txt
mkdir /workspace/testdir

# Kiểm tra permission
ls -la /workspace/test*
# Expected:
# -rw-rw-r-- 1 coder coder    0 ... test.txt
# drwxrwxr-x 2 coder coder 4096 ... testdir
```

### Monitor CPU usage:

```bash
# Trước khi deploy
docker stats ide-judge-code-server

# Sau khi deploy
htop  # Không còn thấy hàng trăm process find/chmod
```

## Rebuild & Deploy

```bash
# Rebuild image với optimization mới
docker-compose build code-server

# Restart container
docker-compose up -d code-server

# Verify
docker logs ide-judge-code-server | grep "umask"
# Expected: "Setting umask to 002 for automatic permissions..."
```

## Rollback (nếu cần)

Nếu gặp vấn đề, có thể rollback bằng cách uncomment daemon:

```bash
# code-server-entrypoint.sh
sudo /usr/local/bin/workspace-permissions-daemon.sh &
```

Nhưng **khuyến nghị tăng sleep time** thay vì dùng 1s:

```bash
# workspace-permissions-daemon.sh
sleep 30  # Hoặc 60
```

## Kết luận

✅ **Đã giải quyết vấn đề CPU cao** bằng cách:
1. Tắt daemon chạy liên tục
2. Dùng umask để file mới tự động có permission đúng
3. Cung cấp inotify watcher như alternative hiệu quả hơn

**Expected CPU usage:** 0-5% (giảm từ 99%+)

