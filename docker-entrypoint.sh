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

# Function to run migrations
run_migrations() {
    echo ""
    echo "Running database migrations..."

    # Check each migration individually

    # 1. Check and run exam tables migration
    exam_check=$(mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW TABLES;" 2>/dev/null | grep -c "exams" || echo "0")

    if [ "$exam_check" = "0" ]; then
        echo "  1. Creating exam tables..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < /app/migrations/add_exam_tables.sql
        echo "  ✓ Exam tables created"
    else
        echo "  ✓ Exam tables already exist"
    fi

    # 2. Check and run code submissions migration
    submission_check=$(mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
        -e "SHOW TABLES;" 2>/dev/null | grep -c "code_submissions" || echo "0")

    if [ "$submission_check" = "0" ]; then
        echo "  2. Creating code submission tables..."
        mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < /app/migrations/add_code_submissions.sql
        echo "  ✓ Code submission tables created"
    else
        echo "  ✓ Code submission tables already exist"
    fi

    # 3. Check and run access code field migration
    if [ -f "/app/migrations/add_has_access_code_field.sql" ]; then
        access_code_check=$(mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" \
            -e "SHOW COLUMNS FROM exams LIKE 'has_access_code';" 2>/dev/null | grep -c "has_access_code" || echo "0")

        if [ "$access_code_check" = "0" ]; then
            echo "  3. Adding access code field..."
            mysql -h "${DB_HOST}" -u "${DB_USER}" -p"${DB_PASSWORD}" "${DB_NAME}" < /app/migrations/add_has_access_code_field.sql || true
            echo "  ✓ Access code field added"
        else
            echo "  ✓ Access code field already exists"
        fi
    fi

    echo "✓ All migrations completed!"
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
echo "Step 3: Checking Judge0 availability..."
wait_for_judge0 &

echo ""
echo "Step 4: Starting Node.js application..."
echo "========================================="
echo ""

# Start the application
exec node server.js

