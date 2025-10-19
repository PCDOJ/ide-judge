#!/usr/bin/env python3
"""
IDE Judge - User Management Script
Quản lý người dùng trực tiếp qua database
"""

import sys
import os
import mysql.connector
from getpass import getpass
import bcrypt
from datetime import datetime
import subprocess
import json

# Load environment variables
from dotenv import load_dotenv
load_dotenv()

def detect_database_host():
    """
    Tự động detect database host:
    1. Nếu chạy trong Docker container -> dùng 'mariadb'
    2. Nếu chạy ngoài Docker -> dùng 'localhost' hoặc '127.0.0.1'
    3. Kiểm tra docker-compose để lấy port mapping
    """
    db_host = os.getenv('DB_HOST', 'mariadb')
    db_port = int(os.getenv('DB_PORT', 3306))

    # Kiểm tra xem có đang chạy trong Docker container không
    if os.path.exists('/.dockerenv'):
        # Đang chạy trong container -> dùng hostname từ docker-compose
        return db_host, db_port

    # Chạy ngoài Docker -> cần kết nối qua localhost với port mapping
    # Kiểm tra docker-compose để lấy port mapping
    try:
        # Thử lấy thông tin container MariaDB
        result = subprocess.run(
            ['docker', 'inspect', 'ide-judge-mariadb'],
            capture_output=True,
            text=True,
            timeout=5
        )

        if result.returncode == 0:
            container_info = json.loads(result.stdout)
            if container_info:
                # Lấy port mapping
                ports = container_info[0].get('NetworkSettings', {}).get('Ports', {})
                mysql_ports = ports.get('3306/tcp', [])

                if mysql_ports and len(mysql_ports) > 0:
                    host_port = mysql_ports[0].get('HostPort')
                    if host_port:
                        print(f"🔍 Phát hiện MariaDB container với port mapping: localhost:{host_port}")
                        return 'localhost', int(host_port)
    except Exception as e:
        print(f"⚠️  Không thể detect Docker container: {e}")

    # Fallback: thử các options phổ biến
    # Kiểm tra docker-compose.yml để lấy port
    try:
        if os.path.exists('docker-compose.yml'):
            with open('docker-compose.yml', 'r') as f:
                content = f.read()
                # Tìm port mapping cho mariadb (ví dụ: "2310:3306")
                import re
                port_match = re.search(r'ports:.*?-\s*["\']?(\d+):3306["\']?', content, re.DOTALL)
                if port_match:
                    mapped_port = int(port_match.group(1))
                    print(f"🔍 Phát hiện port mapping từ docker-compose.yml: localhost:{mapped_port}")
                    return 'localhost', mapped_port
    except Exception as e:
        print(f"⚠️  Không thể đọc docker-compose.yml: {e}")

    # Default fallback
    print(f"⚠️  Sử dụng cấu hình mặc định: localhost:3306")
    return 'localhost', 3306

# Detect database host and port
detected_host, detected_port = detect_database_host()

