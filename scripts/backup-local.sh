#!/bin/bash

###############################################################################
# Script Backup Database Local (Không SSH)
# 
# Chức năng:
# - Backup toàn bộ MariaDB database (ide_judge_db)
# - Backup toàn bộ PostgreSQL database (judge0)
# - Nén tất cả thành 1 file tar.gz
# - Lưu tại thư mục backups/
#
# Sử dụng:
#   ./scripts/backup-local.sh
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

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker chưa được cài đặt!"
    exit 1
fi

print_success "Docker đã sẵn sàng!"

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
docker exec "${MARIADB_CONTAINER}" mysqldump \
    -u"${DB_USER}" \
    -p"${DB_PASSWORD}" \
    --single-transaction \
    --routines \
    --triggers \
    --events \
    --databases "${DB_NAME}" \
    > "${MARIADB_DUMP_FILE}"

if [ $? -eq 0 ]; then
    MARIADB_SIZE=$(du -h "${MARIADB_DUMP_FILE}" | cut -f1)
    print_success "Backup MariaDB thành công! (${MARIADB_SIZE})"
else
    print_error "Backup MariaDB thất bại!"
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
    docker exec "${POSTGRES_CONTAINER}" pg_dump \
        -U "${POSTGRES_USER}" \
        -d "${POSTGRES_DB}" \
        --clean \
        --if-exists \
        > "${POSTGRES_DUMP_FILE}"

    if [ $? -eq 0 ]; then
        POSTGRES_SIZE=$(du -h "${POSTGRES_DUMP_FILE}" | cut -f1)
        print_success "Backup PostgreSQL thành công! (${POSTGRES_SIZE})"
    else
        print_error "Backup PostgreSQL thất bại!"
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
# SUMMARY
# ============================================================================
echo ""
print_success "=========================================="
print_success "BACKUP HOÀN TẤT!"
print_success "=========================================="
echo ""
print_info "Tóm tắt:"
echo "  - Backup Name: ${BACKUP_NAME}"
echo "  - Backup Size: ${COMPRESSED_SIZE}"
echo "  - Location: ${COMPRESSED_FILE}"
echo ""
print_info "Để restore backup, sử dụng lệnh:"
echo "  tar -xzf ${COMPRESSED_FILE}"
echo "  docker exec -i ide-judge-mariadb mysql -u${DB_USER} -p${DB_PASSWORD} < ${BACKUP_NAME}/mariadb_${DB_NAME}_${TIMESTAMP}.sql"
echo "  docker exec -i ide-judge-judge0-db psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} < ${BACKUP_NAME}/postgresql_${POSTGRES_DB}_${TIMESTAMP}.sql"
echo ""

