import warnings
# Suppress the duckduckgo_search renaming warnings to keep logs clean
warnings.filterwarnings("ignore", category=RuntimeWarning)
warnings.filterwarnings("ignore", message=".*duckduckgo_search.*")
warnings.filterwarnings("ignore", message=".*ddgs.*")
warnings.filterwarnings("ignore", message=".*renamed to.*")

from langchain_core.tools import tool
import datetime
from app.agent.db import execute_read_query, execute_write_query
from app.services.agent_tracker import agent_tracker

@tool
def get_current_time() -> str:
    """Get the current date and time. Use this when the user asks for the current time or date."""
    agent_tracker.log_activity("system", "Checking System Time", status="info")
    return datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

@tool
def list_tables_tool() -> str:
    """
    List all tables available in the PostgreSQL database.
    Use this tool first when you need to understand what tables are available to query.
    """
    agent_tracker.log_activity("sql", "Listing Database Tables", "Querying information_schema.tables", status="running")
    try:
        cols, rows = execute_read_query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name;"
        )
        if not rows:
            res = "No tables found in the database."
        else:
            res = "Tables in database:\n" + "\n".join([f"- {row[0]}" for row in rows])
        agent_tracker.log_activity("sql", "Database Tables Listed", res, status="success")
        return res
    except Exception as e:
        err_msg = f"Error listing tables: {str(e)}"
        agent_tracker.log_activity("sql", "Failed to List Tables", err_msg, status="error")
        return err_msg

@tool
def get_table_schema_tool(table_name: str) -> str:
    """
    Get the schema and column information for a specific database table.
    Always inspect a table's schema before running queries on it to ensure you use correct column names.
    """
    agent_tracker.log_activity("sql", f"Inspecting Table Schema: '{table_name}'", f"Table: {table_name}", status="running")
    try:
        cols_query = """
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = %s AND table_schema = 'public'
            ORDER BY ordinal_position;
        """
        cols, rows = execute_read_query(cols_query, (table_name,))
        if not rows:
            res = f"Table '{table_name}' does not exist or has no columns."
        else:
            schema_str = f"Schema for table '{table_name}':\n"
            for row in rows:
                schema_str += f"- {row[0]} ({row[1]}, {'Nullable' if row[2] == 'YES' else 'Not Nullable'})\n"
            res = schema_str
        agent_tracker.log_activity("sql", f"Retrieved Schema for '{table_name}'", res, status="success")
        return res
    except Exception as e:
        err_msg = f"Error getting schema for table '{table_name}': {str(e)}"
        agent_tracker.log_activity("sql", f"Failed to Inspect Schema: '{table_name}'", err_msg, status="error")
        return err_msg

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
    
    agent_tracker.log_activity(
        "sql",
        "Executing SQL Query",
        clean_query,
        status="running",
        extra={"query": clean_query}
    )
    
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
                res = "Query executed successfully. 0 rows returned."
            else:
                num_rows = len(rows)
                truncated = False
                if num_rows > 100:
                    rows = rows[:100]
                    truncated = True
                    
                res = " | ".join(cols) + "\n"
                res += "-" * len(res) + "\n"
                for row in rows:
                    res += " | ".join([str(val) for val in row]) + "\n"
                    
                if truncated:
                    res += f"\n(Note: Results truncated to 100 rows. Total rows: {num_rows}.)"
        else:
            res = execute_write_query(clean_query)
            
        agent_tracker.log_activity(
            "sql",
            "SQL Query Executed Successfully",
            res[:300] + ("..." if len(res) > 300 else ""),
            status="success",
            extra={"query": clean_query, "result_snippet": res[:300]}
        )
        return res
    except Exception as e:
        err_msg = f"Error executing query: {str(e)}"
        agent_tracker.log_activity("sql", "SQL Query Failed", err_msg, status="error", extra={"query": clean_query})
        return err_msg

