#!/bin/sh
set -e

echo "========================================="
echo "  IDE Judge - Starting Application"
echo "========================================="
echo ""

# Function to wait for MariaDB
wait_for_mariadb() {
    echo "Waiting for MariaDB to be ready..."
    echo "  DB_HOST: ${DB_HOST}"
    echo "  DB_USER: ${DB_USER}"
    echo "  DB_NAME: ${DB_NAME}"

    max_attempts=60
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        # Try to connect using DB_PASSWORD from environment
        if mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; then
            echo "✓ MariaDB is ready!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo "  Attempt $attempt/$max_attempts - MariaDB not ready yet..."

        # Show more detailed error on every 10th attempt
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Debug: Trying to connect to ${DB_HOST} as ${DB_USER}..."
            mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" 2>&1 | head -n 3 || true
        fi

        sleep 3
    done

    echo "❌ MariaDB failed to start after $max_attempts attempts"
    echo "Last error:"
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" 2>&1 || true
    exit 1
}

# Function to check if table exists
table_exists() {
    local table_name=$1
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW TABLES LIKE '$table_name';" 2>/dev/null | grep -q "$table_name"
    return $?
}

# Function to check if column exists
column_exists() {
    local table_name=$1
    local column_name=$2
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW COLUMNS FROM $table_name LIKE '$column_name';" 2>/dev/null | grep -q "$column_name"
    return $?
}

# Function to run migrations and ensure all tables exist
run_migrations() {
    echo ""
    echo "Running database migrations and checks..."

    # 1. Check and create users table
    if table_exists "users"; then
        echo "  ✓ Table 'users' exists"
    else
        echo "  1. Creating users table..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
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
        echo "  ✓ Users table created"
    fi

    # 2. Check and create exams table
    if table_exists "exams"; then
        echo "  ✓ Table 'exams' exists"

        # Check if has_access_code column exists
        if column_exists "exams" "has_access_code"; then
            echo "    ✓ Column 'has_access_code' exists"
        else
            echo "    2a. Adding 'has_access_code' column..."
            mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
ALTER TABLE exams ADD COLUMN has_access_code BOOLEAN NOT NULL DEFAULT FALSE AFTER access_code;
UPDATE exams SET has_access_code = TRUE WHERE access_code IS NOT NULL AND access_code != '';
EOF
            echo "    ✓ Column 'has_access_code' added"
        fi
    else
        echo "  2. Creating exams table..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
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
        echo "  ✓ Exams table created"
    fi

    # 3. Check and create exam_problems table
    if table_exists "exam_problems"; then
        echo "  ✓ Table 'exam_problems' exists"
    else
        echo "  3. Creating exam_problems table..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
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
        echo "  ✓ Exam_problems table created"
    fi

    # 4. Check and create exam_registrations table
    if table_exists "exam_registrations"; then
        echo "  ✓ Table 'exam_registrations' exists"
    else
        echo "  4. Creating exam_registrations table..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
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
        echo "  ✓ Exam_registrations table created"
    fi

    # 5. Check and create code_submissions table
    if table_exists "code_submissions"; then
        echo "  ✓ Table 'code_submissions' exists"
    else
        echo "  5. Creating code_submissions table..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF
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
        echo "  ✓ Code_submissions table created"
    fi

    echo "✓ All database tables verified and created!"
}

# Function to wait for Judge0
wait_for_judge0() {
    echo ""
    echo "Waiting for Judge0 to be ready (this may take a few minutes)..."
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if wget -q --spider http://judge0-server:2358/about 2>/dev/null; then
            echo "✓ Judge0 is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Attempt $attempt/$max_attempts - Judge0 not ready yet..."
        fi
        sleep 3
    done
    
    echo "⚠ Judge0 is taking longer than expected, but continuing anyway..."
    echo "  You can check Judge0 status at: http://localhost:2358/about"
}

# Main execution
echo "Step 1: Waiting for dependencies..."
wait_for_mariadb

echo ""
echo "Step 2: Running migrations..."
run_migrations

echo ""
echo "Step 3: Checking Judge0 availability..."
wait_for_judge0 &

echo ""
echo "Step 4: Starting Node.js application..."
echo "========================================="
echo ""

# Start the application
exec node server.js

