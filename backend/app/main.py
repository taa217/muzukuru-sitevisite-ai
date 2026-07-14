import os
import uvicorn
import asyncio
import logging
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

logger = logging.getLogger(__name__)

CONTACTS = {
    "+263781646052": {"name": "Clyde", "role": "CEO", "is_crew": True},
    "+263780812222": {"name": "Byron", "role": "Crew member", "is_crew": True},
    "+2630642578": {"name": "Cris", "role": "Technical staff", "is_crew": True},
    "+263788918512": {"name": "Nigel", "role": "Client / Venue coordinator", "is_crew": False},
    "+263774043440": {"name": "Cama", "role": "Company manager", "is_crew": True},
    "+2638344511": {"name": "Nashel", "role": "Crew member", "is_crew": True},
}

def get_contact_info(phone_number: str) -> Dict[str, Any]:
    # Clean digits to match robustly
    digits = "".join([c for c in phone_number if c.isdigit()])
    if digits.startswith("263") and len(digits) > 3:
        local_part = digits[3:]
    else:
        local_part = digits
        
    for num, info in CONTACTS.items():
        num_digits = "".join([c for c in num if c.isdigit()])
        if num_digits.startswith("263") and len(num_digits) > 3:
            num_local = num_digits[3:]
        else:
            num_local = num_digits
            
        if local_part == num_local:
            return info
            
    return {"name": "Unknown", "role": "Client / Venue coordinator", "is_crew": False}

# Import agent graph builder
try:
    from app.agent.graph import get_agent_graph
except Exception as e:
    get_agent_graph = None
    logger.warning(f"Failed to import get_agent_graph: {e}")

app = FastAPI(
    title="SiteVisit AI Backend",
    description="FastAPI Backend for SiteVisit AI powered by LangGraph and Google Gemini API",
    version="1.0.0"
)

# CORS middleware to allow connection from frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatMessage(BaseModel):
    role: str = Field(description="The role of the message sender, e.g. 'user' or 'assistant'")
    content: str = Field(description="The content of the message")

class ChatRequest(BaseModel):
    messages: List[ChatMessage] = Field(description="The list of messages in the chat history")

class ChatResponse(BaseModel):
    response: str
    messages: List[Dict[str, Any]]

from app.agent.db import execute_read_query, get_db_connection, save_whatsapp_message, get_whatsapp_chat_history
from app.services.whatsapp import send_whatsapp_message
from fastapi import Request

@app.get("/")
def read_root():
    return {"message": "Welcome to SiteVisit AI Backend API", "status": "running"}

@app.get("/api/venue/site-visits")
def get_site_visits():
    try:
        # We query the site visits and join the venue name and address fields
        query = """
            SELECT sv.id, sv.status, sv.scheduled_date_time, sv.notes, 
                   v.name as venue_name, v.address_one as venue_address
            FROM venue_sitevisit sv
            JOIN venue_venue v ON sv.venue_id = v.id
            ORDER BY sv.scheduled_date_time DESC NULLS LAST, sv.created_at DESC;
        """
        cols, rows = execute_read_query(query)
        
        visits = []
        for row in rows:
            visits.append({
                "id": str(row[0]),
                "status": row[1],
                "scheduled_date_time": row[2].isoformat() if row[2] else None,
                "notes": row[3],
                "venue_name": row[4],
                "venue_address": row[5]
            })
        return visits
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/venues")
def get_venues():
    try:
        query = """
            SELECT id, name, address_one, address_two, suburb, city, capacity,
                   has_power, power_type, power_backup, internet_service_provider,
                   completeness_score, is_private_residence, venue_type, media_urls
            FROM venue_venue
            ORDER BY completeness_score DESC, name ASC;
        """
        cols, rows = execute_read_query(query)
        venues = []
        for row in rows:
            venues.append({
                "id": str(row[0]),
                "name": row[1],
                "address_one": row[2],
                "address_two": row[3],
                "suburb": row[4],
                "city": row[5],
                "capacity": row[6],
                "has_power": row[7],
                "power_type": row[8],
                "power_backup": row[9],
                "internet_service_provider": row[10],
                "completeness_score": row[11],
                "is_private_residence": row[12],
                "venue_type": row[13],
                "media_urls": row[14]
            })
        return venues
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

class VenueCreate(BaseModel):
    name: str = Field(..., min_length=1)
    address_one: str | None = None
    address_two: str | None = None
    suburb: str | None = None
    city: str | None = None
    capacity: str | None = None
    venue_type: str | None = None
    has_power: bool = False
    power_type: str | None = None
    power_backup: str | None = None
    internet_service_provider: str | None = None
    completeness_score: int = 30
    is_private_residence: bool = False
    notes: str | None = None
    wifi_name: str | None = None
    wifi_password: str | None = None
    has_pa_system: bool = False
    pa_system_provider: str | None = None
