#!/bin/bash

###############################################################################
# Script Backup Database và Tự động Đẩy qua SSH Server
# 
# Chức năng:
# - Backup toàn bộ MariaDB database (ide_judge_db)
# - Backup toàn bộ PostgreSQL database (judge0)
# - Nén tất cả thành 1 file tar.gz
# - Tự động đẩy file backup qua SSH server
#
# Sử dụng:
#   ./scripts/backup-and-transfer.sh
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check required commands
print_info "Kiểm tra các công cụ cần thiết..."

if ! command_exists docker; then
    print_error "Docker chưa được cài đặt!"
    exit 1
fi

if ! command_exists sshpass; then
    print_warning "sshpass chưa được cài đặt. Đang cài đặt..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        if command_exists brew; then
            brew install hudochenkov/sshpass/sshpass
        else
            print_error "Vui lòng cài đặt Homebrew trước: https://brew.sh"
            exit 1
        fi
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        # Linux
        if command_exists apt-get; then
            sudo apt-get update && sudo apt-get install -y sshpass
        elif command_exists yum; then
            sudo yum install -y sshpass
        else
            print_error "Không thể tự động cài đặt sshpass. Vui lòng cài đặt thủ công."
            exit 1
        fi
    else
        print_error "Hệ điều hành không được hỗ trợ tự động cài đặt sshpass."
        exit 1
    fi
fi

print_success "Tất cả công cụ đã sẵn sàng!"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
    print_success "Đã load cấu hình từ file .env"
else
    print_error "Không tìm thấy file .env!"
    exit 1
fi

# Create backup directory
BACKUP_DIR="backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="ide-judge-backup-${TIMESTAMP}"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_NAME}"

mkdir -p "${BACKUP_PATH}"
print_success "Đã tạo thư mục backup: ${BACKUP_PATH}"

# ============================================================================
# BACKUP MARIADB DATABASE
# ============================================================================
print_info "Bắt đầu backup MariaDB database..."

MARIADB_CONTAINER="ide-judge-mariadb"
MARIADB_DUMP_FILE="${BACKUP_PATH}/mariadb_${DB_NAME}_${TIMESTAMP}.sql"

# Check if MariaDB container is running
if ! docker ps | grep -q "${MARIADB_CONTAINER}"; then
    print_error "MariaDB container không chạy!"
    print_info "Vui lòng khởi động container: docker-compose up -d mariadb"
    exit 1
fi

# Dump MariaDB database
print_info "Đang dump database ${DB_NAME}..."
print_info "Container: ${MARIADB_CONTAINER}, User: ${DB_USER}"

# Use MYSQL_PWD environment variable to avoid password in command line
DUMP_ERROR=$(mktemp)
DUMP_EXIT_CODE=0

docker exec -e MYSQL_PWD="${DB_PASSWORD}" "${MARIADB_CONTAINER}" mysqldump \
    -u"${DB_USER}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --databases "${DB_NAME}" \
    > "${MARIADB_DUMP_FILE}" 2>"${DUMP_ERROR}"

DUMP_EXIT_CODE=$?

if [ $DUMP_EXIT_CODE -eq 0 ]; then
    MARIADB_SIZE=$(du -h "${MARIADB_DUMP_FILE}" | cut -f1)
    print_success "Backup MariaDB thành công! (${MARIADB_SIZE})"
    rm -f "${DUMP_ERROR}"
else
    print_error "Backup MariaDB thất bại! (Exit code: ${DUMP_EXIT_CODE})"
    echo ""
    print_error "=== CHI TIẾT LỖI ==="
    if [ -s "${DUMP_ERROR}" ]; then
        cat "${DUMP_ERROR}"
    else
        echo "Không có thông báo lỗi từ mysqldump"
        echo "Kiểm tra:"
        echo "  1. Container có đang chạy: docker ps | grep ${MARIADB_CONTAINER}"
        echo "  2. Database credentials trong .env có đúng không"
        echo "  3. Thử chạy thủ công: docker exec ${MARIADB_CONTAINER} mysql -u${DB_USER} -p${DB_PASSWORD} -e 'SHOW DATABASES;'"
    fi
    echo ""
    rm -f "${DUMP_ERROR}"
    exit 1
