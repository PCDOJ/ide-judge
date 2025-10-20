-- Migration: Add prevent_tab_switch field to exams table
-- Created: 2025-10-20
-- Purpose: Enable anti-cheating feature to prevent students from switching tabs during exam

USE ide_judge_db;

-- Add prevent_tab_switch column to exams table if it doesn't exist
SET @column_exists = (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'ide_judge_db'
    AND TABLE_NAME = 'exams'
    AND COLUMN_NAME = 'prevent_tab_switch'
);

SET @sql = IF(@column_exists = 0,
    'ALTER TABLE exams ADD COLUMN prevent_tab_switch BOOLEAN NOT NULL DEFAULT FALSE COMMENT "Enable tab switch prevention and monitoring during exam" AFTER has_access_code',
    'SELECT "Column prevent_tab_switch already exists" AS message'
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

