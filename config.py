import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'taste_and_trend_adaptive_secret_key')
    
    # MySQL Settings
    MYSQL_HOST = os.environ.get('MYSQL_HOST', 'localhost')
    MYSQL_USER = os.environ.get('MYSQL_USER', 'root')
    MYSQL_PASSWORD = os.environ.get('MYSQL_PASSWORD', '')
    MYSQL_DB = os.environ.get('MYSQL_DB', 'taste_and_trend_db')
    MYSQL_PORT = int(os.environ.get('MYSQL_PORT', 3306))
    
    # SQLite Fallback File
    SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), 'taste_and_trend.db')
    DATABASE = SQLITE_DB_PATH
    DEBUG = True
    
    # Adaptive Compression Parameters
    LOW_TIER_IMAGE_QUALITY = 35  # WebP quality target for 2G/3G/Low RAM (sub-1.8s LCP)
    HIGH_TIER_IMAGE_QUALITY = 85 # Full quality target for 4G/5G