# Database configuration
DB_CONFIG = {
    'host': detected_host,
    'user': os.getenv('DB_USER', 'root'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME', 'ide_judge_db'),
    'port': detected_port
}

def get_db_connection():
    """Tạo kết nối database"""
    try:
        conn = mysql.connector.connect(**DB_CONFIG)
        return conn
    except mysql.connector.Error as err:
        print(f"❌ Lỗi kết nối database: {err}")
        sys.exit(1)

def hash_password(password):
    """Hash password với bcrypt"""
    salt = bcrypt.gensalt(rounds=10)
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(password, hashed):
    """Verify password"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def list_users():
    """Liệt kê tất cả users"""
    conn = get_db_connection()
    cursor = conn.cursor(dictionary=True)
    
    try:
        cursor.execute("""
            SELECT id, fullname, username, email, role, created_at, updated_at 
            FROM users 
            ORDER BY created_at DESC
        """)
        users = cursor.fetchall()
        
        if not users:
            print("\n📋 Không có user nào trong hệ thống")
            return
        
        print("\n" + "="*100)
        print(f"{'ID':<5} {'Fullname':<25} {'Username':<20} {'Email':<30} {'Role':<10} {'Created':<20}")
        print("="*100)
        
        for user in users:
            print(f"{user['id']:<5} {user['fullname']:<25} {user['username']:<20} "
                  f"{user['email']:<30} {user['role']:<10} {str(user['created_at']):<20}")
        
        print("="*100)
        print(f"\n✓ Tổng số: {len(users)} users")
        
    except mysql.connector.Error as err:
        print(f"❌ Lỗi: {err}")
    finally:
        cursor.close()
        conn.close()

def create_user():
    """Tạo user mới"""
    print("\n" + "="*50)
    print("  TẠO USER MỚI")
    print("="*50)
    
    # Input thông tin
    fullname = input("\nHọ và tên: ").strip()
    if not fullname:
        print("❌ Họ tên không được để trống")
        return
    
    username = input("Username: ").strip()
    if not username:
        print("❌ Username không được để trống")
        return
    
    email = input("Email: ").strip()
    if not email:
        print("❌ Email không được để trống")
        return
    
    password = getpass("Password: ")
    if not password:
        print("❌ Password không được để trống")
        return
    
    password_confirm = getpass("Xác nhận password: ")
    if password != password_confirm:
        print("❌ Password không khớp")
        return
    
    print("\nChọn vai trò:")
    print("  1. User (người dùng thường)")
    print("  2. Admin (quản trị viên)")
    role_choice = input("Lựa chọn (1/2): ").strip()
    
    if role_choice == '1':
        role = 'user'
    elif role_choice == '2':
        role = 'admin'
    else:
        print("❌ Lựa chọn không hợp lệ")
        return
    
    # Hash password
    hashed_password = hash_password(password)
    
    # Insert vào database
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            INSERT INTO users (fullname, username, email, password, role)
            VALUES (%s, %s, %s, %s, %s)
        """, (fullname, username, email, hashed_password, role))
        
        conn.commit()
        user_id = cursor.lastrowid
        
        print("\n" + "="*50)
        print("✅ Tạo user thành công!")
        print("="*50)
        print(f"ID: {user_id}")
        print(f"Họ tên: {fullname}")
        print(f"Username: {username}")
        print(f"Email: {email}")
        print(f"Vai trò: {role}")
        print("="*50)
        
    except mysql.connector.Error as err:
        if err.errno == 1062:  # Duplicate entry
            print(f"❌ Username hoặc email đã tồn tại")
        else:
            print(f"❌ Lỗi: {err}")
    finally:
        cursor.close()
        conn.close()

def delete_user():
    """Xóa user"""
    print("\n" + "="*50)
    print("  XÓA USER")
    print("="*50)
    
    # Hiển thị danh sách users
    list_users()
    
    user_id = input("\nNhập ID user cần xóa (hoặc 'q' để hủy): ").strip()
    if user_id.lower() == 'q':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID không hợp lệ")
        return
    
    # Xác nhận
    confirm = input(f"\n⚠️  Bạn có chắc muốn xóa user ID {user_id}? (yes/no): ").strip().lower()
    if confirm != 'yes':
        print("❌ Đã hủy")
        return
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM users WHERE id = %s", (user_id,))
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"\n✅ Đã xóa user ID {user_id}")
        else:
            print(f"\n❌ Không tìm thấy user ID {user_id}")
            
    except mysql.connector.Error as err:
        print(f"❌ Lỗi: {err}")
    finally:
        cursor.close()
        conn.close()

