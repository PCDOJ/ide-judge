#!/bin/bash

# Script to start the IDE Judge system

echo "========================================="
echo "  Starting IDE Judge System"
echo "========================================="
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker and try again"
    exit 1
fi

echo "✓ Docker is running"
echo ""

# Check if docker-compose is installed
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is not installed"
    echo "Please install docker-compose and try again"
    exit 1
fi

echo "✓ docker-compose is installed"
echo ""

# Stop existing containers
echo "Stopping existing containers..."
docker-compose down
echo ""

# Build and start containers
echo "Building and starting containers..."
docker-compose up -d --build
echo ""

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 10

# Check service status
echo ""
echo "========================================="
echo "  Service Status"
echo "========================================="
docker-compose ps
echo ""

# Check if services are healthy
echo "Checking service health..."
echo ""

# Check MariaDB
if docker-compose exec -T mariadb mysql -uroot -prootpassword -e "SELECT 1" > /dev/null 2>&1; then
    echo "✓ MariaDB is ready"
else
    echo "⚠ MariaDB is not ready yet"
fi

# Check Web Server
if curl -s http://localhost:2308 > /dev/null 2>&1; then
    echo "✓ Web Server is ready"
else
    echo "⚠ Web Server is not ready yet"
fi

# Check Judge0
if curl -s http://localhost:2358/about > /dev/null 2>&1; then
    echo "✓ Judge0 is ready"
else
    echo "⚠ Judge0 is not ready yet (may take a few minutes)"
fi

echo ""
echo "========================================="
echo "  Access Information"
echo "========================================="
echo ""
echo "Web Application: http://localhost:2308"
echo "Judge0 API:      http://localhost:2358"
echo "MariaDB:         localhost:3307"
echo ""
echo "Default Admin Account:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "========================================="
echo "  Useful Commands"
echo "========================================="
echo ""
echo "View logs:           docker-compose logs -f"
echo "Stop services:       docker-compose down"
echo "Restart services:    docker-compose restart"
echo "View status:         docker-compose ps"
echo ""
echo "========================================="
echo "  System started successfully!"
echo "========================================="