fi

# ============================================================================
# BACKUP POSTGRESQL DATABASE
# ============================================================================
print_info "Bắt đầu backup PostgreSQL database..."

POSTGRES_CONTAINER="ide-judge-judge0-db"
POSTGRES_DUMP_FILE="${BACKUP_PATH}/postgresql_${POSTGRES_DB}_${TIMESTAMP}.sql"

# Check if PostgreSQL container is running
if ! docker ps | grep -q "${POSTGRES_CONTAINER}"; then
    print_warning "PostgreSQL container không chạy. Bỏ qua backup PostgreSQL."
else
    # Dump PostgreSQL database
    print_info "Đang dump database ${POSTGRES_DB}..."
    print_info "Container: ${POSTGRES_CONTAINER}, User: ${POSTGRES_USER}"

    PG_DUMP_ERROR=$(mktemp)
    PG_EXIT_CODE=0

    docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${POSTGRES_CONTAINER}" pg_dump \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --clean \
        --if-exists \
        > "${POSTGRES_DUMP_FILE}" 2>"${PG_DUMP_ERROR}"

    PG_EXIT_CODE=$?

    if [ $PG_EXIT_CODE -eq 0 ]; then
        POSTGRES_SIZE=$(du -h "${POSTGRES_DUMP_FILE}" | cut -f1)
        print_success "Backup PostgreSQL thành công! (${POSTGRES_SIZE})"
        rm -f "${PG_DUMP_ERROR}"
    else
        print_error "Backup PostgreSQL thất bại! (Exit code: ${PG_EXIT_CODE})"
        echo ""
        print_error "=== CHI TIẾT LỖI ==="
        if [ -s "${PG_DUMP_ERROR}" ]; then
            cat "${PG_DUMP_ERROR}"
        else
            echo "Không có thông báo lỗi từ pg_dump"
            echo "Kiểm tra:"
            echo "  1. Container có đang chạy: docker ps | grep ${POSTGRES_CONTAINER}"
            echo "  2. Database credentials trong .env có đúng không"
            echo "  3. Thử chạy thủ công: docker exec ${POSTGRES_CONTAINER} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c '\\l'"
        fi
        echo ""
        rm -f "${PG_DUMP_ERROR}"
        exit 1
    fi
fi

# ============================================================================
# CREATE BACKUP INFO FILE
# ============================================================================
print_info "Tạo file thông tin backup..."

INFO_FILE="${BACKUP_PATH}/backup_info.txt"
cat > "${INFO_FILE}" << EOF
================================================================================
IDE JUDGE SYSTEM - DATABASE BACKUP
================================================================================

Backup Time: $(date +"%Y-%m-%d %H:%M:%S")
Backup Name: ${BACKUP_NAME}

Database Information:
- MariaDB Database: ${DB_NAME}
- PostgreSQL Database: ${POSTGRES_DB}

Files Included:
- mariadb_${DB_NAME}_${TIMESTAMP}.sql
- postgresql_${POSTGRES_DB}_${TIMESTAMP}.sql

System Information:
- Hostname: $(hostname)
- OS: $(uname -s)
- Kernel: $(uname -r)

Docker Containers Status:
$(docker ps --format "table {{.Names}}\t{{.Status}}" | grep ide-judge)

================================================================================
EOF

print_success "Đã tạo file thông tin backup"

# ============================================================================
# COMPRESS BACKUP
# ============================================================================
print_info "Đang nén backup..."

COMPRESSED_FILE="${BACKUP_DIR}/${BACKUP_NAME}.tar.gz"
tar -czf "${COMPRESSED_FILE}" -C "${BACKUP_DIR}" "${BACKUP_NAME}"

if [ $? -eq 0 ]; then
    COMPRESSED_SIZE=$(du -h "${COMPRESSED_FILE}" | cut -f1)
    print_success "Nén backup thành công! (${COMPRESSED_SIZE})"
    
    # Remove uncompressed backup directory
    rm -rf "${BACKUP_PATH}"
    print_info "Đã xóa thư mục backup tạm"
else
    print_error "Nén backup thất bại!"
    exit 1
