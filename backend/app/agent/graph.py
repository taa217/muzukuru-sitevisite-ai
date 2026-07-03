import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from langgraph.prebuilt import create_react_agent
from app.agent.tools import tools

# Load environment variables from .env file
load_dotenv()

def get_agent_graph():
    """
    Initializes the Gemini model and returns the compiled LangGraph agent.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # We don't want to crash import, but we should complain if someone tries to instantiate the agent
        raise ValueError(
            "GEMINI_API_KEY is not set. Please copy .env.example to .env and add your Google Gemini API Key."
        )
    
    # Initialize the Gemini model
    model = ChatGoogleGenerativeAI(
        model="gemini-3.1-flash-lite",
        temperature=0,
        google_api_key=api_key
    )
    
    system_prompt = (
        "You are Muzukuru AI assistant that helps users query and manage their PostgreSQL database.\n"
        "You have access to tools that allow you to list tables, inspect table schemas, run SQL queries, and send WhatsApp messages.\n\n"
        "Here are the rules you MUST follow:\n"
        "1. You must specifically focus on database tables that start with the prefix 'venue_' (e.g., 'venue_sitevisit', 'venue_venue', 'venue_venue_contacts', 'venue_venuelayout', etc.). Use these tables to answer user queries, insert new records, or update existing ones.\n"
        "2. If you don't know what tables starting with 'venue_' exist, first search or list them using `list_tables_tool`.\n"
        "3. Before querying or writing to any table, always inspect its schema using `get_table_schema_tool` to understand the available columns and their data types (e.g., check 'venue_sitevisit' and 'venue_venue' columns first).\n"
        "4. Construct valid PostgreSQL syntax queries. Use the `run_sql_query_tool` to execute them.\n"
        "5. Be helpful, summarize table structures and query results clearly, and avoid assuming table or column names exist without checking.\n"
        "6. You have the ability to send WhatsApp messages using the `send_whatsapp_message_tool`.\n"
        "7. If you are asked to check a venue (or newly added venue) for missing information and contact the owner/coordinator, you must:\n"
        "   - Query the `venue_venue` table for that venue to identify which fields are null or empty (such as address, capacity, power, wifi, or internet details).\n"
        "   - Send a WhatsApp message to the contact number '+263780642578' (always format with the + sign) using `send_whatsapp_message_tool`.\n"
        "   - The message should be friendly, polite, and list the specific missing fields, asking the contact to provide those details so the database can be completed."
    )
    
    # Compile the ReAct agent
    return create_react_agent(model, tools=tools, prompt=system_prompt)
