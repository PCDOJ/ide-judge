#!/bin/bash

# Script to run database migrations

echo "========================================="
echo "  Running Database Migrations"
echo "========================================="
echo ""

# Check if MariaDB is running
if ! docker-compose ps mariadb | grep -q "Up"; then
    echo "❌ Error: MariaDB is not running"
    echo "Please start the system first: ./scripts/start.sh"
    exit 1
fi

echo "✓ MariaDB is running"
echo ""

# Wait for MariaDB to be ready
echo "Waiting for MariaDB to be ready..."
sleep 5

# Run migrations
echo "Running migrations..."
echo ""

# Migration 1: Exam tables
echo "1. Running add_exam_tables.sql..."
docker-compose exec -T mariadb mysql -uroot -prootpassword ide_judge_db < migrations/add_exam_tables.sql
if [ $? -eq 0 ]; then
    echo "   ✓ Exam tables migration completed"
else
    echo "   ⚠ Exam tables migration failed (may already exist)"
fi
echo ""

# Migration 2: Code submissions
echo "2. Running add_code_submissions.sql..."
docker-compose exec -T mariadb mysql -uroot -prootpassword ide_judge_db < migrations/add_code_submissions.sql
if [ $? -eq 0 ]; then
    echo "   ✓ Code submissions migration completed"
else
    echo "   ⚠ Code submissions migration failed (may already exist)"
fi
echo ""

# Migration 3: Access code field
if [ -f "migrations/add_has_access_code_field.sql" ]; then
    echo "3. Running add_has_access_code_field.sql..."
    docker-compose exec -T mariadb mysql -uroot -prootpassword ide_judge_db < migrations/add_has_access_code_field.sql
    if [ $? -eq 0 ]; then
        echo "   ✓ Access code field migration completed"
    else
        echo "   ⚠ Access code field migration failed (may already exist)"
    fi
    echo ""
fi

echo "========================================="
echo "  Migrations completed!"
echo "========================================="
echo ""
echo "To verify tables:"
echo "  docker-compose exec mariadb mysql -uroot -prootpassword ide_judge_db -e 'SHOW TABLES;'"
echo ""

