-- Run all migrations in order
-- This script will be executed automatically by docker-compose on container startup
-- All migrations use IF NOT EXISTS or conditional logic to prevent duplicate execution

USE ide_judge_db;

-- Migration 01: Add exam tables (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/add_exam_tables.sql;

-- Migration 02: Add code submissions table (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/add_code_submissions.sql;

-- Migration 03: Fix code submissions schema (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/02-fix_code_submissions_schema.sql;

-- Migration 04: Add has_access_code field (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/add_has_access_code_field.sql;

-- Migration 05: Add prevent_tab_switch field (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/03-add_prevent_tab_switch.sql;

-- Migration 06: Add exam_tab_violations table (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/04-add_exam_tab_violations.sql;

-- Migration 07: Update violation types (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/05-update_violation_types.sql;

-- Migration 08: Add exam_notifications table (if not exists)
SOURCE /docker-entrypoint-initdb.d/migrations/06-add_exam_notifications.sql;

SELECT 'All migrations completed successfully!' AS status;

