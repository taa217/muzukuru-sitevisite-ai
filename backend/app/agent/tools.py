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

KNOWN_EXPANSIONS = {
    "ufic": "UFIC Church",
    "ufic church": "UFIC Church",
    "hicc": "HICC Harare International Conference Centre",
    "rainbow": "Rainbow Towers Hotel",
    "rainbow towers": "Rainbow Towers Hotel",
    "meikles": "Meikles Hotel",
    "monomotapa": "Monomotapa Hotel",
    "cresta": "Cresta Lodge Hotel",
    "wild geese": "Wild Geese Lodge venue",
    "zitf": "ZITF Grounds Bulawayo",
    "rcz": "Reformed Church in Zimbabwe",
    "zaoga": "ZAOGA Forward in Faith Church",
    "afm": "AFM Apostolic Faith Mission Church",
    "phd": "PHD Ministries Church",
    "celestial": "Celestial Church",
}

LOCATION_KEYWORDS = [
    "harare", "zimbabwe", "zim", "bulawayo", "chitungwiza", "mutare", "gweru",
    "masvingo", "kwekwe", "kadoma", "chinhoyi", "victoria falls", "kariba", "ruwa", "epworth", "norton"
]

CATEGORY_KEYWORDS = [
    "church", "venue", "hotel", "hall", "centre", "center", "lodge", "resort", "garden",
    "grounds", "auditorium", "conference", "cathedral", "chapel", "stadium"
]

def enrich_search_query(query: str) -> str:
    """
    Enriches a raw or generic search query by adding geographic (Harare, Zimbabwe) and category context
    (e.g., expanding 'ufic' to 'UFIC Church Harare Zimbabwe').
    """
    if not query or not query.strip():
        return query

    raw_query = query.strip()
    query_lower = raw_query.lower()
    
    # 1. Expand known abbreviations if applicable
    for abbr, expanded in KNOWN_EXPANSIONS.items():
        if query_lower == abbr or query_lower.startswith(f"{abbr} "):
            remainder = raw_query[len(abbr):].strip()
            # Prevent word duplication if remainder starts with last word of expanded (e.g. 'church')
            exp_words = expanded.split()
            if exp_words and remainder:
                last_word = exp_words[-1].lower()
                rem_words = remainder.split()
                if rem_words and rem_words[0].lower() == last_word:
                    remainder = " ".join(rem_words[1:])
            raw_query = f"{expanded} {remainder}".strip()
            query_lower = raw_query.lower()
            break

    # 2. Check for category context
    has_category = any(cat in query_lower for cat in CATEGORY_KEYWORDS)
    
    # 3. Check for geographic location context
    has_location = any(loc in query_lower for loc in LOCATION_KEYWORDS)

    # 4. Construct enriched query parts
    additions = []
    if not has_category:
        additions.append("church venue")
    if not has_location:
        additions.append("Harare Zimbabwe")

    if additions:
        enriched = f"{raw_query} {' '.join(additions)}".strip()
    else:
        enriched = raw_query

    return enriched

