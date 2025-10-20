#!/bin/bash

# Script to fix database issues on existing deployment
# This script will check and create missing tables

echo "========================================="
echo "  Database Fix Script"
echo "========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if DB_PASSWORD is set
if [ -z "$DB_PASSWORD" ]; then
    echo "❌ Error: DB_PASSWORD is not set"
    echo "Please set DB_PASSWORD in .env file"
    exit 1
fi

# Check if MariaDB is running
if ! docker-compose ps mariadb | grep -q "Up"; then
    echo "❌ Error: MariaDB is not running"
    echo "Please start the system first: ./scripts/start.sh"
    exit 1
fi

echo "✓ MariaDB is running"
echo ""

# Wait for MariaDB to be ready
echo "Waiting for MariaDB to be ready..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; then
        echo "✓ MariaDB is ready!"
        break
    fi
    
    attempt=$((attempt + 1))
    echo "  Attempt $attempt/$max_attempts..."
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ MariaDB failed to become ready"
    exit 1
fi

echo ""
echo "Checking database tables..."
echo ""

# Function to check if table exists
check_table() {
    local table_name=$1
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db \
        -e "SHOW TABLES LIKE '$table_name';" 2>/dev/null | grep -q "$table_name"
    return $?
}

# Function to check if column exists
check_column() {
    local table_name=$1
    local column_name=$2
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db \
        -e "SHOW COLUMNS FROM $table_name LIKE '$column_name';" 2>/dev/null | grep -q "$column_name"
    return $?
}

# Check users table
if check_table "users"; then
    echo "✓ Table 'users' exists"
else
    echo "⚠ Table 'users' missing - creating..."
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO users (fullname, username, email, password, role)
VALUES ('Administrator', 'admin', 'admin@example.com', '\$2a\$10\$mBCmkEgliZQPjaHrWKDrk.tHcKLinI78IGhh8KvBMNycgh1bgotB2', 'admin')
ON DUPLICATE KEY UPDATE username=username;
EOF
    echo "  ✓ Table 'users' created"
fi

# Check exams table
if check_table "exams"; then
    echo "✓ Table 'exams' exists"
    
    # Check if has_access_code column exists
    if check_column "exams" "has_access_code"; then
        echo "  ✓ Column 'has_access_code' exists"
    else
        echo "  ⚠ Column 'has_access_code' missing - adding..."
        docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
ALTER TABLE exams ADD COLUMN has_access_code BOOLEAN NOT NULL DEFAULT FALSE AFTER access_code;
UPDATE exams SET has_access_code = TRUE WHERE access_code IS NOT NULL AND access_code != '';
EOF
        echo "    ✓ Column 'has_access_code' added"
    fi
else
    echo "⚠ Table 'exams' missing - creating..."
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    access_code VARCHAR(50) DEFAULT NULL,
    has_access_code BOOLEAN NOT NULL DEFAULT FALSE,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_start_time (start_time),
    INDEX idx_end_time (end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF
    echo "  ✓ Table 'exams' created"
fi

# Check exam_problems table
if check_table "exam_problems"; then
    echo "✓ Table 'exam_problems' exists"
else
    echo "⚠ Table 'exam_problems' missing - creating..."
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
CREATE TABLE IF NOT EXISTS exam_problems (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    problem_code VARCHAR(50) NOT NULL,
    problem_title VARCHAR(255) NOT NULL,
    pdf_filename VARCHAR(255) NOT NULL,
    pdf_path VARCHAR(500) NOT NULL,
    points DECIMAL(5,2) NOT NULL DEFAULT 0,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    UNIQUE KEY unique_problem_code (exam_id, problem_code),
    INDEX idx_exam_id (exam_id),
    INDEX idx_display_order (display_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF
    echo "  ✓ Table 'exam_problems' created"
fi

# Check exam_registrations table
if check_table "exam_registrations"; then
    echo "✓ Table 'exam_registrations' exists"
else
    echo "⚠ Table 'exam_registrations' missing - creating..."
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
CREATE TABLE IF NOT EXISTS exam_registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    user_id INT NOT NULL,
    registration_type ENUM('pre_registered', 'joined', 'left') NOT NULL DEFAULT 'pre_registered',
    joined_at DATETIME DEFAULT NULL,
    left_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_exam (exam_id, user_id),
    INDEX idx_exam_id (exam_id),
    INDEX idx_user_id (user_id),
    INDEX idx_registration_type (registration_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF
    echo "  ✓ Table 'exam_registrations' created"
fi

# Check code_submissions table
if check_table "code_submissions"; then
    echo "✓ Table 'code_submissions' exists"
else
    echo "⚠ Table 'code_submissions' missing - creating..."
    docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db <<EOF
CREATE TABLE IF NOT EXISTS code_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    problem_id INT NOT NULL,
    user_id INT NOT NULL,
    source_code TEXT NOT NULL,
    language_id INT NOT NULL,
    judge0_token VARCHAR(100),
    status VARCHAR(50) DEFAULT 'pending',
    score DECIMAL(5,2) DEFAULT 0,
    execution_time DECIMAL(10,3),
    memory_used INT,
    compile_output TEXT,
    stdout TEXT,
    stderr TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exam_id (exam_id),
    INDEX idx_problem_id (problem_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
EOF
    echo "  ✓ Table 'code_submissions' created"
fi

echo ""
echo "========================================="
echo "  Database Check Complete!"
echo "========================================="
echo ""

# Show all tables
echo "Current tables in database:"
docker-compose exec -T mariadb mysql -uroot -p"${DB_PASSWORD}" ide_judge_db -e "SHOW TABLES;"

echo ""
echo "✓ Database is ready!"
echo ""

