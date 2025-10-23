-- Migration: Add workspace management tables
-- Created: 2025-10-23
-- Purpose: Quản lý workspace files và sessions cho code-server integration
-- This migration is safe to run multiple times (idempotent)

USE ide_judge_db;

-- ========================================
-- Table: workspace_sessions
-- Mục đích: Track workspace sessions của thí sinh
-- ========================================
CREATE TABLE IF NOT EXISTS workspace_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    contest_id INT NOT NULL,
    problem_id INT NOT NULL,
    workspace_path VARCHAR(500) NOT NULL COMMENT 'Path: /workspace/{username}/{contest_id}/{problem_id}/',
    last_sync_time TIMESTAMP NULL DEFAULT NULL COMMENT 'Lần sync cuối cùng lên server',
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT 'Lần truy cập cuối',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL COMMENT 'Tự động xóa sau 7 ngày',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'Session còn active không',
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contest_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_workspace (user_id, contest_id, problem_id),
    INDEX idx_user_id (user_id),
    INDEX idx_contest_id (contest_id),
    INDEX idx_expires_at (expires_at),
    INDEX idx_last_accessed (last_accessed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Quản lý workspace sessions của thí sinh';

-- ========================================
-- Table: workspace_files
-- Mục đích: Lưu trữ tất cả files trong workspace
-- ========================================
CREATE TABLE IF NOT EXISTS workspace_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL COMMENT 'Link to workspace_sessions',
    user_id INT NOT NULL,
    contest_id INT NOT NULL,
    problem_id INT NOT NULL,
    
    file_path VARCHAR(500) NOT NULL COMMENT 'Relative path trong workspace (e.g., main.cpp, utils/helper.h)',
    file_name VARCHAR(255) NOT NULL COMMENT 'Tên file (e.g., main.cpp)',
    file_content LONGTEXT COMMENT 'Nội dung file',
    file_size INT DEFAULT 0 COMMENT 'Kích thước file (bytes)',
    file_type VARCHAR(50) DEFAULT NULL COMMENT 'Loại file (cpp, py, java, h, etc)',
    
    is_main_file BOOLEAN DEFAULT FALSE COMMENT 'File chính (tên trùng mã bài)',
    is_deleted BOOLEAN DEFAULT FALSE COMMENT 'Soft delete',
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    synced_at TIMESTAMP NULL DEFAULT NULL COMMENT 'Lần sync cuối từ code-server',
    
    FOREIGN KEY (session_id) REFERENCES workspace_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (contest_id) REFERENCES exams(id) ON DELETE CASCADE,
    FOREIGN KEY (problem_id) REFERENCES exam_problems(id) ON DELETE CASCADE,
    
    UNIQUE KEY unique_file (session_id, file_path),
    INDEX idx_session_id (session_id),
    INDEX idx_user_contest_problem (user_id, contest_id, problem_id),
    INDEX idx_is_main_file (is_main_file),
    INDEX idx_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Lưu trữ files trong workspace của thí sinh';

-- ========================================
-- Table: workspace_sync_log
-- Mục đích: Log lịch sử sync để debug
-- ========================================
CREATE TABLE IF NOT EXISTS workspace_sync_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    user_id INT NOT NULL,
    
    sync_type ENUM('auto', 'manual', 'submit') NOT NULL DEFAULT 'auto' COMMENT 'Loại sync',
    files_count INT DEFAULT 0 COMMENT 'Số lượng files được sync',
    total_size INT DEFAULT 0 COMMENT 'Tổng kích thước (bytes)',
    
    status ENUM('success', 'failed', 'partial') DEFAULT 'success',
    error_message TEXT NULL COMMENT 'Lỗi nếu có',
    
    synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (session_id) REFERENCES workspace_sessions(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    
    INDEX idx_session_id (session_id),
    INDEX idx_synced_at (synced_at),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Log lịch sử sync workspace';

-- ========================================
-- Trigger: Auto-set expires_at to 7 days
-- ========================================
DELIMITER $$

DROP TRIGGER IF EXISTS before_insert_workspace_sessions$$
CREATE TRIGGER before_insert_workspace_sessions
BEFORE INSERT ON workspace_sessions
FOR EACH ROW
BEGIN
    -- Tự động set expires_at = 7 ngày từ bây giờ nếu chưa set
    IF NEW.expires_at IS NULL THEN
        SET NEW.expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY);
    END IF;
END$$

DELIMITER ;

-- ========================================
-- Stored Procedure: Cleanup expired workspaces
-- ========================================
DELIMITER $$

DROP PROCEDURE IF EXISTS cleanup_expired_workspaces$$
CREATE PROCEDURE cleanup_expired_workspaces()
BEGIN
    DECLARE deleted_count INT DEFAULT 0;
    
    -- Đếm số sessions sẽ bị xóa
    SELECT COUNT(*) INTO deleted_count
    FROM workspace_sessions
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Soft delete expired sessions
    UPDATE workspace_sessions
    SET is_active = FALSE
    WHERE expires_at < NOW() AND is_active = TRUE;
    
    -- Log kết quả
    SELECT CONCAT('Cleaned up ', deleted_count, ' expired workspace sessions') AS result;
    
    -- Hard delete sessions đã soft delete > 30 ngày
    DELETE FROM workspace_sessions
    WHERE is_active = FALSE 
    AND expires_at < DATE_SUB(NOW(), INTERVAL 30 DAY);
END$$

DELIMITER ;

-- ========================================
-- Stored Procedure: Get workspace files
-- ========================================
DELIMITER $$

DROP PROCEDURE IF EXISTS get_workspace_files$$
CREATE PROCEDURE get_workspace_files(
    IN p_user_id INT,
    IN p_contest_id INT,
    IN p_problem_id INT
)
BEGIN
    -- Lấy tất cả files trong workspace
    SELECT 
        wf.id,
        wf.file_path,
        wf.file_name,
        wf.file_content,
        wf.file_size,
        wf.file_type,
        wf.is_main_file,
        wf.updated_at,
        wf.synced_at
    FROM workspace_files wf
    INNER JOIN workspace_sessions ws ON wf.session_id = ws.id
    WHERE ws.user_id = p_user_id
    AND ws.contest_id = p_contest_id
    AND ws.problem_id = p_problem_id
    AND wf.is_deleted = FALSE
    AND ws.is_active = TRUE
    ORDER BY wf.is_main_file DESC, wf.file_path ASC;
END$$

DELIMITER ;

-- ========================================
-- Initial data / Verification
-- ========================================

-- Verify tables created
SELECT 
    'workspace_sessions' AS table_name,
    COUNT(*) AS row_count
FROM workspace_sessions
UNION ALL
SELECT 
    'workspace_files' AS table_name,
    COUNT(*) AS row_count
FROM workspace_files
UNION ALL
SELECT 
    'workspace_sync_log' AS table_name,
    COUNT(*) AS row_count
FROM workspace_sync_log;

SELECT '✓ Migration 07-add_workspace_management.sql completed successfully!' AS status;