@tool
def search_internet_tool(query: str, max_results: int = 5) -> str:
    """
    Search the internet for a given text query using Gemini Google Search Grounding and return accurate matching results, web snippets, and verified source links.
    CRITICAL: ALWAYS build context-rich, specific queries. NEVER pass a single generic keyword (e.g. NEVER search 'ufic' or 'rainbow').
    Include entity full name, entity category (e.g. 'church', 'hotel', 'wedding venue'), location ('Harare Zimbabwe'), and target attributes (e.g. 'address contact details photos generator PA system wifi').
    Example: 'UFIC Church Harare Zimbabwe address location contact details photos'.
    """
    enriched_query = enrich_search_query(query)
    log_detail = f"Query: '{query}'" + (f" (Enriched to: '{enriched_query}')" if enriched_query != query else "")
    agent_tracker.log_activity("search", f"Searching Web (Google): '{enriched_query}'", log_detail, status="running", extra={"query": query, "enriched_query": enriched_query})
    
    # Primary: Use Gemini's Native Google Search Grounding via google-genai
    try:
        import os
        from google import genai
        from google.genai import types
        
        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            client = genai.Client(api_key=api_key)
            prompt = (
                f"Perform a Google Search for: {enriched_query}\n"
                f"Provide a clear, detailed summary of key findings including physical address, phone numbers, email, website, and key features. "
                f"Include official source web URLs."
            )
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
            )
            
            if response.text:
                output = f"Google Search results for '{enriched_query}':\n\n{response.text.strip()}\n\n"
                if response.candidates and response.candidates[0].grounding_metadata:
                    meta = response.candidates[0].grounding_metadata
                    if meta.grounding_chunks:
                        output += "Sources & Verified Links:\n"
                        for chunk in meta.grounding_chunks:
                            if chunk.web:
                                output += f"- [{chunk.web.title}]({chunk.web.uri})\n"
                agent_tracker.log_activity("search", f"Google Search Completed: '{enriched_query}'", output[:300] + "...", status="success", extra={"query": enriched_query})
                return output
    except Exception as gemini_err:
        import logging
        logging.getLogger(__name__).warning(f"Gemini Google Search failed, attempting DDG fallback: {gemini_err}")

    # Secondary Fallback: DuckDuckGo Search
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = ddgs.text(enriched_query, max_results=max_results)
            if not results and enriched_query != query:
                results = ddgs.text(query, max_results=max_results)
                active_q = query
            else:
                active_q = enriched_query
                
            if not results:
                res = f"No results found on the internet for query: '{query}' (searched as '{enriched_query}')."
            else:
                output = f"Internet search results for '{active_q}':\n\n"
                for i, r in enumerate(results, 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   URL: {r.get('href')}\n"
                    output += f"   Snippet: {r.get('body')}\n\n"
                res = output
            agent_tracker.log_activity("search", f"Web Search Completed: '{active_q}'", f"Found results for '{active_q}'", status="success", extra={"query": active_q})
            return res
    except Exception as e:
        try:
            import warnings
            warnings.filterwarnings("ignore", category=RuntimeWarning)
            from duckduckgo_search import DDGS as OldDDGS
            with OldDDGS() as ddgs:
                results = ddgs.text(enriched_query, max_results=max_results)
                if not results and enriched_query != query:
                    results = ddgs.text(query, max_results=max_results)
                    active_q = query
                else:
                    active_q = enriched_query
                    
                if not results:
                    res = f"No results found on the internet for query: '{query}' (searched as '{enriched_query}')."
                else:
                    output = f"Internet search results for '{active_q}':\n\n"
                    for i, r in enumerate(results, 1):
                        output += f"{i}. Title: {r.get('title')}\n"
                        output += f"   URL: {r.get('href')}\n"
                        output += f"   Snippet: {r.get('body')}\n\n"
                    res = output
                agent_tracker.log_activity("search", f"Web Search Completed: '{active_q}'", f"Found results for '{active_q}'", status="success", extra={"query": active_q})
                return res
        except Exception as e2:
            err_msg = f"Error searching the internet: {str(e)} (Fallback error: {str(e2)})"
            agent_tracker.log_activity("search", f"Web Search Failed: '{enriched_query}'", err_msg, status="error", extra={"query": query, "enriched_query": enriched_query})
            return err_msg

@tool
def search_images_tool(query: str, max_results: int = 5) -> str:
    """
    Search the internet for high-resolution images/photos matching a query using Gemini Google Search Grounding and page media scraping.
    CRITICAL: ALWAYS build context-rich, specific queries (e.g. 'UFIC Church Harare Zimbabwe photo', 'Rainbow Towers Hotel Harare entrance stage photo').
    NEVER use brief or generic 1-word queries. Include entity category, city, and target area (entrance, stage, layout, exterior).
    Returns a list of image results including direct Image URLs, titles, webpage source URLs, and thumbnail URLs.
    """
    enriched_query = enrich_search_query(query)
    log_detail = f"Query: '{query}'" + (f" (Enriched to: '{enriched_query}')" if enriched_query != query else "")
    agent_tracker.log_activity("image_search", f"Searching Venue Images (Gemini + Grounding): '{enriched_query}'", log_detail, status="running", extra={"query": query, "enriched_query": enriched_query})
    
    found_images = []
    
    # Primary: Gemini Google Search Grounding + OpenGraph Page Scraping
    try:
        import os
        import requests
        from bs4 import BeautifulSoup
        from urllib.parse import urljoin
        from google import genai
        from google.genai import types

        api_key = os.getenv("GEMINI_API_KEY")
        if api_key:
            client = genai.Client(api_key=api_key)
            prompt = f"Search Google for official websites, photo galleries, press coverage, or articles featuring photos of: {enriched_query}."
            
            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    tools=[types.Tool(google_search=types.GoogleSearch())]
                )
            )
            
            grounded_links = []
            if response.candidates and response.candidates[0].grounding_metadata:
                for chunk in response.candidates[0].grounding_metadata.grounding_chunks:
                    if chunk.web and chunk.web.uri:
                        grounded_links.append((chunk.web.title or "Venue Page", chunk.web.uri))

            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }

            for page_title, link in grounded_links[:8]:
                if len(found_images) >= max_results:
                    break
                try:
                    r = requests.get(link, headers=headers, timeout=6, allow_redirects=True)
                    if r.status_code == 200:
                        soup = BeautifulSoup(r.text, "html.parser")
                        # Check og:image & twitter:image meta tags (HD hero photos)
                        og_img = (
                            soup.find("meta", property="og:image") or
                            soup.find("meta", attrs={"name": "og:image"}) or
                            soup.find("meta", property="twitter:image") or
                            soup.find("meta", attrs={"name": "twitter:image"})
                        )
                        if og_img and og_img.get("content"):
                            img_url = og_img["content"].strip()
                            if img_url.startswith("//"):
                                img_url = "https:" + img_url
                            elif not img_url.startswith("http"):
                                img_url = urljoin(link, img_url)
                            
                            # Filter out tiny icons or tracking pixels
                            if not any(bad in img_url.lower() for bad in ["logo", "icon", "avatar", "1x1", "pixel", "favicon"]):
                                title = soup.title.string.strip() if soup.title and soup.title.string else page_title
                                if not any(img["image"] == img_url for img in found_images):
                                    found_images.append({
                                        "title": title,
                                        "image": img_url,
                                        "url": link,
                                        "thumbnail": img_url
                                    })
                except Exception:
                    continue

            if found_images:
                output = f"High-Resolution Image search results for '{enriched_query}':\n\n"
                for i, r in enumerate(found_images[:max_results], 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   Direct Image URL: {r.get('image')}\n"
                    output += f"   Source Webpage: {r.get('url')}\n"
                    output += f"   Thumbnail: {r.get('thumbnail')}\n\n"
                agent_tracker.log_activity("image_search", f"Found {len(found_images)} HD Images for '{enriched_query}'", output[:300], status="success", extra={"query": enriched_query})
                return output
    except Exception as gemini_err:
        import logging
        logging.getLogger(__name__).warning(f"Gemini image grounding failed, falling back to DDG: {gemini_err}")

    # Fallback: DuckDuckGo Images
    try:
        from ddgs import DDGS
        with DDGS() as ddgs:
            results = list(ddgs.images(enriched_query, max_results=max_results))
            active_q = enriched_query
            if not results and enriched_query != query:
                results = list(ddgs.images(query, max_results=max_results))
                active_q = query

            if not results:
                res = f"No image results found for query: '{query}' (searched as '{enriched_query}')."
            else:
                output = f"Image search results for '{active_q}':\n\n"
                for i, r in enumerate(results, 1):
                    output += f"{i}. Title: {r.get('title')}\n"
                    output += f"   Direct Image URL: {r.get('image')}\n"
                    output += f"   Source Webpage: {r.get('url')}\n"
                    output += f"   Thumbnail: {r.get('thumbnail')}\n\n"
                res = output
            agent_tracker.log_activity("image_search", f"Found {len(results) if isinstance(results, list) else 0} Images for '{active_q}'", res[:300], status="success", extra={"query": active_q})
            return res
    except Exception as e:
        try:
            import warnings
            warnings.filterwarnings("ignore", category=RuntimeWarning)
            from duckduckgo_search import DDGS as OldDDGS
            with OldDDGS() as ddgs:
                results = list(ddgs.images(enriched_query, max_results=max_results))
                active_q = enriched_query
                if not results and enriched_query != query:
                    results = list(ddgs.images(query, max_results=max_results))
                    active_q = query

                if not results:
                    res = f"No image results found for query: '{query}' (searched as '{enriched_query}')."
                else:
                    output = f"Image search results for '{active_q}':\n\n"
                    for i, r in enumerate(results, 1):
                        output += f"{i}. Title: {r.get('title')}\n"
                        output += f"   Direct Image URL: {r.get('image')}\n"
                        output += f"   Source Webpage: {r.get('url')}\n"
                        output += f"   Thumbnail: {r.get('thumbnail')}\n\n"
                    res = output
                agent_tracker.log_activity("image_search", f"Found Images for '{active_q}'", res[:300], status="success", extra={"query": active_q})
                return res
        except Exception as e2:
            err_msg = f"Error searching for images: {str(e)} (Fallback error: {str(e2)})"
            agent_tracker.log_activity("image_search", f"Image Search Failed: '{enriched_query}'", err_msg, status="error", extra={"query": query, "enriched_query": enriched_query})
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
