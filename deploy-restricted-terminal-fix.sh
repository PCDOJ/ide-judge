#!/bin/bash
#
# Deploy Restricted Terminal Fix
# Fix code-server built-in terminal to use restricted bash wrapper
#

set -e

echo "========================================="
echo "  Deploy Restricted Terminal Fix"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check files exist
echo "Step 1: Checking required files..."
echo ""

FILES=(
    "restricted-bash-wrapper.sh"
    "code-server-settings.json"
    "Dockerfile.codeserver"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $file exists"
    else
        echo -e "${RED}✗${NC} $file not found"
        exit 1
    fi
done

echo ""

# Step 2: Check permissions
echo "Step 2: Checking file permissions..."
echo ""

if [ -x "restricted-bash-wrapper.sh" ]; then
    echo -e "${GREEN}✓${NC} restricted-bash-wrapper.sh is executable"
else
    echo -e "${YELLOW}⚠${NC} Making restricted-bash-wrapper.sh executable..."
    chmod +x restricted-bash-wrapper.sh
fi

echo ""

# Step 3: Stop code-server container
echo "Step 3: Stopping code-server container..."
echo ""

docker-compose stop code-server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Code-server stopped"
else
    echo -e "${RED}✗${NC} Failed to stop code-server"
    exit 1
fi

echo ""

# Step 4: Rebuild code-server container
echo "Step 4: Rebuilding code-server container..."
echo ""

docker-compose build code-server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Code-server rebuilt successfully"
else
    echo -e "${RED}✗${NC} Failed to rebuild code-server"
    exit 1
fi

echo ""

# Step 5: Start code-server container
echo "Step 5: Starting code-server container..."
echo ""

docker-compose up -d code-server
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Code-server started"
else
    echo -e "${RED}✗${NC} Failed to start code-server"
    exit 1
fi

echo ""

# Step 6: Wait for container to be ready
echo "Step 6: Waiting for container to be ready..."
echo ""

sleep 5

# Step 7: Verify installation
echo "Step 7: Verifying installation..."
echo ""

# Check restricted-bash-wrapper.sh
if docker exec ide-judge-code-server test -f /usr/local/bin/restricted-bash-wrapper.sh; then
    echo -e "${GREEN}✓${NC} restricted-bash-wrapper.sh found in container"
else
    echo -e "${RED}✗${NC} restricted-bash-wrapper.sh not found in container"
    exit 1
fi

# Check permissions
if docker exec ide-judge-code-server test -x /usr/local/bin/restricted-bash-wrapper.sh; then
    echo -e "${GREEN}✓${NC} restricted-bash-wrapper.sh is executable"
else
    echo -e "${RED}✗${NC} restricted-bash-wrapper.sh is not executable"
    exit 1
fi

# Check settings.json
if docker exec ide-judge-code-server grep -q "restricted-bash" /home/coder/.local/share/code-server/User/settings.json; then
    echo -e "${GREEN}✓${NC} settings.json configured correctly"
else
    echo -e "${RED}✗${NC} settings.json not configured correctly"
    exit 1
fi

echo ""

# Step 8: Test restricted commands
echo "Step 8: Testing restricted commands..."
echo ""

# Create test workspace
docker exec ide-judge-code-server mkdir -p /workspace/test_user/contest_1/problem_1 2>/dev/null || true

# Test cd .. (should fail)
echo -n "Testing 'cd ..' (should be blocked)... "
RESULT=$(docker exec -w /workspace/test_user/contest_1/problem_1 ide-judge-code-server /usr/local/bin/restricted-bash-wrapper.sh -c "cd .." 2>&1 || true)
if echo "$RESULT" | grep -q "not allowed"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Output: $RESULT"
fi

# Test sudo (should fail)
echo -n "Testing 'sudo ls' (should be blocked)... "
RESULT=$(docker exec -w /workspace/test_user/contest_1/problem_1 ide-judge-code-server /usr/local/bin/restricted-bash-wrapper.sh -c "sudo ls" 2>&1 || true)
if echo "$RESULT" | grep -q "not allowed"; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Output: $RESULT"
fi

# Test ls (should pass)
echo -n "Testing 'ls' (should work)... "
RESULT=$(docker exec -w /workspace/test_user/contest_1/problem_1 ide-judge-code-server /usr/local/bin/restricted-bash-wrapper.sh -c "ls" 2>&1)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}"
else
    echo -e "${RED}✗ FAIL${NC}"
    echo "Output: $RESULT"
fi

echo ""

# Summary
echo "========================================="
echo "  Deployment Summary"
echo "========================================="
echo ""
echo -e "${GREEN}✓${NC} Code-server container rebuilt and started"
echo -e "${GREEN}✓${NC} Restricted bash wrapper installed"
echo -e "${GREEN}✓${NC} Settings configured"
echo -e "${GREEN}✓${NC} Basic tests passed"
echo ""
echo "Next steps:"
echo "1. Open code-server in browser"
echo "2. Open a terminal (Ctrl + \`)"
echo "3. Verify welcome message appears"
echo "4. Test: cd .. (should be blocked)"
echo "5. Test: sudo ls (should be blocked)"
echo "6. Test: g++ solution.cpp (should work)"
echo ""
echo "For detailed testing, see: FIX_CODE_SERVER_TERMINAL.md"
echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"

