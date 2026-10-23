cd "C:\Users\Irish Jane\OneDrive\Documents\Documents\Zion-Catering-Services--Server"
npm.cmd start-- Zion Catering Services Management System
-- Normalized MySQL Database Schema
-- Database: bisublar_zc

CREATE DATABASE IF NOT EXISTS bisublar_zc CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE bisublar_zc;

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS contact_inquiries;
DROP TABLE IF EXISTS reviews_feedback;
DROP TABLE IF EXISTS event_tasks;
DROP TABLE IF EXISTS event_staff_assignments;
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS booking_addons;
DROP TABLE IF EXISTS bookings;
DROP TABLE IF EXISTS package_addon_links;
DROP TABLE IF EXISTS addons;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS package_inclusions;
DROP TABLE IF EXISTS packages;
DROP TABLE IF EXISTS staff_profiles;
DROP TABLE IF EXISTS customer_saved_venues;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS users;

SET FOREIGN_KEY_CHECKS = 1;

-- 1. Central Users & Authentication
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    firstName VARCHAR(100) NOT NULL,
    lastName VARCHAR(100) NOT NULL,
    email VARCHAR(191) UNIQUE NULL,
    phone VARCHAR(30) UNIQUE NULL,
    passwordHash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'admin', 'staff') NOT NULL DEFAULT 'customer',
    status ENUM('active', 'inactive', 'suspended') NOT NULL DEFAULT 'active',
    avatarUrl VARCHAR(255) NULL,
    createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_user_role (role),
    INDEX idx_user_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Customer Profiles
CREATE TABLE customers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    alt_phone VARCHAR(30) NULL,
    address TEXT NULL,
    city VARCHAR(100) DEFAULT 'Tagbilaran City',
    province VARCHAR(100) DEFAULT 'Bohol',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Customer Saved Venues
CREATE TABLE customer_saved_venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    name VARCHAR(150) NOT NULL,
    address TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_venue_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Staff Profiles
CREATE TABLE staff_profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    position VARCHAR(100) NOT NULL,
    department ENUM('kitchen', 'service', 'logistics', 'coordination') NOT NULL DEFAULT 'service',
    hire_date DATE NULL,
    status ENUM('available', 'on_duty', 'on_leave', 'inactive') NOT NULL DEFAULT 'available',
    emergency_contact_name VARCHAR(100) NULL,
    emergency_contact_phone VARCHAR(30) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. Catering Packages
CREATE TABLE packages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    icon VARCHAR(50) NOT NULL,
    price_per_head DECIMAL(10,2) NOT NULL,
    min_guests INT NOT NULL DEFAULT 20,
    tagline VARCHAR(255) NOT NULL,
    rating DECIMAL(3,2) DEFAULT 5.00,
    badge VARCHAR(50) NULL,
    image_url TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_package_cat (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. Package Inclusions
CREATE TABLE package_inclusions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    package_id INT NOT NULL,
    item_text VARCHAR(255) NOT NULL,
    sort_order INT DEFAULT 0,
    CONSTRAINT fk_inclusion_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 7. Menu Items (Dishes)
CREATE TABLE menu_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(50) NOT NULL,
    description TEXT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 8. Add-on Services
CREATE TABLE addons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    unit_type ENUM('flat', 'per_head') NOT NULL DEFAULT 'flat',
    icon VARCHAR(50) NULL,
    image_url TEXT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 9. Package to Add-on Links
CREATE TABLE package_addon_links (
    package_id INT NOT NULL,
    addon_id INT NOT NULL,
    PRIMARY KEY (package_id, addon_id),
    CONSTRAINT fk_pal_package FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
    CONSTRAINT fk_pal_addon FOREIGN KEY (addon_id) REFERENCES addons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 10. Bookings
CREATE TABLE bookings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_reference VARCHAR(30) UNIQUE NOT NULL,
    customer_id INT NOT NULL,
    package_id INT NOT NULL,
    event_name VARCHAR(150) NULL,
    event_date DATE NOT NULL,
    event_time TIME NOT NULL,
    venue_name VARCHAR(150) NULL,
    venue_address TEXT NOT NULL,
    guest_count INT NOT NULL,
    package_subtotal DECIMAL(10,2) NOT NULL,
    addons_subtotal DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    balance_amount DECIMAL(10,2) NOT NULL,
    status ENUM('confirmed', 'preparing', 'ready', 'delivery', 'served', 'cancelled') NOT NULL DEFAULT 'confirmed',
    special_requests TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_booking_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
    CONSTRAINT fk_booking_package FOREIGN KEY (package_id) REFERENCES packages(id),
    INDEX idx_booking_date (event_date),
    INDEX idx_booking_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 11. Booking Add-ons
CREATE TABLE booking_addons (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    addon_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_ba_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_ba_addon FOREIGN KEY (addon_id) REFERENCES addons(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 12. Payments
CREATE TABLE payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    payment_type ENUM('deposit', 'balance', 'full') NOT NULL DEFAULT 'deposit',
    payment_method ENUM('GCash', 'Bank Transfer', 'Credit / Debit Card', 'Cash on Delivery') NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    reference_number VARCHAR(100) NULL,
    status ENUM('pending', 'verified', 'rejected', 'refunded') NOT NULL DEFAULT 'verified',
    verified_by_user_id INT NULL,
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT NULL,
    CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_payment_verifier FOREIGN KEY (verified_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 13. Event Staff Assignments
CREATE TABLE event_staff_assignments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    staff_profile_id INT NOT NULL,
    assigned_role VARCHAR(100) NOT NULL,
    shift_start DATETIME NULL,
    shift_end DATETIME NULL,
    status ENUM('assigned', 'confirmed', 'completed', 'declined') NOT NULL DEFAULT 'assigned',
    assigned_by_user_id INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_esa_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_esa_staff FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON DELETE CASCADE,
    CONSTRAINT fk_esa_assigner FOREIGN KEY (assigned_by_user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 14. Event Tasks
CREATE TABLE event_tasks (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL,
    staff_profile_id INT NULL,
    title VARCHAR(255) NOT NULL,
    stage ENUM('preparing', 'ready', 'delivery', 'served') NOT NULL DEFAULT 'preparing',
    status ENUM('pending', 'in_progress', 'completed') NOT NULL DEFAULT 'pending',
    due_time TIME NULL,
    completed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_task_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_task_staff FOREIGN KEY (staff_profile_id) REFERENCES staff_profiles(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 15. Reviews & Feedback
CREATE TABLE reviews_feedback (
    id INT AUTO_INCREMENT PRIMARY KEY,
    booking_id INT NOT NULL UNIQUE,
    customer_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_review_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
    CONSTRAINT fk_review_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 16. Contact Inquiries
CREATE TABLE contact_inquiries (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    email VARCHAR(191) NULL,
    phone VARCHAR(50) NULL,
    message TEXT NOT NULL,
    status ENUM('unread', 'read', 'responded', 'archived') NOT NULL DEFAULT 'unread',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 17. Notifications
CREATE TABLE notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    related_booking_id INT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