@tool
def send_whatsapp_message_tool(phone_number: str, message_body: str = "", media_url: str | None = None) -> str:
    """
    Sends a WhatsApp message to a specific phone number, with optional text content and/or an image URL.
    Use this tool when you need to contact a venue coordinator, manager, or owner to ask for missing information, schedule site visits, or send notifications.
    CRITICAL: ALWAYS pass direct photo/image URLs in the `media_url` parameter so WhatsApp displays them as real images instead of raw text links.
    The phone_number must include country code (e.g. '+263770000000').
    """
    from app.services.whatsapp import extract_image_urls_from_text, send_whatsapp_message
    from app.agent.db import save_whatsapp_message
    import logging

    found_urls, cleaned_body = extract_image_urls_from_text(message_body)
    effective_media_url = media_url
    if not effective_media_url and found_urls:
        effective_media_url = found_urls[0]

    agent_tracker.log_activity(
        "whatsapp",
        f"Sending WhatsApp Message to {phone_number}",
        f"Recipient: {phone_number}\nMessage: {cleaned_body if effective_media_url else message_body}" + (f"\nMedia URL: {effective_media_url}" if effective_media_url else ""),
        status="running",
        extra={"phone": phone_number, "message": cleaned_body if effective_media_url else message_body, "media_url": effective_media_url}
    )
    
    try:
        res = send_whatsapp_message(phone_number, message_body=message_body, media_url=media_url)
        try:
            saved_content = f"[Media: {effective_media_url}] {cleaned_body}".strip() if effective_media_url else message_body
            save_whatsapp_message(phone_number, "assistant", saved_content)
        except Exception as db_err:
            logging.getLogger(__name__).warning(f"Failed to save sent WhatsApp message to DB: {db_err}")
            
        success_msg = f"Successfully sent WhatsApp message to {phone_number}. Response: {res}"
        agent_tracker.log_activity(
            "whatsapp",
            f"WhatsApp Message Delivered to {phone_number}",
            f"Message: {(cleaned_body if effective_media_url else message_body)[:200]}" + ("..." if len(message_body) > 200 else ""),
            status="success",
            extra={"phone": phone_number, "message": cleaned_body if effective_media_url else message_body, "media_url": effective_media_url}
        )
        return success_msg
    except Exception as e:
        err_msg = f"Failed to send WhatsApp message to {phone_number}: {str(e)}"
        agent_tracker.log_activity("whatsapp", f"Failed to Send WhatsApp Message to {phone_number}", err_msg, status="error")
        return err_msg

