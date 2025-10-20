#!/bin/sh
set -e

echo "========================================="
echo "  IDE Judge - Starting Application"
echo "========================================="
echo ""

# Function to wait for MariaDB
wait_for_mariadb() {
    echo "Waiting for MariaDB to be ready..."
    echo "  DB_HOST: ${DB_HOST}"
    echo "  DB_USER: ${DB_USER}"
    echo "  DB_NAME: ${DB_NAME}"

    max_attempts=60
    attempt=0

    while [ $attempt -lt $max_attempts ]; do
        # Try to connect using DB_PASSWORD from environment
        if mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" > /dev/null 2>&1; then
            echo "✓ MariaDB is ready!"
            return 0
        fi

        attempt=$((attempt + 1))
        echo "  Attempt $attempt/$max_attempts - MariaDB not ready yet..."

        # Show more detailed error on every 10th attempt
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Debug: Trying to connect to ${DB_HOST} as ${DB_USER}..."
            mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" 2>&1 | head -n 3 || true
        fi

        sleep 3
    done

    echo "❌ MariaDB failed to start after $max_attempts attempts"
    echo "Last error:"
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" -e "SELECT 1" 2>&1 || true
    exit 1
}

# Function to check if table exists
table_exists() {
    local table_name=$1
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW TABLES LIKE '$table_name';" 2>/dev/null | grep -q "$table_name"
    return $?
}

# Function to check if column exists
column_exists() {
    local table_name=$1
    local column_name=$2
    mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW COLUMNS FROM $table_name LIKE '$column_name';" 2>/dev/null | grep -q "$column_name"
    return $?
}

# Function to run a single migration
run_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")

    if [ ! -f "$migration_file" ]; then
        echo "  ⚠ Migration file not found: $migration_name"
        return 0
    fi

    echo "  Running migration: $migration_name"

    # Run migration and suppress password warnings
    if mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < "$migration_file" 2>&1 | grep -v "Warning: Using a password" | grep -v "already exists" | grep -E "(ERROR|error)" ; then
        echo "  ⚠ Migration $migration_name encountered an issue (may already be applied)"
    else
        echo "  ✓ Migration $migration_name completed"
    fi
}

# Function to run migrations and ensure all tables exist
run_migrations() {
    echo ""
    echo "Running database migrations and checks..."

    # Note: init.sql is automatically run by MariaDB on first startup via docker-entrypoint-initdb.d
    # This function runs all migrations in order to ensure schema is up-to-date

    # List of migrations in order
    echo "  Running all migrations in order..."

    run_migration "/app/migrations/add_exam_tables.sql"
    run_migration "/app/migrations/add_code_submissions.sql"
    run_migration "/app/migrations/02-fix_code_submissions_schema.sql"
    run_migration "/app/migrations/add_has_access_code_field.sql"
    run_migration "/app/migrations/03-add_prevent_tab_switch.sql"
    run_migration "/app/migrations/04-add_exam_tab_violations.sql"
    run_migration "/app/migrations/05-update_violation_types.sql"

    echo ""
    echo "  Verifying critical tables..."

    # Verify critical tables exist
    if table_exists "users"; then
        echo "  ✓ Table 'users' exists"
    else
        echo "  ❌ Table 'users' missing! Database initialization may have failed."
        echo "  Please check MariaDB logs: docker-compose logs mariadb"
        exit 1
    fi

    if table_exists "exams"; then
        echo "  ✓ Table 'exams' exists"
    else
        echo "  ❌ Table 'exams' missing!"
        exit 1
    fi

    if table_exists "exam_problems"; then
        echo "  ✓ Table 'exam_problems' exists"
    else
        echo "  ❌ Table 'exam_problems' missing!"
        exit 1
    fi

    if table_exists "code_submissions"; then
        echo "  ✓ Table 'code_submissions' exists"
    else
        echo "  ❌ Table 'code_submissions' missing!"
        exit 1
    fi

    if table_exists "submission_history"; then
        echo "  ✓ Table 'submission_history' exists"
    else
        echo "  ❌ Table 'submission_history' missing!"
        exit 1
    fi

    if table_exists "exam_tab_violations"; then
        echo "  ✓ Table 'exam_tab_violations' exists"

        # Check if violation_type ENUM has all required types
        violation_types=$(mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
            -e "SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='exam_tab_violations' AND COLUMN_NAME='violation_type';" \
            -s -N 2>/dev/null)

        if echo "$violation_types" | grep -q "focus_lost"; then
            echo "  ✓ Table 'exam_tab_violations' has all violation types"
        else
            echo "  ⚠ Updating violation_type ENUM to include all types..."
            mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" <<EOF 2>/dev/null
ALTER TABLE exam_tab_violations
MODIFY COLUMN violation_type ENUM(
    'tab_hidden',
    'window_blur',
    'page_unload',
    'mouse_leave',
    'keyboard_shortcut',
    'devtools_attempt',
    'close_attempt',
    'exit_fullscreen',
    'focus_lost'
) NOT NULL DEFAULT 'tab_hidden' COMMENT 'Loại vi phạm';
EOF
            echo "  ✓ Violation types updated successfully"
        fi
    else
        echo "  ❌ Table 'exam_tab_violations' missing!"
        exit 1
    fi

    # Verify critical columns
    echo ""
    echo "  Verifying critical columns..."

    if column_exists "exams" "prevent_tab_switch"; then
        echo "  ✓ Column 'exams.prevent_tab_switch' exists"
    else
        echo "  ❌ Column 'exams.prevent_tab_switch' missing!"
        exit 1
    fi

    if column_exists "exams" "has_access_code"; then
        echo "  ✓ Column 'exams.has_access_code' exists"
    else
        echo "  ❌ Column 'exams.has_access_code' missing!"
        exit 1
    fi

    echo ""
    echo "✓ All database tables and columns verified!"
}

# Function to wait for Judge0
wait_for_judge0() {
    echo ""
    echo "Waiting for Judge0 to be ready (this may take a few minutes)..."
    max_attempts=60
    attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if wget -q --spider http://judge0-server:2358/about 2>/dev/null; then
            echo "✓ Judge0 is ready!"
            return 0
        fi
        
        attempt=$((attempt + 1))
        if [ $((attempt % 10)) -eq 0 ]; then
            echo "  Attempt $attempt/$max_attempts - Judge0 not ready yet..."
        fi
        sleep 3
    done
    
    echo "⚠ Judge0 is taking longer than expected, but continuing anyway..."
    echo "  You can check Judge0 status at: http://localhost:2358/about"
}

# Main execution
echo "Step 1: Waiting for dependencies..."
wait_for_mariadb

echo ""
echo "Step 2: Running migrations..."
run_migrations

echo ""
echo "Step 3: Creating required directories..."
# Create uploads directory if not exists
mkdir -p /app/uploads/exam-pdfs
echo "✓ Uploads directory created/verified"

echo ""
echo "Step 4: Checking Judge0 availability..."
wait_for_judge0 &

echo ""
echo "Step 5: Starting Node.js application..."
echo "========================================="
echo ""

# Start the application
exec node server.js

