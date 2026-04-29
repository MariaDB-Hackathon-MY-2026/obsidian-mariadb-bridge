import mariadb
import sys

def get_connection(config):
    return mariadb.connect(
        host=config['db_host'],
        user=config['db_user'],
        password=config['db_password'],
        port=3306,
        database=config['db_name']
    )

def initialize_db(config):
    try:
        conn = mariadb.connect(
            host=config['db_host'],
            user=config['db_user'],
            password=config['db_password']
        )
        cur = conn.cursor()
        cur.execute(f"CREATE DATABASE IF NOT EXISTS {config['db_name']}")
        cur.execute(f"USE {config['db_name']}")
        
        # Metadata Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS notes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                file_path VARCHAR(512) UNIQUE,
                file_name VARCHAR(255),
                tags TEXT,
                last_modified DATETIME
            )
        """)
        
        # Vector Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS note_chunks (
                id INT AUTO_INCREMENT PRIMARY KEY,
                note_id INT,
                content MEDIUMTEXT,
                embedding VECTOR(384) NOT NULL,
                FOREIGN KEY (note_id) REFERENCES notes(id) ON DELETE CASCADE,
                VECTOR INDEX (embedding)
            )
        """)
        # Migration: Ensure column is MEDIUMTEXT
        cur.execute("ALTER TABLE note_chunks MODIFY COLUMN content MEDIUMTEXT")
        conn.commit()
        conn.close()
        print("✅ Database initialized successfully.")
    except mariadb.Error as e:
        if "auth_gssapi_client" in str(e):
            print("\n🚨 AUTHENTICATION PROTOCOL ERROR DETECTED")
            print("Your MariaDB user is configured to use Kerberos/GSSAPI, which is not supported in this environment.")
            print("\nFIX: Run this SQL in your MariaDB console to change the authentication method:")
            print(f"ALTER USER '{config['db_user']}'@'localhost' IDENTIFIED VIA mysql_native_password USING PASSWORD('{config['db_password']}');")
            print("FLUSH PRIVILEGES;")
            print("-" * 50)
        else:
            print(f"❌ Database connection failed: {e}")
        raise e

def reset_db(config):
    try:
        conn = get_connection(config)
        cur = conn.cursor()
        # Cascade will handle note_chunks deletion via FOREIGN KEY ON DELETE CASCADE
        cur.execute("SET FOREIGN_KEY_CHECKS = 0")
        cur.execute("TRUNCATE TABLE note_chunks")
        cur.execute("TRUNCATE TABLE notes")
        cur.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        conn.close()
        print("🧹 Database wiped for fresh neural sync.")
    except Exception as e:
        print(f"⚠️ Could not reset database: {e}")
