#!/bin/sh

# Wait for database to be ready
echo "Waiting for database to be ready..."
sleep 5

# Run all migrations in order
echo "Running migrations..."

# Check if migrations directory exists
if [ -d "/app/migrations" ]; then
    # Run migrations in alphabetical order
    for migration in /app/migrations/*.sql; do
        if [ -f "$migration" ]; then
            echo "Running migration: $(basename $migration)"
            mysql -h mariadb -u root -p${MYSQL_ROOT_PASSWORD} ide_judge_db < "$migration" 2>&1 | grep -v "Warning: Using a password"
            if [ $? -eq 0 ]; then
                echo "✓ Migration $(basename $migration) completed successfully"
            else
                echo "✗ Migration $(basename $migration) failed"
            fi
        fi
    done
else
    echo "No migrations directory found"
fi

echo "Migrations completed!"

# Start the application
echo "Starting application..."
exec npm start

