import os
import psycopg2
from psycopg2.extras import DictCursor
from typing import List, Dict, Tuple, Any

def get_db_connection():
    """
    Establishes and returns a connection to the PostgreSQL database
    using configuration from environment variables.
    """
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=os.getenv("DB_PORT", "5432"),
        database=os.getenv("DB_NAME", "muzukurudb"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD")
    )

def execute_read_query(query: str, params: Tuple = None) -> Tuple[List[str], List[Tuple]]:
    """
    Executes a SELECT query and returns the column headers and matching rows.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            columns = [desc[0] for desc in cur.description] if cur.description else []
            rows = cur.fetchall()
            return columns, rows
    finally:
        conn.close()

def execute_write_query(query: str, params: Tuple = None) -> str:
    """
    Executes an INSERT, UPDATE, or DELETE query and commits the transaction.
    Returns a status message.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rowcount = cur.rowcount
            conn.commit()
            return f"Query executed successfully. Affected rows: {rowcount}"
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()