def change_password():
    """Đổi password user"""
    print("\n" + "="*50)
    print("  ĐỔI PASSWORD")
    print("="*50)
    
    # Hiển thị danh sách users
    list_users()
    
    user_id = input("\nNhập ID user cần đổi password (hoặc 'q' để hủy): ").strip()
    if user_id.lower() == 'q':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID không hợp lệ")
        return
    
    # Nhập password mới
    new_password = getpass("\nPassword mới: ")
    if not new_password:
        print("❌ Password không được để trống")
        return
    
    password_confirm = getpass("Xác nhận password mới: ")
    if new_password != password_confirm:
        print("❌ Password không khớp")
        return
    
    # Hash password
    hashed_password = hash_password(new_password)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE users 
            SET password = %s, updated_at = NOW()
            WHERE id = %s
        """, (hashed_password, user_id))
        
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"\n✅ Đã đổi password cho user ID {user_id}")
        else:
            print(f"\n❌ Không tìm thấy user ID {user_id}")
            
    except mysql.connector.Error as err:
        print(f"❌ Lỗi: {err}")
    finally:
        cursor.close()
        conn.close()

def change_role():
    """Đổi vai trò user"""
    print("\n" + "="*50)
    print("  ĐỔI VAI TRÒ USER")
    print("="*50)
    
    # Hiển thị danh sách users
    list_users()
    
    user_id = input("\nNhập ID user cần đổi vai trò (hoặc 'q' để hủy): ").strip()
    if user_id.lower() == 'q':
        return
    
    try:
        user_id = int(user_id)
    except ValueError:
        print("❌ ID không hợp lệ")
        return
    
    print("\nChọn vai trò mới:")
    print("  1. User (người dùng thường)")
    print("  2. Admin (quản trị viên)")
    role_choice = input("Lựa chọn (1/2): ").strip()
    
    if role_choice == '1':
        new_role = 'user'
    elif role_choice == '2':
        new_role = 'admin'
    else:
        print("❌ Lựa chọn không hợp lệ")
        return
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE users 
            SET role = %s, updated_at = NOW()
            WHERE id = %s
        """, (new_role, user_id))
        
        conn.commit()
        
        if cursor.rowcount > 0:
            print(f"\n✅ Đã đổi vai trò user ID {user_id} thành '{new_role}'")
        else:
            print(f"\n❌ Không tìm thấy user ID {user_id}")
            
    except mysql.connector.Error as err:
        print(f"❌ Lỗi: {err}")
    finally:
        cursor.close()
        conn.close()

def show_menu():
    """Hiển thị menu"""
    print("\n" + "="*50)
    print("  IDE JUDGE - USER MANAGEMENT")
    print("="*50)
    print("  1. Liệt kê tất cả users")
    print("  2. Tạo user mới")
    print("  3. Xóa user")
    print("  4. Đổi password")
    print("  5. Đổi vai trò (user/admin)")
    print("  0. Thoát")
    print("="*50)

def main():
    """Main function"""
    print("\n🚀 IDE Judge - User Management Tool")
    print("📅 " + datetime.now().strftime("%Y-%m-%d %H:%M:%S"))

    # Hiển thị thông tin cấu hình
    print("\n📋 Cấu hình database:")
    print(f"   Host: {DB_CONFIG['host']}")
    print(f"   Port: {DB_CONFIG['port']}")
    print(f"   Database: {DB_CONFIG['database']}")
    print(f"   User: {DB_CONFIG['user']}")

    # Kiểm tra kết nối database
    print("\n🔍 Kiểm tra kết nối database...")
    try:
        conn = get_db_connection()
        print(f"✅ Kết nối thành công!")
        conn.close()
    except Exception as e:
        print(f"❌ Không thể kết nối database: {e}")
        print("\n💡 Gợi ý:")
        print("   1. Kiểm tra MariaDB container có đang chạy không:")
        print("      docker-compose ps mariadb")
        print("   2. Kiểm tra file .env có đúng DB_PASSWORD không")
        print("   3. Nếu chạy ngoài Docker, đảm bảo port mapping đúng")
        sys.exit(1)
    
    while True:
        show_menu()
        choice = input("\nLựa chọn của bạn: ").strip()
        
        if choice == '1':
            list_users()
        elif choice == '2':
            create_user()
        elif choice == '3':
            delete_user()
        elif choice == '4':
            change_password()
        elif choice == '5':
            change_role()
        elif choice == '0':
            print("\n👋 Tạm biệt!")
            break
        else:
            print("\n❌ Lựa chọn không hợp lệ")

if __name__ == "__main__":
    main()

