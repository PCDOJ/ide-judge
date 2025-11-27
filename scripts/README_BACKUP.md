# Hướng Dẫn Sử Dụng Script Backup Database

## Mô Tả

Script `backup-and-transfer.sh` tự động backup toàn bộ database của hệ thống IDE Judge và đẩy qua SSH server.

### Chức Năng

1. **Backup MariaDB Database** - Backup toàn bộ database `ide_judge_db` bao gồm:
   - Tất cả tables và data
   - Stored procedures, triggers, events
   - Sử dụng `--single-transaction` để đảm bảo tính nhất quán

2. **Backup PostgreSQL Database** - Backup database `judge0` của Judge0 service:
   - Tất cả tables và data
   - Sử dụng `--clean --if-exists` để dễ dàng restore

3. **Nén Backup** - Tạo file `.tar.gz` chứa:
   - File dump MariaDB (.sql)
   - File dump PostgreSQL (.sql)
   - File thông tin backup (backup_info.txt)

4. **Tự Động Chuyển qua SSH** - Đẩy file backup qua SSH server:
   - Hỗ trợ nhập IP/hostname, username, port, password
   - Tự động tạo thư mục đích trên server
   - Kiểm tra kết nối trước khi transfer

## Yêu Cầu Hệ Thống

### Công Cụ Cần Thiết

- **Docker** - Để truy cập vào containers database
- **sshpass** - Để tự động nhập password SSH
  - macOS: `brew install hudochenkov/sshpass/sshpass`
  - Ubuntu/Debian: `sudo apt-get install sshpass`
  - CentOS/RHEL: `sudo yum install sshpass`

### Containers Cần Chạy

- `ide-judge-mariadb` - MariaDB container (bắt buộc)
- `ide-judge-judge0-db` - PostgreSQL container (tùy chọn)

## Cách Sử Dụng

### 1. Chuẩn Bị

Đảm bảo các containers đang chạy:

```bash
docker-compose ps
```

Kiểm tra file `.env` có đầy đủ thông tin:

```bash
cat .env | grep -E "DB_|POSTGRES_"
```

### 2. Chạy Script

```bash
./scripts/backup-and-transfer.sh
```

### 3. Nhập Thông Tin SSH

Script sẽ yêu cầu bạn nhập:

1. **IP/Hostname của SSH server**
   - Ví dụ: `192.168.1.100` hoặc `backup.example.com`

2. **Username SSH** (mặc định: root)
   - Nhấn Enter để dùng mặc định
   - Hoặc nhập username khác

3. **Port SSH** (mặc định: 22)
   - Nhấn Enter để dùng mặc định
   - Hoặc nhập port khác

4. **Password SSH**
   - Nhập password (không hiển thị khi gõ)

5. **Đường dẫn thư mục đích** (mặc định: /root/backups)
   - Nhấn Enter để dùng mặc định
   - Hoặc nhập đường dẫn khác

### 4. Ví Dụ Sử Dụng

```bash
$ ./scripts/backup-and-transfer.sh

ℹ️  Kiểm tra các công cụ cần thiết...
✅ Tất cả công cụ đã sẵn sàng!
✅ Đã load cấu hình từ file .env
✅ Đã tạo thư mục backup: backups/ide-judge-backup-20250127_143022

ℹ️  Bắt đầu backup MariaDB database...
✅ Backup MariaDB thành công! (2.5M)

ℹ️  Bắt đầu backup PostgreSQL database...
✅ Backup PostgreSQL thành công! (1.2M)

ℹ️  Tạo file thông tin backup...
✅ Đã tạo file thông tin backup

ℹ️  Đang nén backup...
✅ Nén backup thành công! (1.8M)

ℹ️  ==========================================
ℹ️  CHUYỂN FILE BACKUP QUA SSH SERVER
ℹ️  ==========================================

Nhập IP/Hostname của SSH server: 192.168.1.100
Nhập username SSH (mặc định: root): backup_user
Nhập port SSH (mặc định: 22): 22
Nhập password SSH: ********
Nhập đường dẫn thư mục đích trên server (mặc định: /root/backups): /home/backup_user/backups

ℹ️  Thông tin kết nối SSH:
  - Host: 192.168.1.100
  - User: backup_user
  - Port: 22
  - Remote Directory: /home/backup_user/backups

ℹ️  Kiểm tra kết nối SSH...
✅ Kết nối SSH thành công!

ℹ️  Tạo thư mục đích trên server...
ℹ️  Đang chuyển file backup qua SSH server...
ℹ️  File: backups/ide-judge-backup-20250127_143022.tar.gz (1.8M)
✅ Chuyển file thành công!
✅ File đã được lưu tại: backup_user@192.168.1.100:/home/backup_user/backups/ide-judge-backup-20250127_143022.tar.gz

Bạn có muốn xóa file backup local? (y/n): n
ℹ️  File backup local vẫn được giữ tại: backups/ide-judge-backup-20250127_143022.tar.gz

✅ ==========================================
✅ BACKUP VÀ CHUYỂN FILE HOÀN TẤT!
✅ ==========================================
```