fi

# ============================================================================
# TRANSFER TO SSH SERVER
# ============================================================================
echo ""
print_info "=========================================="
print_info "CHUYỂN FILE BACKUP QUA SSH SERVER"
print_info "=========================================="
echo ""

# Get SSH server information from user
read -p "Nhập IP/Hostname của SSH server: " SSH_HOST
read -p "Nhập username SSH (mặc định: root): " SSH_USER
SSH_USER=${SSH_USER:-root}

read -p "Nhập port SSH (mặc định: 22): " SSH_PORT
SSH_PORT=${SSH_PORT:-22}

read -sp "Nhập password SSH: " SSH_PASSWORD
echo ""

read -p "Nhập đường dẫn thư mục đích trên server (mặc định: /root/backups): " REMOTE_DIR
REMOTE_DIR=${REMOTE_DIR:-/root/backups}

echo ""
print_info "Thông tin kết nối SSH:"
echo "  - Host: ${SSH_HOST}"
echo "  - User: ${SSH_USER}"
echo "  - Port: ${SSH_PORT}"
echo "  - Remote Directory: ${REMOTE_DIR}"
echo ""

# Test SSH connection
print_info "Kiểm tra kết nối SSH..."
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}" "echo 'SSH connection successful'" 2>/dev/null

if [ $? -ne 0 ]; then
    print_error "Không thể kết nối SSH! Vui lòng kiểm tra lại thông tin."
    print_info "File backup vẫn được lưu tại: ${COMPRESSED_FILE}"
    exit 1
fi

print_success "Kết nối SSH thành công!"

# Create remote directory if not exists
print_info "Tạo thư mục đích trên server..."
sshpass -p "${SSH_PASSWORD}" ssh -o StrictHostKeyChecking=no -p "${SSH_PORT}" "${SSH_USER}@${SSH_HOST}" "mkdir -p ${REMOTE_DIR}"

# Transfer file
print_info "Đang chuyển file backup qua SSH server..."
print_info "File: ${COMPRESSED_FILE} (${COMPRESSED_SIZE})"

sshpass -p "${SSH_PASSWORD}" scp -o StrictHostKeyChecking=no -P "${SSH_PORT}" "${COMPRESSED_FILE}" "${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/"

if [ $? -eq 0 ]; then
    print_success "Chuyển file thành công!"
    print_success "File đã được lưu tại: ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/${BACKUP_NAME}.tar.gz"
    
    # Ask if user wants to delete local backup
    echo ""
    read -p "Bạn có muốn xóa file backup local? (y/n): " DELETE_LOCAL
    if [[ "$DELETE_LOCAL" =~ ^[Yy]$ ]]; then
        rm -f "${COMPRESSED_FILE}"
        print_success "Đã xóa file backup local"
    else
        print_info "File backup local vẫn được giữ tại: ${COMPRESSED_FILE}"
    fi
else
    print_error "Chuyển file thất bại!"
    print_info "File backup vẫn được lưu tại: ${COMPRESSED_FILE}"
    exit 1
fi

# ============================================================================
# SUMMARY
# ============================================================================
echo ""
print_success "=========================================="
print_success "BACKUP VÀ CHUYỂN FILE HOÀN TẤT!"
print_success "=========================================="
echo ""
print_info "Tóm tắt:"
echo "  - Backup Name: ${BACKUP_NAME}"
echo "  - Backup Size: ${COMPRESSED_SIZE}"
echo "  - Remote Location: ${SSH_USER}@${SSH_HOST}:${REMOTE_DIR}/${BACKUP_NAME}.tar.gz"
echo ""
print_info "Để restore backup, sử dụng lệnh:"
echo "  tar -xzf ${BACKUP_NAME}.tar.gz"
echo "  docker exec -i ide-judge-mariadb mysql -u${DB_USER} -p${DB_PASSWORD} < ${BACKUP_NAME}/mariadb_${DB_NAME}_${TIMESTAMP}.sql"
echo "  docker exec -i ide-judge-judge0-db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < ${BACKUP_NAME}/postgresql_${POSTGRES_DB}_${TIMESTAMP}.sql"
echo ""

