#!/bin/bash

# IDE Judge - User Management Script Wrapper
# Tự động cài đặt dependencies và chạy manage.py

echo "========================================="
echo "  IDE Judge - User Management"
echo "========================================="
echo ""

# Kiểm tra Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 chưa được cài đặt"
    echo "Cài đặt Python3:"
    echo "  Ubuntu/Debian: sudo apt install -y python3 python3-pip"
    echo "  CentOS/RHEL: sudo yum install -y python3 python3-pip"
    exit 1
fi

echo "✓ Python3: $(python3 --version)"

# Kiểm tra pip3
if ! command -v pip3 &> /dev/null; then
    echo "❌ pip3 chưa được cài đặt"
    echo "Cài đặt pip3:"
    echo "  Ubuntu/Debian: sudo apt install -y python3-pip"
    exit 1
fi

echo "✓ pip3: $(pip3 --version)"
echo ""

# Kiểm tra và cài đặt dependencies
echo "🔍 Kiểm tra Python dependencies..."

check_and_install() {
    package=$1
    if python3 -c "import $package" 2>/dev/null; then
        echo "  ✓ $package đã cài đặt"
        return 0
    else
        echo "  ⚠ $package chưa cài đặt"
        return 1
    fi
}

need_install=false

if ! check_and_install "mysql.connector"; then
    need_install=true
fi

if ! check_and_install "dotenv"; then
    need_install=true
fi

if ! check_and_install "bcrypt"; then
    need_install=true
fi

if [ "$need_install" = true ]; then
    echo ""
    echo "📦 Cài đặt dependencies..."
    
    if [ -f "requirements-manage.txt" ]; then
        pip3 install -r requirements-manage.txt
    else
        pip3 install mysql-connector-python python-dotenv bcrypt
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Cài đặt thành công!"
    else
        echo "❌ Cài đặt thất bại"
        exit 1
    fi
fi

echo ""
echo "🚀 Khởi động User Management Tool..."
echo ""

# Chạy manage.py
python3 manage.py

exit $?

