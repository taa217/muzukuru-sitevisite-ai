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
        "   - Query the `venue_venue` table for that venue to identify which fields are null or empty (such as address_one, capacity, power, wifi, or internet details).\n"
        "   - Do NOT list or ask for all missing details at once, as this is overwhelming for the user. Instead, ask for ONLY ONE missing detail at a time to start a friendly, back-and-forth conversational flow.\n"
        "   - Send a friendly WhatsApp message with ONLY the first missing detail request to the contact number '+263781646052' (always format with the + sign) using `send_whatsapp_message_tool`.\n"
        "8. In subsequent turns of a WhatsApp conversation (where the last message in history is a User message response):\n"
        "   - Identify which venue is being discussed from the conversation history.\n"
        "   - Parse the user's response to extract the value for the field you previously asked about.\n"
        "   - Execute an SQL UPDATE query to save this value in the `venue_venue` table.\n"
        "   - Whenever you update any of the venue fields, you MUST also recalculate and update the `completeness_score` in the database for that venue. Calculate it using this SQL formula:\n"
        "     `completeness_score = 20 + (CASE WHEN name IS NOT NULL AND name != '' THEN 15 ELSE 0 END) + (CASE WHEN venue_type IS NOT NULL AND venue_type != '' THEN 10 ELSE 0 END) + (CASE WHEN capacity IS NOT NULL AND capacity != '' THEN 5 ELSE 0 END) + (CASE WHEN address_one IS NOT NULL AND address_one != '' THEN 10 ELSE 0 END) + (CASE WHEN suburb IS NOT NULL AND suburb != '' THEN 5 ELSE 0 END) + (CASE WHEN city IS NOT NULL AND city != '' THEN 5 ELSE 0 END) + (CASE WHEN has_power = TRUE THEN 10 ELSE 0 END) + (CASE WHEN power_backup IS NOT NULL AND power_backup != '' THEN 5 ELSE 0 END) + (CASE WHEN internet_service_provider IS NOT NULL AND internet_service_provider != '' THEN 10 ELSE 0 END) + (CASE WHEN has_pa_system = TRUE THEN 5 ELSE 0 END)`\n"
        "   - Query the database again to see what remaining fields are still null/empty.\n"
        "   - If there are other missing fields, politely ask the user for the NEXT single piece of missing information (e.g. 'Got it! Does the venue have backup power?').\n"
        "   - If all important details are complete, thank them warmly and tell them the venue profile is fully complete!\n"
        "   - IMPORTANT: Since you are replying to a user message inside a chat session, the system will automatically send your final text output as a WhatsApp message to the user. Do NOT call `send_whatsapp_message_tool` when responding to a webhook request (where the last message in history is from the user), to prevent duplicate messages. Just write your conversational reply as the final response."
    )
    
    # Compile the ReAct agent
    return create_react_agent(model, tools=tools, prompt=system_prompt)
