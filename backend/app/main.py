import os
import uvicorn
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import List, Dict, Any
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage

# Import agent graph builder
try:
    from app.agent.graph import get_agent_graph
except Exception as e:
    get_agent_graph = None
    import logging
    logging.warning(f"Failed to import get_agent_graph: {e}")

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

from app.agent.db import execute_read_query, get_db_connection

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

@app.post("/api/venues")
def create_venue(venue: VenueCreate):
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

if __name__ == "__main__":
    # Get port from env or default to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
