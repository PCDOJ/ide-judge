-- Migration: Update exam_tab_violations violation types
-- Created: 2025-10-20
-- Purpose: Add more violation types for comprehensive monitoring

USE ide_judge_db;

-- Check if we need to update the ENUM
SET @column_type = (
    SELECT COLUMN_TYPE 
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = 'ide_judge_db' 
    AND TABLE_NAME = 'exam_tab_violations' 
    AND COLUMN_NAME = 'violation_type'
);

-- Only update if the column exists and doesn't have all the new types
SET @needs_update = (
    SELECT CASE 
        WHEN @column_type IS NULL THEN 0
        WHEN @column_type LIKE '%keyboard_shortcut%' THEN 0
        ELSE 1
    END
);

-- Update violation_type ENUM to include new types
SET @sql = IF(@needs_update = 1,
    "ALTER TABLE exam_tab_violations 
     MODIFY COLUMN violation_type ENUM(
         'tab_hidden',           -- Chuyển sang tab khác
         'window_blur',          -- Click ra ngoài cửa sổ
         'page_unload',          -- Cố gắng đóng/rời trang
         'mouse_leave',          -- Di chuyển chuột ra ngoài
         'keyboard_shortcut',    -- Sử dụng phím tắt chuyển tab
         'devtools_attempt',     -- Cố gắng mở DevTools
         'close_attempt',        -- Cố gắng đóng tab
         'exit_fullscreen',      -- Thoát chế độ toàn màn hình
         'focus_lost'            -- Mất focus của cửa sổ
     ) NOT NULL DEFAULT 'tab_hidden' 
     COMMENT 'Loại vi phạm'",
    "SELECT 'Violation types already up to date' AS message"
);

PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SELECT 'Migration 05-update_violation_types.sql completed' AS status;

