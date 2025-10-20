-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ide_judge_db;
USE ide_judge_db;

-- Create users table
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

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt for 'admin123'
INSERT INTO users (fullname, username, email, password, role)
VALUES ('Administrator', 'admin', 'admin@example.com', '$2a$10$mBCmkEgliZQPjaHrWKDrk.tHcKLinI78IGhh8KvBMNycgh1bgotB2', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_role ON users(role);

-- ========================================
-- EXAM MANAGEMENT TABLES
-- ========================================

-- Table: exams (Kỳ thi)
CREATE TABLE IF NOT EXISTS exams (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    access_code VARCHAR(50) DEFAULT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_start_time (start_time),
    INDEX idx_end_time (end_time)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: exam_problems (Bài thi trong kỳ thi)
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

-- Table: exam_registrations (Đăng ký tham gia kỳ thi)
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

-- Table: code_submissions (Bài nộp code)
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

