-- Migration: Create exam_tab_violations table
-- Created: 2025-10-20
-- Purpose: Track tab switching violations during exams for anti-cheating monitoring

USE ide_judge_db;

-- Table: exam_tab_violations (Vi phạm thoát tab trong kỳ thi)
CREATE TABLE IF NOT EXISTS exam_tab_violations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    user_id INT NOT NULL,
    problem_id INT DEFAULT NULL,
    left_at DATETIME NOT NULL COMMENT 'Thời điểm rời khỏi tab',
    returned_at DATETIME DEFAULT NULL COMMENT 'Thời điểm quay lại tab',
    duration_seconds INT DEFAULT NULL COMMENT 'Thời gian rời tab (giây)',
    violation_type ENUM('tab_hidden', 'window_blur', 'page_unload') NOT NULL DEFAULT 'tab_hidden' COMMENT 'Loại vi phạm',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE SET NULL,
    INDEX idx_exam_user (exam_id, user_id),
    INDEX idx_left_at (left_at),
    INDEX idx_violation_type (violation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lưu trữ các vi phạm thoát tab trong quá trình thi';

