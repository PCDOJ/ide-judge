-- Migration: Add code submissions table
-- Created: 2025-10-19
-- Purpose: Store student code submissions for each exam problem

USE ide_judge_db;

-- Table: code_submissions (Lưu code của thí sinh)
CREATE TABLE IF NOT EXISTS code_submissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    exam_id INT NOT NULL,
    problem_id INT NOT NULL,
    source_code LONGTEXT,
    language_id INT NOT NULL,
    language_name VARCHAR(50),
    status ENUM('draft', 'submitted', 'auto_submitted') NOT NULL DEFAULT 'draft',
    submitted_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    UNIQUE KEY unique_user_problem (user_id, exam_id, problem_id),
    INDEX idx_user_id (user_id),
    INDEX idx_exam_id (exam_id),
    INDEX idx_problem_id (problem_id),
    INDEX idx_status (status),
    INDEX idx_submitted_at (submitted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Table: submission_history (Lịch sử nộp bài - để tracking)
CREATE TABLE IF NOT EXISTS submission_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    submission_id INT NOT NULL,
    user_id INT NOT NULL,
    exam_id INT NOT NULL,
    problem_id INT NOT NULL,
    source_code LONGTEXT,
    language_id INT NOT NULL,
    language_name VARCHAR(50),
    action_type ENUM('save', 'submit', 'auto_submit') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (submission_id) REFERENCES code_submissions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    INDEX idx_submission_id (submission_id),
    INDEX idx_user_id (user_id),
    INDEX idx_exam_id (exam_id),
    INDEX idx_problem_id (problem_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

