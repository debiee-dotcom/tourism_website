USE tourism_booking;

-- 1. Users
CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    email VARCHAR(150) NOT NULL UNIQUE,
    mobile VARCHAR(10) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('customer', 'provider', 'admin', 'super_admin')
        NOT NULL DEFAULT 'customer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Destinations
CREATE TABLE destinations (
    destination_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    image_url VARCHAR(500)
);

-- 3. Categories
CREATE TABLE categories (
    category_id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
);

-- 4. Packages
CREATE TABLE packages (
    package_id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    destination_id INT NOT NULL,
    category_id INT NOT NULL,
    duration INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    available_from DATE,
    badge VARCHAR(50),
    image_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (destination_id)
        REFERENCES destinations(destination_id),

    FOREIGN KEY (category_id)
        REFERENCES categories(category_id),

    CHECK (duration > 0),
    CHECK (price >= 0)
);

-- 5. Package modes (supports multiple modes per package)
CREATE TABLE package_modes (
    package_id INT NOT NULL,
    mode ENUM('tribe', 'legends', 'eco') NOT NULL,

    PRIMARY KEY (package_id, mode),

    FOREIGN KEY (package_id)
        REFERENCES packages(package_id)
        ON DELETE CASCADE
);