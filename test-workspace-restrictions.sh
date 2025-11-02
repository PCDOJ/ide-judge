#!/bin/bash
#
# Test script để kiểm tra workspace restrictions
# Script này test các tính năng:
# 1. Chặn mở folder khác
# 2. Chặn mở shell mới (bash, zsh, sh)
# 3. Đảm bảo terminal luôn chạy trong restricted mode
#

echo "========================================="
echo "  Testing Workspace Restrictions"
echo "========================================="
echo ""

# Test 1: Kiểm tra RESTRICTED_MODE environment variable
echo "[Test 1] Checking RESTRICTED_MODE environment variable..."
if [[ -n "$RESTRICTED_MODE" ]]; then
    echo "✅ RESTRICTED_MODE is set: $RESTRICTED_MODE"
else
    echo "❌ RESTRICTED_MODE is NOT set"
fi
echo ""

# Test 2: Thử chạy bash command
echo "[Test 2] Testing bash command blocking..."
bash -c "echo 'This should not appear'" 2>&1 | head -n 1
echo ""

# Test 3: Thử chạy zsh command
echo "[Test 3] Testing zsh command blocking..."
zsh -c "echo 'This should not appear'" 2>&1 | head -n 1
echo ""

# Test 4: Thử chạy sh command
echo "[Test 4] Testing sh command blocking..."
sh -c "echo 'This should not appear'" 2>&1 | head -n 1
echo ""

# Test 5: Kiểm tra cd .. blocking
echo "[Test 5] Testing cd .. blocking..."
cd .. 2>&1 | head -n 1
echo "Current directory: $(pwd)"
echo ""

# Test 6: Kiểm tra sudo blocking
echo "[Test 6] Testing sudo blocking..."
sudo ls 2>&1 | head -n 1
echo ""

# Test 7: Kiểm tra allowed directory
echo "[Test 7] Checking ALLOWED_DIR..."
if [[ -n "$ALLOWED_DIR" ]]; then
    echo "✅ ALLOWED_DIR is set: $ALLOWED_DIR"
else
    echo "❌ ALLOWED_DIR is NOT set"
fi
echo ""

# Test 8: Kiểm tra các lệnh được phép
echo "[Test 8] Testing allowed commands..."
echo "Testing ls:"
ls -la | head -n 3
echo ""
echo "Testing pwd:"
pwd
echo ""
echo "Testing echo:"
echo "Hello from restricted shell"
echo ""

# Test 9: Kiểm tra compile commands
echo "[Test 9] Testing compiler availability..."
which g++ 2>/dev/null && echo "✅ g++ is available" || echo "❌ g++ is NOT available"
which python3 2>/dev/null && echo "✅ python3 is available" || echo "❌ python3 is NOT available"
which javac 2>/dev/null && echo "✅ javac is available" || echo "❌ javac is NOT available"
echo ""

echo "========================================="
echo "  Test Summary"
echo "========================================="
echo "All tests completed. Review the output above."
echo "Expected behavior:"
echo "  - bash, zsh, sh commands should be blocked"
echo "  - cd .. should be blocked"
echo "  - sudo should be blocked"
echo "  - RESTRICTED_MODE should be set"
echo "  - ALLOWED_DIR should be set"
echo "  - Compilers should be available"
echo "========================================="

