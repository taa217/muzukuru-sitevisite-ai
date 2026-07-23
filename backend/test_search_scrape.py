import asyncio
import os
import sys
from dotenv import load_dotenv

# Ensure we can import from app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

# Load environment variables
load_dotenv()

from app.agent.tools import search_internet_tool, scrape_website_tool
from app.agent.graph import get_agent_graph
from langchain_core.messages import HumanMessage

async def main():
    print("=== Testing Search and Scrape Tools ===")
    
    # 1. Test search_internet_tool
    search_query = "Harare weather"
    print(f"\n1. Testing search_internet_tool with query: '{search_query}'...")
    try:
        search_res = search_internet_tool.invoke({"query": search_query, "max_results": 2})
        print("Search Results snippet:")
        print("\n".join(search_res.split("\n")[:10]))
        print("..." if len(search_res.split("\n")) > 10 else "")
    except Exception as e:
        print(f"Error calling search_internet_tool: {e}")
        
    # 2. Test scrape_website_tool
    test_url = "https://example.com"
    print(f"\n2. Testing scrape_website_tool with URL: '{test_url}'...")
    try:
        scrape_res = scrape_website_tool.invoke({"url": test_url})
        print("Scraped Webpage Content snippet:")
        print("\n".join(scrape_res.split("\n")[:10]))
        print("..." if len(scrape_res.split("\n")) > 10 else "")
    except Exception as e:
        print(f"Error calling scrape_website_tool: {e}")

    # 3. Test Agent Graph Integration
    print("\n3. Testing Agent Graph Integration...")
    if not os.getenv("GEMINI_API_KEY"):
        print("GEMINI_API_KEY is not set in environment. Skipping agent graph invocation test.")
        return
        
    try:
        agent = get_agent_graph()
        question = "Search the web to find the capital city of France, and then read the webpage https://example.com to tell me what heading is on it."
        print(f"Invoking agent with query: '{question}'...")
        
        result = await agent.ainvoke({"messages": [HumanMessage(content=question)]})
        print("\nAgent response:")
        print(result["messages"][-1].content)
    except Exception as e:
        print(f"Error running agent graph: {e}")

if __name__ == "__main__":
    asyncio.run(main())
