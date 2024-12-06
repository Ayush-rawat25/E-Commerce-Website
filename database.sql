CREATE DATABASE ecommerce_db;

USE ecommerce_db;

CREATE TABLE users (
    id INT AUTO_INCREMENT UNIQUE,
    email VARCHAR(255) PRIMARY KEY,
    password VARCHAR(255) NOT NULL,
    address VARCHAR(255)
);

CREATE TABLE product (
    id INT AUTO_INCREMENT UNIQUE,
    name VARCHAR(255) PRIMARY KEY,
    price DECIMAL(10, 2),
    description TEXT,
    image_url VARCHAR(255)
);

CREATE TABLE cart (
    user_email VARCHAR(255),
    product_name VARCHAR(255),
    quantity INT DEFAULT 1,
    PRIMARY KEY (user_email, product_name),
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (product_name) REFERENCES product(name)
);

CREATE TABLE orders (
    user_email VARCHAR(255),
    product_name VARCHAR(255),
    quantity INT DEFAULT 1,
    price INT,
    date DATE,
    PRIMARY KEY (user_email, product_name),
    FOREIGN KEY (user_email) REFERENCES users(email),
    FOREIGN KEY (product_name) REFERENCES product(name)
);

