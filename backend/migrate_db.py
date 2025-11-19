"""
Database migration script to add encrypted_api_key column to users table.
Run this BEFORE deploying the new code.
"""
from sqlalchemy import create_engine, text
import sys
import os

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import settings

def migrate_database():
    """Add encrypted_api_key column to users table"""
    engine = create_engine(settings.database_url)
    
    print("=" * 60)
    print("DATABASE MIGRATION: Add User API Key Support")
    print("=" * 60)
    print()
    
    try:
        with engine.connect() as conn:
            # Check if column already exists
            result = conn.execute(text("""
                SELECT COUNT(*) 
                FROM pragma_table_info('users') 
                WHERE name='encrypted_api_key'
            """))
            exists = result.scalar() > 0
            
            if exists:
                print("✅ Column 'encrypted_api_key' already exists in users table")
                print("   No migration needed!")
                return True
            
            # Add the column
            print("📝 Adding 'encrypted_api_key' column to users table...")
            conn.execute(text("""
                ALTER TABLE users 
                ADD COLUMN encrypted_api_key TEXT NULL
            """))
            conn.commit()
            
            print("✅ Migration successful!")
            print()
            print("Next steps:")
            print("1. Install cryptography package: pip install cryptography")
            print("2. Deploy updated backend code")
            print("3. Existing users will need to add their API key in settings")
            print()
            
            return True
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        return False


if __name__ == "__main__":
    success = migrate_database()
    sys.exit(0 if success else 1)