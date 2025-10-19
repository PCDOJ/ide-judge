#!/bin/bash

# Script to generate secure random secrets for .env file
# Usage: ./scripts/generate-secrets.sh

echo "========================================="
echo "  IDE Judge - Secret Generator"
echo "========================================="
echo ""

# Function to generate random string
generate_secret() {
    local length=$1
    # Use openssl to generate cryptographically secure random string
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

echo "Generating secure secrets..."
echo ""

# Generate SESSION_SECRET (64 characters)
SESSION_SECRET=$(generate_secret 64)
echo "SESSION_SECRET (64 chars):"
echo "$SESSION_SECRET"
echo ""

# Generate DB_PASSWORD (32 characters)
DB_PASSWORD=$(generate_secret 32)
echo "DB_PASSWORD (32 chars):"
echo "$DB_PASSWORD"
echo ""

# Generate POSTGRES_PASSWORD (32 characters)
POSTGRES_PASSWORD=$(generate_secret 32)
echo "POSTGRES_PASSWORD (32 chars):"
echo "$POSTGRES_PASSWORD"
echo ""

echo "========================================="
echo "  Copy these values to your .env file"
echo "========================================="
echo ""
echo "SESSION_SECRET=$SESSION_SECRET"
echo "DB_PASSWORD=$DB_PASSWORD"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
echo ""

# Ask if user wants to create .env file automatically
read -p "Do you want to create .env file automatically? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f .env ]; then
        echo "⚠️  .env file already exists!"
        read -p "Do you want to overwrite it? (y/n): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Cancelled. Please copy the secrets manually."
            exit 0
        fi
    fi
    
    echo "Creating .env file..."
    
    cat > .env << EOF
# Database Configuration (MariaDB)
DB_HOST=mariadb
DB_USER=root
DB_PASSWORD=$DB_PASSWORD
DB_NAME=ide_judge_db
DB_PORT=3306

# Application Configuration
SESSION_SECRET=$SESSION_SECRET
PORT=2308

# Environment
NODE_ENV=production
TZ=Asia/Ho_Chi_Minh

# Judge0 API Configuration
JUDGE0_API_URL=http://judge0-server:2358

# Judge0 Database Configuration (PostgreSQL)
POSTGRES_DB=judge0
POSTGRES_USER=judge0
POSTGRES_PASSWORD=$POSTGRES_PASSWORD
EOF
    
    echo "✓ .env file created successfully!"
    echo ""
    echo "⚠️  IMPORTANT: Keep your .env file secure and never commit it to git!"
else
    echo "Please copy the secrets above to your .env file manually."
fi

echo ""
echo "Done!"

