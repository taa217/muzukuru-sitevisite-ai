import warnings
# Suppress the duckduckgo_search renaming warnings to keep logs clean
warnings.filterwarnings("ignore", category=RuntimeWarning)
warnings.filterwarnings("ignore", message=".*duckduckgo_search.*")
warnings.filterwarnings("ignore", message=".*ddgs.*")
warnings.filterwarnings("ignore", message=".*renamed to.*")

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

@tool
def send_whatsapp_message_tool(phone_number: str, message_body: str) -> str:
    """
    Sends a WhatsApp message to a specific phone number.
    Use this tool when you need to contact a venue coordinator, manager, or owner to ask for missing information, schedule site visits, or send notifications.
    The phone_number must include country code (e.g. '+263770000000').
    """
    try:
        from app.services.whatsapp import send_whatsapp_message
        from app.agent.db import save_whatsapp_message
        res = send_whatsapp_message(phone_number, message_body)
        try:
            save_whatsapp_message(phone_number, "assistant", message_body)
        except Exception as db_err:
            import logging
            logging.getLogger(__name__).warning(f"Failed to save sent WhatsApp message to DB: {db_err}")
        return f"Successfully sent WhatsApp message to {phone_number}. Response: {res}"
    except Exception as e:
        return f"Failed to send WhatsApp message to {phone_number}: {str(e)}"

@tool
def search_internet_tool(query: str, max_results: int = 5) -> str:
    """
    Search the internet for a given query and return a list of matching results with titles, URLs, and snippets.
    Use this tool when you need to find information that is not available in the database (such as contact info, location details, rates, or general facts about a venue/location).
    """
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=max_results)
            if not results:
                return f"No results found on the internet for query: '{query}'."
            
            output = f"Internet search results for '{query}':\n\n"
            for i, r in enumerate(results, 1):
                output += f"{i}. Title: {r.get('title')}\n"
                output += f"   URL: {r.get('href')}\n"
                output += f"   Snippet: {r.get('body')}\n\n"
            return output
    except Exception as e:
        # Fallback to the old package if ddgs import/call fails
        try:
            import warnings
            warnings.filterwarnings("ignore", category=RuntimeWarning)
            from duckduckgo_search import DDGS as OldDDGS
            with OldDDGS() as ddgs:
                results = ddgs.text(query, max_results=max_results)
                if not results:
                    return f"No results found on the internet for query: '{query}'."
                output = f"Internet search results for '{query}':\n\n"
                for i, r in enumerate(results, 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   URL: {r.get('href')}\n"
                    output += f"   Snippet: {r.get('body')}\n\n"
                return output
        except Exception as e2:
            return f"Error searching the internet: {str(e)} (Fallback error: {str(e2)})"

@tool
def scrape_website_tool(url: str) -> str:
    """
    Scrapes the text content of a given website URL.
    Use this tool when you have a specific URL (e.g. from search results) and need to read its detailed content or rules.
    """
    try:
        import requests
        from bs4 import BeautifulSoup
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        # Add basic protocol if missing
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, "html.parser")
        
        # Remove navigation, footer, scripts, styles, etc. to clean content
        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
            element.decompose()
            
        # Get text and clean whitespace
        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        cleaned_text = "\n".join(chunk for chunk in chunks if chunk)
        
        # Limit result size to avoid context length overflow (approx 8000 chars)
        if len(cleaned_text) > 8000:
            return cleaned_text[:8000] + "\n\n(Note: Webpage content was truncated to 8000 characters to prevent message overflow.)"
        
        if not cleaned_text:
            return f"Webpage at {url} was successfully retrieved but no readable text could be extracted."
            
        return f"Content of webpage {url}:\n\n{cleaned_text}"
    except Exception as e:
        return f"Error scraping website {url}: {str(e)}"

# List of tools to export
tools = [
    get_current_time,
    list_tables_tool,
    get_table_schema_tool,
    run_sql_query_tool,
    send_whatsapp_message_tool,
    search_internet_tool,
    scrape_website_tool
]

