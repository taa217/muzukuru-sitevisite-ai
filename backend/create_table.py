import os
import psycopg2
from dotenv import load_dotenv

# Load env variables
load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("Error: DATABASE_URL not found in environment!")
    exit(1)

print(f"Connecting to database...")
try:
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    with conn.cursor() as cur:
        # Create table
        print("Creating table 'whatsapp_chat_history'...")
        create_table_query = """
        CREATE TABLE IF NOT EXISTS whatsapp_chat_history (
            id SERIAL PRIMARY KEY,
            phone_number VARCHAR(50) NOT NULL,
            role VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
        """
        cur.execute(create_table_query)
        print("Table 'whatsapp_chat_history' created successfully.")
        
        # Verify table exists
        cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
        tables = cur.fetchall()
        print("Tables currently in database:")
        for t in tables:
            print(f"- {t[0]}")
            
    conn.close()
except Exception as e:
    print(f"An error occurred: {e}")
