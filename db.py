import sqlite3
import json
import os
import mysql.connector
from config import Config

USE_MYSQL = True

def test_mysql_connection():
    try:
        conn = mysql.connector.connect(
            host=Config.MYSQL_HOST,
            user=Config.MYSQL_USER,
            password=Config.MYSQL_PASSWORD,
            port=Config.MYSQL_PORT,
            connection_timeout=2
        )
        if conn.is_connected():
            cursor = conn.cursor()
            cursor.execute(f"CREATE DATABASE IF NOT EXISTS {Config.MYSQL_DB}")
            cursor.close()
            conn.close()
            return True
    except Exception as e:
        print(f"[Database Notice] MySQL Connection unavailable ({e}). Falling back to SQLite for seamless execution.")
        return False
    return False

def get_db_connection():
    global USE_MYSQL
    if USE_MYSQL:
        try:
            conn = mysql.connector.connect(
                host=Config.MYSQL_HOST,
                user=Config.MYSQL_USER,
                password=Config.MYSQL_PASSWORD,
                database=Config.MYSQL_DB,
                port=Config.MYSQL_PORT
            )
            return conn, 'mysql'
        except Exception:
            USE_MYSQL = False
    
    # SQLite Fallback
    conn = sqlite3.connect(Config.SQLITE_DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn, 'sqlite'

def init_db(app=None):
    global USE_MYSQL
    USE_MYSQL = test_mysql_connection()
    conn, db_type = get_db_connection()
    cursor = conn.cursor()
    
    if db_type == 'mysql':
        # MySQL Schema Initialization
        tables_to_create = [
            """
            CREATE TABLE IF NOT EXISTS categories (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                department ENUM('food', 'dress') NOT NULL,
                description TEXT,
                icon VARCHAR(50) DEFAULT 'fa-box'
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS products (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(150) NOT NULL,
                description TEXT,
                price DECIMAL(10, 2) NOT NULL,
                department ENUM('food', 'dress') NOT NULL,
                category_id INT,
                image_url VARCHAR(500),
                stock INT DEFAULT 50,
                rating DECIMAL(3, 2) DEFAULT 4.5,
                attributes JSON,
                is_featured BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS orders (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_number VARCHAR(50) NOT NULL UNIQUE,
                customer_name VARCHAR(100) NOT NULL,
                customer_email VARCHAR(150) NOT NULL,
                customer_phone VARCHAR(20) NOT NULL,
                shipping_address TEXT NOT NULL,
                payment_method VARCHAR(50) DEFAULT 'Card',
                total_amount DECIMAL(10, 2) NOT NULL,
                status VARCHAR(50) DEFAULT 'Processing',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            """,
            """
            CREATE TABLE IF NOT EXISTS order_items (
                id INT AUTO_INCREMENT PRIMARY KEY,
                order_id INT NOT NULL,
                product_id INT NOT NULL,
                product_name VARCHAR(150) NOT NULL,
                unit_price DECIMAL(10, 2) NOT NULL,
                quantity INT NOT NULL,
                selected_options VARCHAR(255),
                total_price DECIMAL(10, 2) NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
            );
            """
        ]
        for query in tables_to_create:
            cursor.execute(query)
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) FROM categories")
        count = cursor.fetchone()[0]
        if count == 0:
            seed_data(cursor, 'mysql')
            conn.commit()
    else:
        # SQLite Schema Initialization
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                department TEXT NOT NULL,
                description TEXT,
                icon TEXT DEFAULT 'fa-box'
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                description TEXT,
                price REAL NOT NULL,
                department TEXT NOT NULL,
                category_id INTEGER,
                image_url TEXT,
                stock INTEGER DEFAULT 50,
                rating REAL DEFAULT 4.5,
                attributes TEXT,
                is_featured INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (category_id) REFERENCES categories(id)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_number TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                customer_email TEXT NOT NULL,
                customer_phone TEXT NOT NULL,
                shipping_address TEXT NOT NULL,
                payment_method TEXT DEFAULT 'Card',
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'Processing',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                product_name TEXT NOT NULL,
                unit_price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                selected_options TEXT,
                total_price REAL NOT NULL,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            );
        """)
        conn.commit()
        
        cursor.execute("SELECT COUNT(*) FROM categories")
        count = cursor.fetchone()[0]
        if count == 0:
            seed_data(cursor, 'sqlite')
            conn.commit()
            
    cursor.close()
    conn.close()
    print(f"[Database Initialization] Successfully initialized database via {db_type.upper()}")

def close_db(e=None):
    pass

def seed_data(cursor, db_type):
    categories = [
        (1, 'Gourmet Pizza & Pasta', 'food', 'Freshly baked artisanal pizzas and handcrafted pastas', 'fa-pizza-slice'),
        (2, 'Burgers & Bites', 'food', 'Juicy burgers, crispy wings, and quick bites', 'fa-hamburger'),
        (3, 'Fresh Bowls & Salads', 'food', 'Nutritious, organic ingredient bowls and salads', 'fa-seedling'),
        (4, 'Desserts & Sweets', 'food', 'Decadent cakes, pastries, and ice creams', 'fa-ice-cream'),
        (5, 'Artisanal Beverages', 'food', 'Fresh juices, smoothies, and craft brews', 'fa-mug-hot'),
        (6, 'Casual & Daily Wear', 'dress', 'Comfortable everyday wear and casual outfits', 'fa-tshirt'),
        (7, 'Formal & Party Wear', 'dress', 'Elegant evening gowns, suits, and dresses', 'fa-user-tie'),
        (8, 'Ethnic & Designer', 'dress', 'Traditional wear, designer kurtis, and festive attires', 'fa-gem'),
        (9, 'Outerwear & Jackets', 'dress', 'Stylish denim coats, leather jackets, and hoodies', 'fa-vest')
    ]
    
    products = [
        # FOOD
        (1, 'Truffle Mushroom Artisan Pizza', 'Wood-fired sourdough base topped with wild mushrooms, white truffle oil, and mozzarella.', 18.99, 'food', 1, 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=600&q=80', 30, 4.9, json.dumps({"prep_time": "25 mins", "calories": "680 kcal", "is_veg": True, "spicy": "Mild"}), 1),
        (2, 'Smoky BBQ Bacon Cheeseburger', 'Angus beef patty layered with aged cheddar, crispy bacon, caramelized onions, and house BBQ sauce.', 14.50, 'food', 2, 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&q=80', 40, 4.8, json.dumps({"prep_time": "15 mins", "calories": "850 kcal", "is_veg": False, "spicy": "Medium"}), 1),
        (3, 'Avocado & Quinoa Buddha Bowl', 'Organic quinoa, fresh sliced avocado, roasted chickpeas, kale, cherry tomatoes, and tahini dressing.', 12.99, 'food', 3, 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80', 25, 4.7, json.dumps({"prep_time": "10 mins", "calories": "420 kcal", "is_veg": True, "spicy": "None"}), 0),
        (4, 'Belgian Dark Chocolate Lava Cake', 'Warm molten dark chocolate cake served with vanilla bean gelato and fresh berries.', 8.99, 'food', 4, 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80', 20, 4.9, json.dumps({"prep_time": "12 mins", "calories": "510 kcal", "is_veg": True, "spicy": "None"}), 1),
        (5, 'Matcha Green Tea Iced Latte', 'Premium Japanese ceremonial grade matcha whisked with oat milk and honey.', 5.75, 'food', 5, 'https://images.unsplash.com/photo-1536256263959-770b48d82b0a?auto=format&fit=crop&w=600&q=80', 50, 4.6, json.dumps({"prep_time": "5 mins", "calories": "180 kcal", "is_veg": True, "spicy": "None"}), 0),
        (6, 'Creamy Fettuccine Alfredo', 'Handmade egg fettuccine tossed in rich parmesan cream sauce with roasted garlic and herbs.', 15.25, 'food', 1, 'https://images.unsplash.com/photo-1645112411341-6c4fd023714a?auto=format&fit=crop&w=600&q=80', 35, 4.7, json.dumps({"prep_time": "20 mins", "calories": "720 kcal", "is_veg": True, "spicy": "None"}), 0),
        
        # DRESS
        (7, 'Floral Printed Silk Maxi Dress', 'Elegant full-length silk dress featuring vibrant botanical prints, wrapped waist, and flowing skirt.', 79.99, 'dress', 7, 'https://images.unsplash.com/photo-1572804013309-59a88b7e92f1?auto=format&fit=crop&w=600&q=80', 15, 4.9, json.dumps({"sizes": ["XS", "S", "M", "L", "XL"], "colors": ["Emerald Green", "Blush Pink", "Midnight Blue"], "fabric": "100% Mulberry Silk"}), 1),
        (8, 'Classic Denim Trucker Jacket', 'Timeless vintage wash cotton denim jacket with button chest pockets and adjustable waist tabs.', 64.50, 'dress', 9, 'https://images.unsplash.com/photo-1523205771623-e0faa4d2813d?auto=format&fit=crop&w=600&q=80', 25, 4.8, json.dumps({"sizes": ["S", "M", "L", "XL"], "colors": ["Vintage Blue", "Washed Black"], "fabric": "100% Cotton Denim"}), 1),
        (9, 'Minimalist Linen Summer Shirt', 'Breathable relaxed-fit linen button-down shirt ideal for warm sunny days and beach outings.', 42.00, 'dress', 6, 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=600&q=80', 40, 4.6, json.dumps({"sizes": ["S", "M", "L", "XL", "XXL"], "colors": ["Crisp White", "Sand Beige", "Sky Blue"], "fabric": "Pure French Linen"}), 0),
        (10, 'Hand-Embroidered Anarkali Suit', 'Graceful floor-length ethnic dress adorned with detailed Zari embroidery, with dupatta and pants.', 120.00, 'dress', 8, 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=600&q=80', 10, 5.0, json.dumps({"sizes": ["S", "M", "L", "XL"], "colors": ["Royal Maroon", "Mustard Gold"], "fabric": "Georgette with Silk Dupatta"}), 1),
        (11, 'Tailored Slim Fit Cocktail Blazer', 'Sharp single-breasted blazer with satin lapels, modern fit, and interior chest pockets.', 115.00, 'dress', 7, 'https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80', 18, 4.8, json.dumps({"sizes": ["38R", "40R", "42R", "44R"], "colors": ["Charcoal Gray", "Jet Black", "Navy Blue"], "fabric": "Wool Blend"}), 0),
        (12, 'High-Waisted Pleated A-Line Skirt', 'Chic midi pleated skirt crafted with smooth satin finish and stretchy comfortable waistband.', 38.50, 'dress', 6, 'https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?auto=format&fit=crop&w=600&q=80', 30, 4.7, json.dumps({"sizes": ["XS", "S", "M", "L"], "colors": ["Champagne Gold", "Black", "Rose Gold"], "fabric": "Satin Polyester"}), 0)
    ]
    
    ph = "%s" if db_type == 'mysql' else "?"
    cursor.executemany(f"INSERT INTO categories (id, name, department, description, icon) VALUES ({ph},{ph},{ph},{ph},{ph})", categories)
    cursor.executemany(f"INSERT INTO products (id, name, description, price, department, category_id, image_url, stock, rating, attributes, is_featured) VALUES ({ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph},{ph})", products)

def query_all(sql, params=()):
    conn, db_type = get_db_connection()
    ph = "%s" if db_type == 'mysql' else "?"
    sql = sql.replace("%s", ph)
    
    if db_type == 'mysql':
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params)
        results = cursor.fetchall()
    else:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        rows = cursor.fetchall()
        results = [dict(row) for row in rows]
        
    cursor.close()
    conn.close()
    return results

def query_one(sql, params=()):
    conn, db_type = get_db_connection()
    ph = "%s" if db_type == 'mysql' else "?"
    sql = sql.replace("%s", ph)
    
    if db_type == 'mysql':
        cursor = conn.cursor(dictionary=True)
        cursor.execute(sql, params)
        result = cursor.fetchone()
    else:
        cursor = conn.cursor()
        cursor.execute(sql, params)
        row = cursor.fetchone()
        result = dict(row) if row else None
        
    cursor.close()
    conn.close()
    return result

def execute_commit(sql, params=()):
    conn, db_type = get_db_connection()
    ph = "%s" if db_type == 'mysql' else "?"
    sql = sql.replace("%s", ph)
    
    cursor = conn.cursor()
    cursor.execute(sql, params)
    last_id = cursor.lastrowid
    conn.commit()
    cursor.close()
    conn.close()
    return last_id