async def auto_check_venue_and_message_contact(venue_id: int):
    """
    Background task that waits 10 seconds, then queries the agent
    to inspect the newly created venue, notify the crew members about it,
    ask Cris about technical requirements, and ask the client Nigel
    about power and coordinator details.
    """
    logger.info(f"Background task triggered for venue ID: {venue_id}. Waiting 10 seconds...")
    await asyncio.sleep(10)
    
    try:
        if get_agent_graph is None:
            logger.error("Agent graph is not initialized. Background check failed.")
            return
            
        agent = get_agent_graph()
        
        # Invoke agent with system prompt instruction to inspect venue_id and perform coordination
        instruction_msg = HumanMessage(
            content=(
                f"Automated trigger: A new venue with database ID {venue_id} has been added.\n"
                "Please perform the following coordination tasks:\n"
                "1. Use `run_sql_query_tool` to inspect the `venue_venue` table for this venue to gather the necessary details (e.g. name, city, address, capacity, etc.).\n"
                "2. Inform the crew (Clyde: +263781646052, Cama: +263774043440, Byron: +263780812222, Nashel: +2638344511) about the newly added venue. Use `send_whatsapp_message_tool` and a friendly, joking, buddy-like tone.\n"
                "3. Message Cris (+2630642578) in a friendly, joking buddy tone to ask about technical requirements (cameras/gear needed, what is working and what is not).\n"
                "4. Message the client/venue coordinator Nigel (+263788918512) in a highly professional, polite tone to ask about details like capacity, power situation (available power, backup power details), wifi/internet service provider, or internet upload speed. Also ask if there's any other venue coordinator we should contact.\n"
                "Ensure you use `send_whatsapp_message_tool` for each contact."
            )
        )
        
        logger.info(f"Invoking agent graph for auto checking venue {venue_id}")
        await agent.ainvoke({"messages": [instruction_msg]})
        logger.info(f"Finished background check and message task for venue {venue_id}")
        
    except Exception as e:
        logger.error(f"Error in auto_check_venue_and_message_contact: {e}", exc_info=True)


@app.post("/api/venues")
def create_venue(venue: VenueCreate, background_tasks: BackgroundTasks):
    try:
        query = """
            INSERT INTO venue_venue (
                name, address_one, address_two, suburb, city, capacity,
                has_power, power_type, power_backup, internet_service_provider,
                completeness_score, is_private_residence, notes, time_zone,
                wifi_name, wifi_password, has_pa_system, pa_system_provider,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, 'Africa/Harare',
                %s, %s, %s, %s,
                NOW(), NOW()
            ) RETURNING id;
        """
        params = (
            venue.name, venue.address_one, venue.address_two, venue.suburb, venue.city, venue.capacity,
            venue.has_power, venue.power_type, venue.power_backup, venue.internet_service_provider,
            venue.completeness_score, venue.is_private_residence, venue.notes,
            venue.wifi_name, venue.wifi_password, venue.has_pa_system, venue.pa_system_provider
        )
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                inserted_id = cur.fetchone()[0]
                conn.commit()
                
                # Register background check task
                background_tasks.add_task(auto_check_venue_and_message_contact, inserted_id)
                
                return {"status": "success", "id": str(inserted_id)}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


def extract_message_content(content: Any) -> str:
    """Helper to convert LangChain message content (which can be a string or a list of dicts) into a plain string."""
    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, dict) and "text" in part:
                text_parts.append(part["text"])
            elif isinstance(part, str):
                text_parts.append(part)
        return "".join(text_parts)
    return str(content)

@app.post("/api/agent/chat", response_model=ChatResponse)
async def chat_with_agent(request: ChatRequest):
    if get_agent_graph is None:
        raise HTTPException(
            status_code=500,
            detail="Agent is not initialized. Please check that GEMINI_API_KEY is configured in your .env file."
        )
    
    try:
        # Convert incoming chat messages into LangChain messages format
        langchain_messages = []
        for msg in request.messages:
            if msg.role == "user":
                langchain_messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                langchain_messages.append(AIMessage(content=msg.content))
            elif msg.role == "system":
                langchain_messages.append(SystemMessage(content=msg.content))
        
        # Instantiate/get agent graph
        agent = get_agent_graph()
        
        # Run agent graph
        result = await agent.ainvoke({"messages": langchain_messages})
        
        # Extract the last message from the result
        output_messages = result.get("messages", [])
        if not output_messages:
            raise HTTPException(status_code=500, detail="No messages returned from the agent graph.")
        
        # The final answer is the content of the last message
        final_message = output_messages[-1]
        
        # Format the output messages to return
        formatted_messages = []
        for m in output_messages:
            role = "user"
            if isinstance(m, AIMessage):
                role = "assistant"
            elif isinstance(m, SystemMessage):
                role = "system"
            
            formatted_messages.append({
                "role": role,
                "content": extract_message_content(m.content),
                "type": m.__class__.__name__
            })
            
        return ChatResponse(
            response=extract_message_content(final_message.content),
            messages=formatted_messages
        )
        
    except ValueError as val_err:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as err:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"An error occurred: {str(err)}")
