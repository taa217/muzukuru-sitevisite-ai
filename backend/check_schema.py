import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cur = conn.cursor()
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
print("Tables:", cur.fetchall())
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='venue_sitevisit';")
print("venue_sitevisit cols:", cur.fetchall())
cur.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='venue_venue';")
print("venue_venue cols:", cur.fetchall())
conn.close()
