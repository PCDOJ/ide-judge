-- Create database if not exists
CREATE DATABASE IF NOT EXISTS ide_judge_db;
USE ide_judge_db;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fullname VARCHAR(100) NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'admin') DEFAULT 'user',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Insert default admin user (password: admin123)
-- Password hash generated with bcrypt for 'admin123'
INSERT INTO users (fullname, username, email, password, role)
VALUES ('Administrator', 'admin', 'admin@example.com', '$2a$10$rKvXqKGKqKqKOXxJxJxJxOXxJxJxJxJxJxJxJxJxJxJxJxJxJxJxJ', 'admin')
ON DUPLICATE KEY UPDATE username=username;

-- Create index for faster queries
CREATE INDEX idx_username ON users(username);
CREATE INDEX idx_email ON users(email);
CREATE INDEX idx_role ON users(role);

