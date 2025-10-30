#!/bin/bash
#
# Test Restricted Terminal Commands
# Script để test các lệnh bị chặn và lệnh hợp lệ
#

echo "========================================="
echo "  Test Restricted Terminal Commands"
echo "========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test command
test_command() {
    local description="$1"
    local command="$2"
    local should_pass="$3"  # "pass" or "fail"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    echo -n "Test $TOTAL_TESTS: $description ... "
    
    # Execute command in container
    RESULT=$(docker exec -w /workspace ide-judge-code-server /usr/local/bin/restricted-shell.sh "$command" 2>&1)
    EXIT_CODE=$?
    
    if [ "$should_pass" = "pass" ]; then
        # Command should succeed
        if [ $EXIT_CODE -eq 0 ]; then
            echo -e "${GREEN}✓ PASS${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ FAIL${NC}"
            echo "  Expected: SUCCESS, Got: FAILURE"
            echo "  Output: $RESULT"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        # Command should fail
        if [ $EXIT_CODE -ne 0 ]; then
            echo -e "${GREEN}✓ PASS${NC} (correctly blocked)"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}✗ FAIL${NC}"
            echo "  Expected: BLOCKED, Got: SUCCESS"
            echo "  Output: $RESULT"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    fi
}

echo "=== Testing Forbidden Commands (should be blocked) ==="
echo ""

test_command "Block cd .." "cd .." "fail"
test_command "Block cd /workspace" "cd /workspace" "fail"
test_command "Block cd /etc" "cd /etc" "fail"
test_command "Block sudo ls" "sudo ls" "fail"
test_command "Block sudo rm" "sudo rm -rf /" "fail"
test_command "Block path traversal" "cat ../test.txt" "fail"
test_command "Block /etc access" "cat /etc/passwd" "fail"
test_command "Block rm -rf *" "rm -rf *" "fail"
test_command "Block rm -rf /" "rm -rf /" "fail"
test_command "Block chmod" "chmod 777 /etc/passwd" "fail"
test_command "Block chown" "chown root:root test.txt" "fail"

echo ""
echo "=== Testing Allowed Commands (should pass) ==="
echo ""

# Create test workspace first
docker exec ide-judge-code-server mkdir -p /workspace/test_user/contest_1/problem_1 2>/dev/null || true
docker exec ide-judge-code-server bash -c "echo 'int main() { return 0; }' > /workspace/test_user/contest_1/problem_1/test.cpp" 2>/dev/null || true
docker exec ide-judge-code-server bash -c "echo 'print(\"hello\")' > /workspace/test_user/contest_1/problem_1/test.py" 2>/dev/null || true

# Change to test workspace
docker exec ide-judge-code-server bash -c "cd /workspace/test_user/contest_1/problem_1 && /usr/local/bin/restricted-shell.sh 'ls'" > /dev/null 2>&1

test_command "Allow ls" "ls" "pass"
test_command "Allow pwd" "pwd" "pass"
test_command "Allow cat" "cat test.cpp" "pass"
test_command "Allow echo" "echo 'hello world'" "pass"
test_command "Allow g++ compile" "g++ --version" "pass"
test_command "Allow python" "python3 --version" "pass"
test_command "Allow java" "java -version" "pass"
test_command "Allow touch" "touch newfile.txt" "pass"
test_command "Allow mkdir" "mkdir testdir" "pass"
test_command "Allow grep" "echo 'test' | grep test" "pass"

echo ""
echo "========================================="
echo "  Test Results"
echo "========================================="
echo "Total tests: $TOTAL_TESTS"
echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
echo -e "${RED}Failed: $FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    exit 1
fi

