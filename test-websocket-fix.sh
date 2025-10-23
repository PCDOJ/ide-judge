#!/bin/bash

# Test script for WebSocket connection fix
# This script helps verify that the WebSocket connection to code-server works correctly

set -e

echo "=========================================="
echo "WebSocket Connection Fix - Test Script"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Step 1: Check if Docker is running
echo "Step 1: Checking Docker..."
if docker info > /dev/null 2>&1; then
    print_success "Docker is running"
else
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

# Step 2: Stop current services
echo ""
echo "Step 2: Stopping current services..."
docker-compose down
print_success "Services stopped"

# Step 3: Rebuild code-server image
echo ""
echo "Step 3: Rebuilding code-server image..."
docker-compose build code-server
if [ $? -eq 0 ]; then
    print_success "Code-server image rebuilt successfully"
else
    print_error "Failed to rebuild code-server image"
    exit 1
fi

# Step 4: Start all services
echo ""
echo "Step 4: Starting all services..."
docker-compose up -d
if [ $? -eq 0 ]; then
    print_success "Services started"
else
    print_error "Failed to start services"
    exit 1
fi

# Step 5: Wait for services to be ready
echo ""
echo "Step 5: Waiting for services to be ready..."
sleep 10

# Check web service
echo "Checking web service..."
if curl -f http://localhost:2308/login.html > /dev/null 2>&1; then
    print_success "Web service is ready"
else
    print_error "Web service is not responding"
fi

# Check code-server service
echo "Checking code-server service..."
if curl -f http://localhost:8080/healthz > /dev/null 2>&1; then
    print_success "Code-server service is ready"
else
    print_error "Code-server service is not responding"
fi

# Step 6: Show logs
echo ""
echo "Step 6: Showing recent logs..."
echo ""
print_info "Web service logs (last 20 lines):"
docker-compose logs --tail=20 web

echo ""
print_info "Code-server service logs (last 20 lines):"
docker-compose logs --tail=20 code-server

# Step 7: Test instructions
echo ""
echo "=========================================="
echo "Manual Testing Instructions"
echo "=========================================="
echo ""
echo "1. Open browser and go to: http://localhost:2308"
echo "2. Login with your credentials"
echo "3. Navigate to an exam and select a problem"
echo "4. Click 'Code bài này' button"
echo "5. Select 'Workspace (Multi-file + Terminal)' option"
echo "6. Open browser console (F12) to see logs"
echo ""
echo "Expected behavior:"
echo "  - Workspace page loads without errors"
echo "  - Code-server iframe loads successfully"
echo "  - Terminal is accessible and functional"
echo "  - File editor works properly"
echo "  - No WebSocket close errors (status code 1006)"
echo ""
echo "Check logs with:"
echo "  docker-compose logs -f web        # Web service logs"
echo "  docker-compose logs -f code-server # Code-server logs"
echo ""
echo "Look for these log patterns:"
echo "  [Code-Server Proxy HTTP] - HTTP requests to code-server"
echo "  [Code-Server Proxy WS] - WebSocket upgrade requests"
echo "  [WebSocket Upgrade] - WebSocket upgrade handling"
echo "  [Workspace] - Client-side workspace logs (in browser console)"
echo ""
echo "=========================================="
print_success "Test setup completed!"
echo "=========================================="

