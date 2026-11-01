-- Fresh-install schema for the combined LocalTrails application (MySQL 8+).
-- DO NOT run this over existing data without a backup/migration review.
CREATE DATABASE IF NOT EXISTS tourism_booking CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tourism_booking;
CREATE TABLE IF NOT EXISTS users (
  user_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(80) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE, mobile VARCHAR(10) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('customer','provider','admin','super_admin') NOT NULL DEFAULT 'customer',
  status ENUM('pending','active','rejected','blocked') NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS destinations (
  destination_id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE, description TEXT, image_url VARCHAR(500)
);
CREATE TABLE IF NOT EXISTS categories (
  category_id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS packages (
  package_id INT AUTO_INCREMENT PRIMARY KEY,
  provider_id INT NOT NULL, title VARCHAR(150) NOT NULL,
  destination_id INT NOT NULL, category_id INT NOT NULL,
  duration INT NOT NULL, price DECIMAL(10,2) NOT NULL,
  available_from DATE, badge VARCHAR(50), image_url VARCHAR(500),
  description TEXT, capacity INT NOT NULL DEFAULT 1,
  status ENUM('pending','active','rejected','inactive') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(provider_id) REFERENCES users(user_id),
  FOREIGN KEY(destination_id) REFERENCES destinations(destination_id),
  FOREIGN KEY(category_id) REFERENCES categories(category_id)
);
CREATE TABLE IF NOT EXISTS package_modes (
  package_id INT NOT NULL, mode ENUM('tribe','legends','eco') NOT NULL,
  PRIMARY KEY(package_id,mode),
  FOREIGN KEY(package_id) REFERENCES packages(package_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS package_availability (
  availability_id INT AUTO_INCREMENT PRIMARY KEY, package_id INT NOT NULL,
  available_date DATE NOT NULL, total_capacity INT NOT NULL,
  booked_seats INT NOT NULL DEFAULT 0,
  status ENUM('available','closed') NOT NULL DEFAULT 'available',
  UNIQUE KEY unique_package_date(package_id,available_date),
  FOREIGN KEY(package_id) REFERENCES packages(package_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS bookings (
  booking_id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL, package_id INT NOT NULL, availability_id INT NOT NULL,
  number_of_people INT NOT NULL, total_amount DECIMAL(12,2) NOT NULL,
  booking_status ENUM('pending','confirmed','completed','cancelled') NOT NULL DEFAULT 'pending',
  booking_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES users(user_id),
  FOREIGN KEY(package_id) REFERENCES packages(package_id),
  FOREIGN KEY(availability_id) REFERENCES package_availability(availability_id)
);
CREATE TABLE IF NOT EXISTS payments (
  payment_id INT AUTO_INCREMENT PRIMARY KEY, booking_id INT NOT NULL,
  amount DECIMAL(12,2) NOT NULL, payment_method VARCHAR(40) NOT NULL,
  transaction_id VARCHAR(100) UNIQUE,
  payment_status ENUM('success','failed','refunded','pending') NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(booking_id) REFERENCES bookings(booking_id)
);
CREATE TABLE IF NOT EXISTS reviews (
  review_id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE, customer_id INT NOT NULL, package_id INT NOT NULL,
  rating INT NOT NULL, comment TEXT, review_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(booking_id) REFERENCES bookings(booking_id),
  FOREIGN KEY(customer_id) REFERENCES users(user_id),
  FOREIGN KEY(package_id) REFERENCES packages(package_id)
);
CREATE TABLE IF NOT EXISTS admin_permissions (
  permission_id INT AUTO_INCREMENT PRIMARY KEY, admin_id INT NOT NULL,
  permission_name VARCHAR(100) NOT NULL, UNIQUE KEY permission_unique(admin_id,permission_name),
  FOREIGN KEY(admin_id) REFERENCES users(user_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS system_logs (
  log_id INT AUTO_INCREMENT PRIMARY KEY, user_id INT,
  action VARCHAR(120) NOT NULL, description TEXT, ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
-- Add your own destinations/categories and an authorized admin account before testing.
