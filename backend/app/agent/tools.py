from langchain_core.tools import tool
import datetime
from app.agent.db import execute_read_query, execute_write_query

@tool
def get_current_time() -> str:
    """Get the current date and time. Use this when the user asks for the current time or date."""
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@tool
def list_tables_tool() -> str:
    """
    List all tables available in the PostgreSQL database.
    Use this tool first when you need to understand what tables are available to query.
    """
    try:
        cols, rows = execute_read_query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
        )
        if not rows:
            return "No tables found in the database."
        return "Tables in database:\n" + "\n".join([f"- {row[0]}" for row in rows])
    except Exception as e:
        return f"Error listing tables: {str(e)}"

@tool
def get_table_schema_tool(table_name: str) -> str:
    """
    Get the schema and column information for a specific database table.
    Always inspect a table's schema before running queries on it to ensure you use correct column names.
    """
    try:
        cols_query = """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
            ORDER BY ordinal_position;
        """
        cols, rows = execute_read_query(cols_query, (table_name,))
        if not rows:
            return f"Table '{table_name}' does not exist or has no columns."
        
        schema_str = f"Schema for table '{table_name}':\n"
        for row in rows:
            schema_str += f"- {row[0]} ({row[1]}, {'Nullable' if row[2] == 'YES' else 'Not Nullable'})\n"
        return schema_str
    except Exception as e:
        return f"Error getting schema for table '{table_name}': {str(e)}"

@tool
def run_sql_query_tool(query: str) -> str:
    """
    Execute a PostgreSQL query against the database.
    You can run SELECT queries to view data, and INSERT/UPDATE/DELETE queries to modify data.
    Please ensure the SQL query is valid PostgreSQL syntax and uses correct column and table names.
    If fetching many rows, use a LIMIT clause to restrict the result set size.
    """
    clean_query = query.strip()
    query_upper = clean_query.upper()
    
    # Determine if it is a read query
    is_read = False
    for prefix in ["SELECT", "WITH", "SHOW", "EXPLAIN"]:
        if query_upper.startswith(prefix):
            is_read = True
            break
            
    try:
        if is_read:
            cols, rows = execute_read_query(clean_query)
            if not rows:
                return "Query executed successfully. 0 rows returned."
            
            # Truncate results if there are too many rows to avoid context blowup
            num_rows = len(rows)
            truncated = False
            if num_rows > 100:
                rows = rows[:100]
                truncated = True
                
            # Format output
            result = " | ".join(cols) + "\n"
            result += "-" * len(result) + "\n"
            for row in rows:
                result += " | ".join([str(val) for val in row]) + "\n"
                
            if truncated:
                result += f"\n(Note: Results truncated to 100 rows. Total rows returned by query: {num_rows}. Use LIMIT to fetch fewer/more rows.)"
            return result
        else:
            status = execute_write_query(clean_query)
            return status
    except Exception as e:
        return f"Error executing query: {str(e)}"

# List of tools to export
tools = [
    get_current_time,
    list_tables_tool,
    get_table_schema_tool,
    run_sql_query_tool
]
