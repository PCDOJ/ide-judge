-- Migration: Add exam_notifications table
-- Description: Tạo bảng lưu trữ thông báo từ admin gửi đến thí sinh trong contest
-- Date: 2025-10-21
-- Author: System

USE ide_judge_db;

-- Table: exam_notifications (Thông báo từ admin trong contest)
CREATE TABLE IF NOT EXISTS exam_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    exam_id INT NOT NULL,
    message TEXT NOT NULL COMMENT 'Nội dung thông báo',
    created_by INT NOT NULL COMMENT 'Admin tạo thông báo',
    is_active BOOLEAN NOT NULL DEFAULT TRUE COMMENT 'Thông báo còn hiệu lực',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_exam_id (exam_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lưu trữ thông báo từ admin gửi đến thí sinh trong contest';

-- Verify table creation
SELECT 'exam_notifications table created successfully' AS status;