@tool
def search_internet_tool(query: str, max_results: int = 5) -> str:
    """
    Search the internet for a given text query and return a list of matching results with titles, URLs, and snippets.
    Use this tool when you need to find information that is not available in the database (such as contact info, location details, rates, or general facts about a venue/location).
    """
    agent_tracker.log_activity("search", f"Searching Web: '{query}'", f"Query: {query}", status="running", extra={"query": query})
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=max_results)
            if not results:
                res = f"No results found on the internet for query: '{query}'."
            else:
                output = f"Internet search results for '{query}':\n\n"
                for i, r in enumerate(results, 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   URL: {r.get('href')}\n"
                    output += f"   Snippet: {r.get('body')}\n\n"
                res = output
            agent_tracker.log_activity("search", f"Web Search Completed: '{query}'", f"Found results for '{query}'", status="success", extra={"query": query})
            return res
    except Exception as e:
        try:
            import warnings
            warnings.filterwarnings("ignore", category=RuntimeWarning)
            from duckduckgo_search import DDGS as OldDDGS
            with OldDDGS() as ddgs:
                results = ddgs.text(query, max_results=max_results)
                if not results:
                    res = f"No results found on the internet for query: '{query}'."
                else:
                    output = f"Internet search results for '{query}':\n\n"
                    for i, r in enumerate(results, 1):
                        output += f"{i}. Title: {r.get('title')}\n"
                        output += f"   URL: {r.get('href')}\n"
                        output += f"   Snippet: {r.get('body')}\n\n"
                    res = output
                agent_tracker.log_activity("search", f"Web Search Completed: '{query}'", f"Found results for '{query}'", status="success", extra={"query": query})
                return res
        except Exception as e2:
            err_msg = f"Error searching the internet: {str(e)} (Fallback error: {str(e2)})"
            agent_tracker.log_activity("search", f"Web Search Failed: '{query}'", err_msg, status="error", extra={"query": query})
            return err_msg

@tool
def search_images_tool(query: str, max_results: int = 5) -> str:
    """
    Search the internet for images/photos matching a query (e.g. '[Venue Name] Harare photo', '[Venue Name] entrance stage').
    Returns a list of image results including direct Image URLs, titles, webpage source URLs, and thumbnail URLs.
    Use this tool when researching a venue so you can find photos of the venue and share direct Image URLs with the crew via send_whatsapp_message_tool.
    """
    agent_tracker.log_activity("image_search", f"Searching Venue Images: '{query}'", f"Query: {query}", status="running", extra={"query": query})
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.images(query, max_results=max_results))
            if not results:
                res = f"No image results found for query: '{query}'."
            else:
                output = f"Image search results for '{query}':\n\n"
                for i, r in enumerate(results, 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   Direct Image URL: {r.get('image')}\n"
                    output += f"   Source Webpage: {r.get('url')}\n"
                    output += f"   Thumbnail: {r.get('thumbnail')}\n\n"
                res = output
            agent_tracker.log_activity("image_search", f"Found {len(results) if isinstance(results, list) else 0} Images for '{query}'", res[:300], status="success", extra={"query": query})
            return res
    except Exception as e:
        try:
            import warnings
            warnings.filterwarnings("ignore", category=RuntimeWarning)
            from duckduckgo_search import DDGS as OldDDGS
            with OldDDGS() as ddgs:
                results = list(ddgs.images(query, max_results=max_results))
                if not results:
                    res = f"No image results found for query: '{query}'."
                else:
                    output = f"Image search results for '{query}':\n\n"
                    for i, r in enumerate(results, 1):
                        output += f"{i}. Title: {r.get('title')}\n"
                        output += f"   Direct Image URL: {r.get('image')}\n"
                        output += f"   Source Webpage: {r.get('url')}\n"
                        output += f"   Thumbnail: {r.get('thumbnail')}\n\n"
                    res = output
                agent_tracker.log_activity("image_search", f"Found Images for '{query}'", res[:300], status="success", extra={"query": query})
                return res
        except Exception as e2:
            err_msg = f"Error searching for images: {str(e)} (Fallback error: {str(e2)})"
            agent_tracker.log_activity("image_search", f"Image Search Failed: '{query}'", err_msg, status="error", extra={"query": query})
            return err_msg

@tool
def scrape_website_tool(url: str) -> str:
    """
    Scrapes the text content of a given website URL.
    Use this tool when you have a specific URL (e.g. from search results) and need to read its detailed content or rules.
    """
    agent_tracker.log_activity("web_scrape", f"Scraping Webpage: {url}", f"URL: {url}", status="running", extra={"url": url})
    try:
        import requests
        from bs4 import BeautifulSoup
        
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "https://" + url
            
        res = requests.get(url, headers=headers, timeout=15)
        res.raise_for_status()
        
        soup = BeautifulSoup(res.text, "html.parser")
        for element in soup(["script", "style", "nav", "footer", "header", "iframe", "noscript"]):
            element.decompose()
            
        text = soup.get_text(separator="\n")
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        cleaned_text = "\n".join(chunk for chunk in chunks if chunk)
        
        if len(cleaned_text) > 8000:
            res_str = cleaned_text[:8000] + "\n\n(Note: Webpage content was truncated to 8000 characters.)"
        elif not cleaned_text:
            res_str = f"Webpage at {url} was successfully retrieved but no readable text could be extracted."
        else:
            res_str = f"Content of webpage {url}:\n\n{cleaned_text}"

        agent_tracker.log_activity("web_scrape", f"Successfully Scraped Webpage: {url}", res_str[:300] + "...", status="success", extra={"url": url})
        return res_str
    except Exception as e:
        err_msg = f"Error scraping website {url}: {str(e)}"
        agent_tracker.log_activity("web_scrape", f"Failed to Scrape Webpage: {url}", err_msg, status="error", extra={"url": url})
        return err_msg

# List of tools to export
tools = [
    get_current_time,
    list_tables_tool,
    get_table_schema_tool,
    run_sql_query_tool,
    send_whatsapp_message_tool,
    search_internet_tool,
    search_images_tool,
    scrape_website_tool
]