@app.get("/api/whatsapp/webhook")
def verify_meta_webhook(request: Request):
    """
    Verification endpoint required by Meta WhatsApp Cloud API.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    if mode and token:
        verify_token = os.getenv("META_VERIFY_TOKEN")
        if mode == "subscribe" and token == verify_token:
            from fastapi.responses import PlainTextResponse
            return PlainTextResponse(content=challenge)
        else:
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    return {"status": "ready"}

@app.post("/api/whatsapp/webhook")
async def receive_whatsapp_webhook(request: Request):
    """
    Webhook endpoint to receive incoming WhatsApp messages from Twilio or Meta.
    It runs the query through the AI database agent and responds automatically.
    """
    content_type = request.headers.get("content-type", "")
    sender = None
    message_body = None
    
    if "application/x-www-form-urlencoded" in content_type:
        # Twilio payload
        form_data = await request.form()
        # Form values from Twilio are typically format: whatsapp:+263770000000
        sender = form_data.get("From")
        message_body = form_data.get("Body")
        if sender and sender.startswith("whatsapp:"):
            sender = sender.split("whatsapp:")[1]
    else:
        # Meta payload (JSON)
        try:
            body = await request.json()
            entry = body.get("entry", [])[0]
            changes = entry.get("changes", [])[0]
            value = changes.get("value", {})
            messages = value.get("messages", [])
            if messages:
                message = messages[0]
                sender = message.get("from")
                if message.get("type") == "text":
                    message_body = message.get("text", {}).get("body")
        except Exception as e:
            import logging
            logging.error(f"Error parsing Meta payload: {e}")
            
    if not sender or not message_body:
        return {"status": "ignored", "reason": "No sender or message found"}
        

    try:
        # 1. Save user's message to database history
        try:
            save_whatsapp_message(sender, "user", message_body)
        except Exception as db_err:
            logger.warning(f"Failed to save user WhatsApp message to DB: {db_err}")
        
        # 2. Get past history for this sender (including the message we just saved)
        try:
            db_history = get_whatsapp_chat_history(sender, limit=20)
        except Exception as db_err:
            logger.warning(f"Failed to get WhatsApp chat history from DB: {db_err}")
            db_history = []
        
        # Retrieve sender name, role, and crew status to inject context
        info = get_contact_info(sender)
        sender_name = info["name"]
        sender_role = info["role"]
        is_crew = info["is_crew"]
        
        # 3. Convert history to LangChain messages format, starting with a SystemMessage context
        langchain_messages = [
            SystemMessage(
                content=(
                    f"You are currently conversing via WhatsApp with {sender_name} at phone number {sender} (Role: {sender_role}).\n"
                    f"Their relation to the company: {'Crew/Staff Member (internal)' if is_crew else 'Client/Venue Coordinator (external)'}.\n"
                    f"Tone instructions: Use a {'friendly, buddy-like, informal, and joking' if is_crew else 'highly professional, polite, and formal'} tone with them."
                )
            )
        ]
        
        # Convert history and verify if current message is in history (to prevent duplicates)
        has_current_message = False
        for msg in db_history:
            if msg["role"] == "user":
                langchain_messages.append(HumanMessage(content=msg["content"]))
                if msg["content"] == message_body:
                    has_current_message = True
            elif msg["role"] == "assistant":
                langchain_messages.append(AIMessage(content=msg["content"]))
                
        # If DB connection failed or current message is not in history, append it
        if not has_current_message:
            langchain_messages.append(HumanMessage(content=message_body))
                
        # 4. Invoke the AI Agent Graph
        if get_agent_graph is None:
            raise ValueError("Agent graph is not initialized.")
            
        agent = get_agent_graph()
        result = await agent.ainvoke({"messages": langchain_messages})
        
        # 5. Extract AI agent's response
        output_messages = result.get("messages", [])
        if not output_messages:
            raise ValueError("No response returned from agent.")
            
        final_message = output_messages[-1]
        ai_response = extract_message_content(final_message.content)
        
        # 6. Save agent's reply to database history
        try:
            save_whatsapp_message(sender, "assistant", ai_response)
        except Exception as db_err:
            logger.warning(f"Failed to save assistant WhatsApp reply to DB: {db_err}")
        
        # 7. Send message back to user via WhatsApp
        send_whatsapp_message(sender, ai_response)
        
        return {"status": "success", "response": ai_response}
        
    except Exception as e:
        import logging
        logging.error(f"Error handling WhatsApp webhook: {e}", exc_info=True)
        # Return 200 OK to the API Gateway to prevent infinite retries, but log the error
        return {"status": "error", "detail": str(e)}

if __name__ == "__main__":

    # Get port from env or default to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
