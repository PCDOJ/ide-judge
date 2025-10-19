#!/bin/bash

# Script to stop the IDE Judge system

echo "========================================="
echo "  Stopping IDE Judge System"
echo "========================================="
echo ""

# Stop containers
echo "Stopping containers..."
docker-compose down

echo ""
echo "✓ All containers stopped"
echo ""
echo "To remove volumes (WARNING: This will delete all data):"
echo "  docker-compose down -v"
echo ""

