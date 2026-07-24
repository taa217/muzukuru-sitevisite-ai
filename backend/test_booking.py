import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("No DATABASE_URL set.")
    exit(1)

conn = psycopg2.connect(db_url)
cur = conn.cursor()

# Get a venue ID from DB
cur.execute("SELECT id, name FROM venue_venue LIMIT 1;")
row = cur.fetchone()
if not row:
    print("No venues found in venue_venue table!")
else:
    venue_id, venue_name = row
    print(f"Found venue: ID={venue_id}, Name={venue_name}")
    
    # Test inserting a site visit booking
    cur.execute("""
        INSERT INTO venue_sitevisit (venue_id, status, notes, created_at, updated_at)
        VALUES (%s, 'scheduled', 'Test booking via script', NOW(), NOW())
        RETURNING id;
    """, (venue_id,))
    site_visit_id = cur.fetchone()[0]
    conn.commit()
    print(f"Successfully created test site visit booking with ID: {site_visit_id}")

conn.close()
