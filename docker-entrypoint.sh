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

# Function to run migrations and ensure all tables exist
run_migrations() {
    echo ""
    echo "Running database migrations and checks..."

    # Note: init.sql is automatically run by MariaDB on first startup via docker-entrypoint-initdb.d
    # This function only handles additional migrations and schema updates

    # Run fix migration for code_submissions if needed
    if [ -f "/app/migrations/02-fix_code_submissions_schema.sql" ]; then
        echo "  Running code_submissions schema fix migration..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < /app/migrations/02-fix_code_submissions_schema.sql 2>&1 | grep -v "Warning: Using a password" | grep -v "already exists" || true
        echo "  ✓ Code submissions schema migration completed"
    fi

    # Verify critical tables exist
    echo "  Verifying critical tables..."

    if table_exists "users"; then
        echo "  ✓ Table 'users' exists"
    else
        echo "  ❌ Table 'users' missing! Database initialization may have failed."
        echo "  Please check MariaDB logs: docker-compose logs mariadb"
        exit 1
    fi

    if table_exists "code_submissions"; then
        echo "  ✓ Table 'code_submissions' exists"
    else
        echo "  ❌ Table 'code_submissions' missing! Database initialization may have failed."
        exit 1
    fi

    if table_exists "submission_history"; then
        echo "  ✓ Table 'submission_history' exists"
    else
        echo "  ❌ Table 'submission_history' missing! Database initialization may have failed."
        exit 1
    fi

    echo "✓ All database tables verified!"
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

