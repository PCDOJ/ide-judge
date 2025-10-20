#!/bin/bash

# Migration script for code_submissions schema fix
# This script will update the database schema to match the application requirements

set -e

echo "========================================="
echo "  Code Submissions Schema Migration"
echo "========================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
else
    echo "❌ Error: .env file not found!"
    exit 1
fi

# Check if MariaDB container is running
if ! docker ps | grep -q "ide-judge-mariadb"; then
    echo "❌ Error: MariaDB container is not running!"
    echo "Please start the containers first: docker-compose up -d"
    exit 1
fi

echo "Step 1: Creating backup of current database..."
BACKUP_FILE="backup_code_submissions_$(date +%Y%m%d_%H%M%S).sql"
docker exec ide-judge-mariadb mysqldump -u root -p"${DB_PASSWORD}" ide_judge_db code_submissions > "$BACKUP_FILE" 2>/dev/null || true
if [ -f "$BACKUP_FILE" ]; then
    echo "✓ Backup created: $BACKUP_FILE"
else
    echo "⚠ Warning: Could not create backup (table might not exist yet)"
fi

echo ""
echo "Step 2: Running migration script..."
docker exec -i ide-judge-mariadb mysql -u root -p"${DB_PASSWORD}" < migrations/02-fix_code_submissions_schema.sql

if [ $? -eq 0 ]; then
    echo "✓ Migration completed successfully!"
else
    echo "❌ Migration failed!"
    echo "You can restore from backup: $BACKUP_FILE"
    exit 1
fi

echo ""
echo "Step 3: Verifying schema..."
echo "--- code_submissions table ---"
docker exec ide-judge-mariadb mysql -u root -p"${DB_PASSWORD}" -e "USE ide_judge_db; DESCRIBE code_submissions;"

echo ""
echo "--- submission_history table ---"
docker exec ide-judge-mariadb mysql -u root -p"${DB_PASSWORD}" -e "USE ide_judge_db; DESCRIBE submission_history;"

echo ""
echo "========================================="
echo "  Migration completed successfully!"
echo "========================================="
echo ""
echo "Backup file: $BACKUP_FILE"
echo ""
echo "Next steps:"
echo "1. Test the save code functionality"
echo "2. Check application logs: docker-compose logs -f web"
echo "3. If everything works, you can delete the backup file"
echo ""

