-- Migration: Add has_access_code field to exams table
-- Created: 2025-10-19
-- Purpose: Add boolean field to control whether access code is required for exam

USE ide_judge_db;

-- Add has_access_code column to exams table (only if not exists)
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'ide_judge_db'
    AND TABLE_NAME = 'exams'
    AND COLUMN_NAME = 'has_access_code'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE exams ADD COLUMN has_access_code BOOLEAN NOT NULL DEFAULT FALSE AFTER access_code',
    'SELECT "Column has_access_code already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Update existing records: set has_access_code = TRUE where access_code is not null
UPDATE exams
SET has_access_code = TRUE
WHERE access_code IS NOT NULL AND access_code != '' AND has_access_code = FALSE;

