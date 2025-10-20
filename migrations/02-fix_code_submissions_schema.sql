-- Migration: Fix code_submissions schema
-- Created: 2025-10-20
-- Purpose: Update code_submissions table schema to match application requirements
-- This migration is safe to run multiple times (idempotent)

USE ide_judge_db;

-- ========================================
-- STEP 1: Backup existing data (optional but recommended)
-- ========================================
-- You can manually backup before running this:
-- CREATE TABLE code_submissions_backup AS SELECT * FROM code_submissions;

-- ========================================
-- STEP 2: Check and modify code_submissions table
-- ========================================

-- Add language_name column if not exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'language_name'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE code_submissions ADD COLUMN language_name VARCHAR(50) AFTER language_id',
    'SELECT "Column language_name already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add submitted_at column if not exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'submitted_at'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE code_submissions ADD COLUMN submitted_at DATETIME DEFAULT NULL',
    'SELECT "Column submitted_at already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Modify source_code to LONGTEXT (safe to run multiple times)
ALTER TABLE code_submissions 
MODIFY COLUMN source_code LONGTEXT;

-- Check current status column type
SET @status_type = (
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'status'
);

-- Only modify status if it's not already the correct ENUM type
SET @sql = IF(@status_type NOT LIKE '%draft%submitted%auto_submitted%',
    'ALTER TABLE code_submissions MODIFY COLUMN status ENUM(''draft'', ''submitted'', ''auto_submitted'') NOT NULL DEFAULT ''draft''',
    'SELECT "Column status already has correct type" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop unused columns if they exist
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'judge0_token'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN judge0_token',
    'SELECT "Column judge0_token does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop score column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'score'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN score',
    'SELECT "Column score does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop execution_time column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'execution_time'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN execution_time',
    'SELECT "Column execution_time does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop memory_used column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'memory_used'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN memory_used',
    'SELECT "Column memory_used does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop compile_output column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'compile_output'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN compile_output',
    'SELECT "Column compile_output does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop stdout column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'stdout'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN stdout',
    'SELECT "Column stdout does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop stderr column if exists
SET @column_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND COLUMN_NAME = 'stderr'
);

SET @sql = IF(@column_exists > 0,
    'ALTER TABLE code_submissions DROP COLUMN stderr',
    'SELECT "Column stderr does not exist" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique constraint if not exists
SET @constraint_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND INDEX_NAME = 'unique_user_problem'
);

SET @sql = IF(@constraint_exists = 0,
    'ALTER TABLE code_submissions ADD UNIQUE KEY unique_user_problem (user_id, exam_id, problem_id)',
    'SELECT "Unique constraint unique_user_problem already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for submitted_at if not exists
SET @index_exists = (
    SELECT COUNT(*) 
    FROM INFORMATION_SCHEMA.STATISTICS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'code_submissions' 
    AND INDEX_NAME = 'idx_submitted_at'
);

SET @sql = IF(@index_exists = 0,
    'ALTER TABLE code_submissions ADD INDEX idx_submitted_at (submitted_at)',
    'SELECT "Index idx_submitted_at already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========================================
-- STEP 3: Create submission_history table if not exists
-- ========================================

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

-- ========================================
-- STEP 4: Verify the changes
-- ========================================

SELECT 'Migration completed successfully!' AS status;
SELECT 'Verifying code_submissions table structure...' AS message;
DESCRIBE code_submissions;

SELECT 'Verifying submission_history table structure...' AS message;
DESCRIBE submission_history;