## Cấu Trúc File Backup

File backup được nén có cấu trúc:

```
ide-judge-backup-20250127_143022.tar.gz
└── ide-judge-backup-20250127_143022/
    ├── mariadb_ide_judge_db_20250127_143022.sql
    ├── postgresql_judge0_20250127_143022.sql
    └── backup_info.txt
```

## Restore Database

### 1. Giải Nén File Backup

```bash
tar -xzf ide-judge-backup-20250127_143022.tar.gz
cd ide-judge-backup-20250127_143022
```

### 2. Restore MariaDB

```bash
docker exec -i ide-judge-mariadb mysql -uroot -p${DB_PASSWORD} < mariadb_ide_judge_db_20250127_143022.sql
```

Hoặc restore từ file trên host:

```bash
cat mariadb_ide_judge_db_20250127_143022.sql | docker exec -i ide-judge-mariadb mysql -uroot -p${DB_PASSWORD}
```

### 3. Restore PostgreSQL

```bash
docker exec -i ide-judge-judge0-db psql -U judge0 -d judge0 < postgresql_judge0_20250127_143022.sql
```

Hoặc restore từ file trên host:

```bash
cat postgresql_judge0_20250127_143022.sql | docker exec -i ide-judge-judge0-db psql -U judge0 -d judge0
```

## Tự Động Hóa Backup

### Sử Dụng Cron (Linux/macOS)

Tạo script wrapper để tự động nhập thông tin SSH:

```bash
#!/bin/bash
# scripts/auto-backup.sh

export SSH_HOST="192.168.1.100"
export SSH_USER="backup_user"
export SSH_PORT="22"
export SSH_PASSWORD="your_password"
export REMOTE_DIR="/home/backup_user/backups"

# Chạy backup với expect để tự động nhập
expect << EOF
spawn ./scripts/backup-and-transfer.sh
expect "Nhập IP/Hostname của SSH server:"
send "$SSH_HOST\r"
expect "Nhập username SSH"
send "$SSH_USER\r"
expect "Nhập port SSH"
send "$SSH_PORT\r"
expect "Nhập password SSH:"
send "$SSH_PASSWORD\r"
expect "Nhập đường dẫn thư mục đích"
send "$REMOTE_DIR\r"
expect "Bạn có muốn xóa file backup local?"
send "y\r"
expect eof
EOF
```

Thêm vào crontab:

```bash
# Backup mỗi ngày lúc 2:00 AM
0 2 * * * cd /path/to/ide-judge && ./scripts/auto-backup.sh >> /var/log/ide-judge-backup.log 2>&1
```

## Xử Lý Lỗi

### Lỗi: "MariaDB container không chạy"

```bash
docker-compose up -d mariadb
```

### Lỗi: "Không thể kết nối SSH"

- Kiểm tra IP/hostname
- Kiểm tra port SSH
- Kiểm tra username/password
- Kiểm tra firewall

### Lỗi: "sshpass chưa được cài đặt"

Script sẽ tự động cài đặt, hoặc cài thủ công:

```bash
# macOS
brew install hudochenkov/sshpass/sshpass

# Ubuntu/Debian
sudo apt-get install sshpass

# CentOS/RHEL
sudo yum install sshpass
```

## Bảo Mật

⚠️ **Lưu Ý Bảo Mật:**

1. **Không lưu password trong script** - Script yêu cầu nhập password mỗi lần chạy
2. **Sử dụng SSH key thay vì password** - Khuyến nghị cho production
3. **Mã hóa file backup** - Nên mã hóa file backup trước khi transfer
4. **Giới hạn quyền truy cập** - Chỉ cho phép user cần thiết chạy script
5. **Xóa backup cũ** - Định kỳ xóa các backup cũ để tiết kiệm dung lượng

### Sử Dụng SSH Key (Khuyến Nghị)

Thay vì dùng password, nên sử dụng SSH key:

```bash
# Tạo SSH key
ssh-keygen -t rsa -b 4096

# Copy key lên server
ssh-copy-id user@server

# Sau đó có thể dùng scp không cần password
scp backup.tar.gz user@server:/path/to/backups/
```

## Hỗ Trợ

Nếu gặp vấn đề, vui lòng:

1. Kiểm tra log của script
2. Kiểm tra containers đang chạy: `docker-compose ps`
3. Kiểm tra kết nối SSH thủ công: `ssh user@server`
4. Kiểm tra dung lượng ổ đĩa: `df -h`

## License

MIT License - Tự do sử dụng và chỉnh sửa

