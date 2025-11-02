# Fix VSCode File Watcher High CPU Usage

## Vấn đề

Ruby process của code-server (VSCode backend) gây CPU cao 100% do file watcher theo dõi quá nhiều file.

## Nguyên nhân

VSCode file watcher mặc định theo dõi **TẤT CẢ** file trong workspace, bao gồm:
- `node_modules/` (hàng nghìn file)
- `.git/objects/` (Git internal files)
- Build artifacts (`build/`, `dist/`, `target/`)
- Cache folders

## Giải pháp đã áp dụng

### 1. Thêm `files.watcherExclude` vào settings

File: `code-server-settings.json`

```json
{
    "files.watcherExclude": {
        "**/.git/objects/**": true,
        "**/.git/subtree-cache/**": true,
        "**/node_modules/**": true,
        "**/.hg/store/**": true,
        "**/__pycache__/**": true,
        "**/target/**": true,
        "**/build/**": true,
        "**/dist/**": true,
        "**/.cache/**": true,
        "**/tmp/**": true,
        "**/temp/**": true
    },
    "search.followSymlinks": false,
    "search.useIgnoreFiles": true,
    "files.exclude": {
        "**/.git": true,
        "**/.svn": true,
        "**/.hg": true,
        "**/CVS": true,
        "**/.DS_Store": true,
        "**/Thumbs.db": true,
        "**/__pycache__": true,
        "**/*.pyc": true,
        "**/node_modules": true
    }
}
```

### 2. Tác dụng

- **`files.watcherExclude`**: Loại trừ các folder khỏi file watcher (giảm CPU)
- **`search.followSymlinks: false`**: Không theo dõi symbolic links
- **`search.useIgnoreFiles: true`**: Sử dụng `.gitignore` để loại trừ file
- **`files.exclude`**: Ẩn các folder không cần thiết khỏi Explorer

### 3. Kết quả mong đợi

- CPU usage của Ruby process giảm từ **100%** xuống **< 5%**
- File watcher chỉ theo dõi source code files
- Không ảnh hưởng đến chức năng coding

## Cách deploy

### Bước 1: Rebuild code-server container

```bash
# Local
./rebuild-codeserver.sh

# Hoặc manual
docker-compose build --no-cache code-server
docker-compose up -d code-server
```

### Bước 2: Verify

```bash
# Kiểm tra CPU usage
docker stats ide-judge-code-server

# Hoặc trên server
htop
# Tìm Ruby process - CPU phải < 5%
```

### Bước 3: Deploy lên production

```bash
# 1. SSH vào server
ssh user@206.189.43.169

# 2. Pull code mới
cd /path/to/ide-judge
git pull origin main

# 3. Rebuild container
./rebuild-codeserver.sh

# 4. Verify
htop
docker stats
```

## Lưu ý

- Settings này áp dụng cho **TẤT CẢ** workspace trong code-server
- Nếu cần watch thêm folder nào, xóa khỏi `files.watcherExclude`
- Không ảnh hưởng đến Git, build tools, hoặc chức năng khác

## Tham khảo

- [VSCode File Watcher Settings](https://code.visualstudio.com/docs/getstarted/settings)
- [Stack Overflow: VSCode High CPU](https://stackoverflow.com/questions/51886037/visual-studio-code-using-large-amounts-of-cpu)

