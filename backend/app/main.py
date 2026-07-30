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
    "+263781646052": {"name": "Clyde", "role": "Crew member", "is_crew": True},
    "+263788918512": {"name": "Mr Muza", "role": "Client / Venue coordinator", "is_crew": False},
    "+263771453985": {"name": "Leon", "role": "CEO", "is_crew": True},
    "+263718834117": {"name": "Max", "role": "Crew member", "is_crew": True},
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
            
    # Fallback to database lookup
    try:
        from app.agent.db import execute_read_query
        db_query = "SELECT name, first_name, last_name, phone, role FROM contact_contact WHERE phone IS NOT NULL AND phone != '';"
        cols, db_rows = execute_read_query(db_query)
        for r in db_rows:
            db_phone = r[3]
            db_digits = "".join([c for c in db_phone if c.isdigit()])
            if db_digits.startswith("263") and len(db_digits) > 3:
                db_local = db_digits[3:]
            else:
                db_local = db_digits
                
            if local_part == db_local:
                name = r[0]
                if not name:
                    name = f"{r[1] or ''} {r[2] or ''}".strip() or "Unknown"
                return {
                    "name": name,
                    "role": r[4] or "Client / Venue coordinator",
                    "is_crew": False
                }
    except Exception as db_err:
        logger.error(f"Error querying contact_contact for phone_number {phone_number}: {db_err}")
        
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
            SELECT v.id, v.name, v.address_one, v.address_two, v.suburb, v.city, v.capacity,
                   v.has_power, v.power_type, v.power_backup, v.internet_service_provider,
                   v.completeness_score, v.is_private_residence, v.venue_type, v.media_urls,
                   v.has_pa_system, v.pa_system_provider, v.wifi_name, v.notes, v.floor_plan_file_urls,
                   v.power_outage_rate, v.power_socket_type, v.power_distance_from_livestream_desk,
                   v.internet_upload_speed, v.router_accessibility, v.router_distance_from_livestream,
                   v.pa_system_distance_from_livestream, v.other_pa_system_providers, v.pa_system_contact_phone,
                   v.pa_system_contact_email, v.website, v.facebook, v.instagram,
                   COALESCE(
                       (SELECT file FROM venue_venuedocument WHERE venue_id = v.id AND is_cover = true AND file ~* '\\.(jpg|jpeg|png|webp|jfif)$' LIMIT 1),
                       (SELECT file FROM venue_venuedocument WHERE venue_id = v.id AND file_type = 'venue_photos' AND file ~* '\\.(jpg|jpeg|png|webp|jfif)$' ORDER BY id ASC LIMIT 1),
                       (SELECT file FROM venue_venuedocument WHERE venue_id = v.id AND file ~* '\\.(jpg|jpeg|png|webp|jfif)$' ORDER BY id ASC LIMIT 1)
                   ) as cover_image
            FROM venue_venue v
            ORDER BY v.completeness_score DESC, v.name ASC;
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
                "media_urls": row[14],
                "has_pa_system": row[15],
                "pa_system_provider": row[16],
                "wifi_name": row[17],
                "notes": row[18],
                "floor_plan_file_urls": row[19],
                "power_outage_rate": row[20],
                "power_socket_type": row[21],
                "power_distance_from_livestream_desk": row[22],
                "internet_upload_speed": row[23],
                "router_accessibility": row[24],
                "router_distance_from_livestream": row[25],
                "pa_system_distance_from_livestream": row[26],
                "other_pa_system_providers": row[27],
                "pa_system_contact_phone": row[28],
                "pa_system_contact_email": row[29],
                "website": row[30],
                "facebook": row[31],
                "instagram": row[32],
                "cover_image": row[33]
            })
        return venues
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/contacts")
def get_all_contacts(q: str | None = None):
    try:
        if q and q.strip():
            search_pattern = f"%{q.strip()}%"
            query = """
                SELECT id, first_name, last_name, name, email, phone, role, contact_type, contact_source, contact_image
                FROM contact_contact
                WHERE name ILIKE %s OR phone ILIKE %s OR email ILIKE %s
                ORDER BY name ASC NULLS LAST;
            """
            cols, rows = execute_read_query(query, (search_pattern, search_pattern, search_pattern))
        else:
            query = """
                SELECT id, first_name, last_name, name, email, phone, role, contact_type, contact_source, contact_image
                FROM contact_contact
                ORDER BY name ASC NULLS LAST;
            """
            cols, rows = execute_read_query(query)
            
        contacts = []
        for row in rows:
            name = row[3]
            if not name:
                fname = row[1] or ""
                lname = row[2] or ""
                name = f"{fname} {lname}".strip() or "Unnamed Contact"
            contacts.append({
                "id": str(row[0]),
                "first_name": row[1],
                "last_name": row[2],
                "name": name,
                "email": row[4],
                "phone": row[5],
                "role": row[6] or "Coordinator / Staff",
                "contact_type": row[7],
                "contact_source": row[8],
                "contact_image": row[9]
            })
        return contacts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/venues/{venue_id}/contacts")
def get_venue_contacts(venue_id: int):
    try:
        query = """
            SELECT c.id, c.first_name, c.last_name, c.name, c.email, c.phone, c.role, c.contact_type, c.contact_image
            FROM venue_venue_contacts vc
            JOIN contact_contact c ON vc.contact_id = c.id
            WHERE vc.venue_id = %s
            ORDER BY c.id ASC;
        """
        cols, rows = execute_read_query(query, (venue_id,))
        contacts = []
        for row in rows:
            name = row[3]
            if not name:
                fname = row[1] or ""
                lname = row[2] or ""
                name = f"{fname} {lname}".strip() or "Unnamed Contact"
            contacts.append({
                "id": str(row[0]),
                "first_name": row[1],
                "last_name": row[2],
                "name": name,
                "email": row[4],
                "phone": row[5],
                "role": row[6] or "Coordinator / Staff",
                "contact_type": row[7],
                "contact_image": row[8]
            })
        return contacts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/venues/{venue_id}/layouts")
def get_venue_layouts(venue_id: int):
    try:
        query = """
            SELECT id, layout_type, capacity
            FROM venue_venuelayout
            WHERE venue_id = %s
            ORDER BY id ASC;
        """
        cols, rows = execute_read_query(query, (venue_id,))
        layouts = []
        for row in rows:
            layouts.append({
                "id": str(row[0]),
                "layout_type": row[1],
                "capacity": row[2]
            })
        return layouts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/venues/{venue_id}/documents")
def get_venue_documents(venue_id: int):
    try:
        query = """
            SELECT id, file, file_type, is_cover
            FROM venue_venuedocument
            WHERE venue_id = %s
            ORDER BY is_cover DESC, id ASC;
        """
        cols, rows = execute_read_query(query, (venue_id,))
        docs = []
        for row in rows:
            docs.append({
                "id": str(row[0]),
                "file": row[1],
                "file_type": row[2],
                "is_cover": row[3]
            })
        return docs
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

@app.get("/api/venues/{venue_id}/bookings")
def get_venue_bookings(venue_id: int):
    try:
        query = """
            SELECT id, scheduled_date_time, status, notes, created_at
            FROM venue_sitevisit
            WHERE venue_id = %s
            ORDER BY created_at DESC;
        """
        cols, rows = execute_read_query(query, (venue_id,))
        bookings = []
        for row in rows:
            bookings.append({
                "id": str(row[0]),
                "site_visit_date": row[1].isoformat() if hasattr(row[1], 'isoformat') and row[1] else (str(row[1]) if row[1] else None),
                "status": row[2],
                "notes": row[3],
                "created_at": row[4].isoformat() if hasattr(row[4], 'isoformat') and row[4] else (str(row[4]) if row[4] else None)
            })
        return bookings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

class ContactCreate(BaseModel):
    contact_id: int | None = None
    first_name: str | None = None
    last_name: str | None = None
    email: str | None = None
    phone: str | None = None
    role: str | None = "Venue Contact"

class LayoutCreate(BaseModel):
    layout_type: str
    capacity: str | None = None

@app.post("/api/venues/{venue_id}/contacts")
def create_venue_contact(venue_id: int, contact: ContactCreate):
    try:
        if contact.contact_id:
            # Link existing contact to venue
            insert_assoc_query = """
                INSERT INTO venue_venue_contacts (venue_id, contact_id)
                VALUES (%s, %s);
            """
            conn = get_db_connection()
            with conn.cursor() as cur:
                cur.execute(insert_assoc_query, (venue_id, contact.contact_id))
                conn.commit()
            conn.close()
            return {"status": "linked", "contact_id": str(contact.contact_id)}

        first_name = contact.first_name or "Contact"
        full_name = f"{first_name} {contact.last_name or ''}".strip()
        insert_contact_query = """
            INSERT INTO contact_contact (first_name, last_name, name, email, phone, role, contact_type, contact_source, completeness_score, created_at, updated_at)
            VALUES (%s, %s, %s, %s, %s, %s, 'individual', 'manual', 50, NOW(), NOW())
            RETURNING id;
        """
        conn = get_db_connection()
        with conn.cursor() as cur:
            cur.execute(insert_contact_query, (
                first_name,
                contact.last_name,
                full_name,
                contact.email,
                contact.phone,
                contact.role
            ))
            contact_id = cur.fetchone()[0]
            
            insert_assoc_query = """
                INSERT INTO venue_venue_contacts (venue_id, contact_id)
                VALUES (%s, %s);
            """
            cur.execute(insert_assoc_query, (venue_id, contact_id))
            conn.commit()
        conn.close()
        
        return {
            "id": str(contact_id),
            "first_name": first_name,
            "last_name": contact.last_name,
            "name": full_name,
            "email": contact.email,
            "phone": contact.phone,
            "role": contact.role,
            "contact_type": "individual"
        }
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
    power_outage_rate: str | None = None
    power_socket_type: str | None = None
    power_backup: str | None = None
    power_distance_from_livestream_desk: str | None = None
    internet_service_provider: str | None = None
    wifi_name: str | None = None
    wifi_password: str | None = None
    internet_upload_speed: float | str | None = None
    router_accessibility: str | bool | None = None
    router_distance_from_livestream: str | None = None
    has_pa_system: bool = False
    pa_system_provider: str | None = None
    pa_system_distance_from_livestream: str | None = None
    other_pa_system_providers: str | None = None
    pa_system_contact_phone: str | None = None
    pa_system_contact_email: str | None = None
    website: str | None = None
    facebook: str | None = None
    instagram: str | None = None
    completeness_score: int = 30
    is_private_residence: bool = False
    notes: str | None = None
    contacts: List[ContactCreate] = []
    layouts: List[LayoutCreate] = []

class CrewMemberPayload(BaseModel):
    id: str | None = None
    name: str
    phone: str | None = None
    role: str | None = None

class SiteVisitCreate(BaseModel):
    venue_id: int
    scheduled_date_time: str | None = None
    notes: str | None = None
    status: str = "scheduled"
    contact_id: int | None = None
    assigned_crew: List[CrewMemberPayload] = []

async def auto_trigger_booking_coordination(
    booking_id: int,
    venue_id: int,
    contact_id: int | None = None,
    assigned_crew: List[CrewMemberPayload] | None = None
):
    """
    Background task triggered when a new booking (site visit) is created for a venue in DB.
    Waits 5 seconds, then queries the AI agent to inspect the venue and booking details in DB,
    notifies assigned crew members (or falls back to static crew) about the booking, and contacts
    the venue coordinator via WhatsApp to request any missing database details (power backup, wifi, capacity, etc.).
    """
    logger.info(f"Booking coordination task triggered for booking ID: {booking_id}, venue ID: {venue_id}, contact ID: {contact_id}. Waiting 5 seconds...")
    await asyncio.sleep(5)
    
    try:
        if get_agent_graph is None:
            logger.error("Agent graph is not initialized. Background booking check failed.")
            return
            
        agent = get_agent_graph()
        
        # Build assigned crew contact list or fallback to static crew members
        crew_details = []
        if assigned_crew:
            for member in assigned_crew:
                m_name = member.name if hasattr(member, 'name') else str(member.get("name", ""))
                m_phone = member.phone if hasattr(member, 'phone') else str(member.get("phone", "") or "")
                m_role = member.role if hasattr(member, 'role') else str(member.get("role", "") or "")
                if m_name and m_phone:
                    crew_details.append(f"{m_name}: {m_phone}")
                    # Dynamically register phone in CONTACTS map if unknown
                    clean_p = m_phone.strip()
                    if clean_p and clean_p not in CONTACTS:
                        CONTACTS[clean_p] = {"name": m_name, "role": m_role or "Crew member", "is_crew": True}

        if crew_details:
            crew_info_str = ", ".join(crew_details)
            logger.info(f"Using assigned crew for booking coordination: {crew_info_str}")
        else:
            crew_info_str = "Clyde: +263781646052, Leon: +263771453985, Max: +263718834117"
            logger.info(f"No specific assigned crew with phone provided; falling back to static crew: {crew_info_str}")
        
        # Resolve dynamic coordinator contact details for the venue from the DB
        coordinator_name = "Mr Muza"
        coordinator_phone = "+263788918512"
        try:
            if contact_id:
                contact_query = """
                    SELECT name, first_name, last_name, phone
                    FROM contact_contact
                    WHERE id = %s;
                """
                cols, rows = execute_read_query(contact_query, (contact_id,))
            else:
                contact_query = """
                    SELECT c.name, c.first_name, c.last_name, c.phone
                    FROM venue_venue_contacts vc
                    JOIN contact_contact c ON vc.contact_id = c.id
                    WHERE vc.venue_id = %s
                    ORDER BY c.id ASC;
                """
                cols, rows = execute_read_query(contact_query, (venue_id,))

            if rows:
                row = rows[0]
                name = row[0]
                if not name:
                    fname = row[1] or ""
                    lname = row[2] or ""
                    name = f"{fname} {lname}".strip()
                phone = row[3]
                if name and phone:
                    coordinator_name = name
                    coordinator_phone = phone
                    logger.info(f"Resolved dynamic coordinator: {coordinator_name} ({coordinator_phone}) for venue ID {venue_id}")
                else:
                    logger.info(f"Venue ID {venue_id} / Contact ID {contact_id} has contacts but name/phone is missing, falling back to default.")
            else:
                logger.info(f"No contacts saved in database for venue ID {venue_id}. Falling back to default coordinator.")
        except Exception as db_err:
            logger.error(f"Error querying contacts for venue ID {venue_id}: {db_err}")
            
        instruction_msg = HumanMessage(
            content=(
                f"Automated trigger: A new booking (site visit ID: {booking_id}) has been created for venue ID {venue_id}.\n"
                "Please perform the following coordination tasks:\n"
                f"1. Use `run_sql_query_tool` to inspect both `venue_sitevisit` (for site visit ID {booking_id}) and `venue_venue` (for venue ID {venue_id}) to gather venue and booking details.\n"
                f"2. Inform the assigned crew ({crew_info_str}) using `send_whatsapp_message_tool` about the newly booked site visit. Use a friendly, buddy-like, informal tone. Tell them the venue name, booking schedule/notes, and that you are now reaching out to the venue coordinator {coordinator_name} ({coordinator_phone}) to collect any missing venue information.\n"
                f"3. Reach out to the client/venue coordinator {coordinator_name} ({coordinator_phone}) using `send_whatsapp_message_tool` by sending TWO separate, sequential WhatsApp messages in STRICT ORDER:\n"
                "   - FIRST TOOL CALL (Message 1 - Introduction): Send a warm, conversational, and natural greeting FIRST. Introduce yourself as Nyasha from Muzukuru, mention that the crew is going to stream at their venue/place soon, and explain that you need to get a few details. Generate this message dynamically and naturally based on context so it feels human, not static or formulaic.\n"
                "   - SECOND TOOL CALL (Message 2 - Questions): Follow-up message asking for the 2-3 key missing details (e.g. backup power, Wi-Fi, capacity, PA system) using full, intuitive, everyday conversational questions. Do NOT use dry lists or shorthand database fields.\n"
                "   - CRITICAL ORDERING RULE: You MUST output the tool call for Message 1 (Introduction) FIRST in your tool calls list, and Message 2 (Questions) SECOND. Never reverse this sequence!\n"
                "Do NOT mention database tables, IDs, or completeness scores.\n"
                "Ensure you use `send_whatsapp_message_tool` for each contact."
            )
        )
        
        logger.info(f"Invoking agent graph for auto checking booking {booking_id} and venue {venue_id}")
        await agent.ainvoke({"messages": [instruction_msg]})
        logger.info(f"Finished background check and message task for booking {booking_id} and venue {venue_id}")
        
    except Exception as e:
        logger.error(f"Error in auto_trigger_booking_coordination: {e}", exc_info=True)


@app.post("/api/venues")
def create_venue(venue: VenueCreate):
    try:
        router_acc_str = str(venue.router_accessibility) if venue.router_accessibility is not None else None
        upload_speed_val = float(venue.internet_upload_speed) if venue.internet_upload_speed and str(venue.internet_upload_speed).replace('.', '', 1).isdigit() else None

        query = """
            INSERT INTO venue_venue (
                name, address_one, address_two, suburb, city, capacity,
                has_power, power_type, power_backup, internet_service_provider,
                completeness_score, is_private_residence, notes, time_zone,
                wifi_name, wifi_password, has_pa_system, pa_system_provider,
                venue_type, power_outage_rate, power_socket_type,
                power_distance_from_livestream_desk, internet_upload_speed,
                router_accessibility, router_distance_from_livestream,
                pa_system_distance_from_livestream, other_pa_system_providers,
                pa_system_contact_phone, pa_system_contact_email,
                website, facebook, instagram,
                created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                %s, %s, %s, %s,
                %s, %s, %s, 'Africa/Harare',
                %s, %s, %s, %s,
                %s, %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s,
                %s, %s, %s,
                NOW(), NOW()
            ) RETURNING id;
        """
        params = (
            venue.name, venue.address_one, venue.address_two, venue.suburb, venue.city, venue.capacity,
            venue.has_power, venue.power_type, venue.power_backup, venue.internet_service_provider,
            venue.completeness_score, venue.is_private_residence, venue.notes,
            venue.wifi_name, venue.wifi_password, venue.has_pa_system, venue.pa_system_provider,
            venue.venue_type, venue.power_outage_rate, venue.power_socket_type,
            venue.power_distance_from_livestream_desk, upload_speed_val,
            router_acc_str, venue.router_distance_from_livestream,
            venue.pa_system_distance_from_livestream, venue.other_pa_system_providers,
            venue.pa_system_contact_phone, venue.pa_system_contact_email,
            venue.website, venue.facebook, venue.instagram
        )
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                inserted_id = cur.fetchone()[0]
                
                # Insert contacts if provided
                if venue.contacts:
                    for contact in venue.contacts:
                        if contact.contact_id:
                            # Existing DB contact selected
                            cur.execute("INSERT INTO venue_venue_contacts (venue_id, contact_id) VALUES (%s, %s);", (inserted_id, contact.contact_id))
                        elif contact.first_name and contact.first_name.strip():
                            # New contact created
                            full_name = f"{contact.first_name.strip()} {contact.last_name or ''}".strip()
                            insert_contact_query = """
                                INSERT INTO contact_contact (first_name, last_name, name, email, phone, role, contact_type, contact_source, completeness_score, created_at, updated_at)
                                VALUES (%s, %s, %s, %s, %s, %s, 'individual', 'manual', 50, NOW(), NOW())
                                RETURNING id;
                            """
                            cur.execute(insert_contact_query, (
                                contact.first_name.strip(),
                                contact.last_name.strip() if contact.last_name else None,
                                full_name,
                                contact.email.strip() if contact.email else None,
                                contact.phone.strip() if contact.phone else None,
                                contact.role.strip() if contact.role else "Venue Contact"
                            ))
                            c_id = cur.fetchone()[0]
                            cur.execute("INSERT INTO venue_venue_contacts (venue_id, contact_id) VALUES (%s, %s);", (inserted_id, c_id))
                
                # Insert layouts if provided
                if venue.layouts:
                    for layout in venue.layouts:
                        if layout.layout_type and layout.layout_type.strip():
                            insert_layout_query = """
                                INSERT INTO venue_venuelayout (venue_id, layout_type, capacity, created_at, updated_at)
                                VALUES (%s, %s, %s, NOW(), NOW());
                            """
                            cur.execute(insert_layout_query, (
                                inserted_id,
                                layout.layout_type.strip(),
                                layout.capacity.strip() if layout.capacity else None
                            ))

                conn.commit()
                return {"status": "success", "id": str(inserted_id)}
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@app.post("/api/venue/site-visits")
def create_site_visit(site_visit: SiteVisitCreate, background_tasks: BackgroundTasks):
    try:
        query = """
            INSERT INTO venue_sitevisit (
                venue_id, status, scheduled_date_time, notes, created_at, updated_at
            ) VALUES (
                %s, %s, %s, %s, NOW(), NOW()
            ) RETURNING id;
        """
        params = (
            site_visit.venue_id,
            site_visit.status,
            site_visit.scheduled_date_time if site_visit.scheduled_date_time else None,
            site_visit.notes if site_visit.notes else None
        )
        
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(query, params)
                inserted_id = cur.fetchone()[0]
                conn.commit()
                
                # Register background booking trigger task
                background_tasks.add_task(
                    auto_trigger_booking_coordination,
                    inserted_id,
                    site_visit.venue_id,
                    site_visit.contact_id,
                    site_visit.assigned_crew
                )
                
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
@app.get("/api/whatsapp/webhook")
@app.get("/api/whatsapp/webhook/")
def verify_meta_webhook(request: Request):
    """
    Verification endpoint required by Meta WhatsApp Cloud API.
    """
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")
    
    logger.info(f"Meta webhook verification attempt: mode={mode}, token={token}")
    
    if mode and token:
        verify_token = os.getenv("META_VERIFY_TOKEN", "").strip()
        if mode == "subscribe" and token == verify_token:
            from fastapi.responses import PlainTextResponse
            logger.info("Meta webhook verification SUCCESSFUL!")
            return PlainTextResponse(content=challenge)
        else:
            logger.warning(f"Meta verify token mismatch: received '{token}', expected '{verify_token}'")
            raise HTTPException(status_code=403, detail="Verification token mismatch")
    return {"status": "ready"}

async def process_incoming_whatsapp_message(sender: str, message_body: str):
    """
    Background task to process an incoming WhatsApp message, invoke the agent,
    and reply back via WhatsApp.
    """
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

        # Fetch venue context if external coordinator
        venue_ctx_str = ""
        if not is_crew:
            try:
                clean_phone = "".join([c for c in sender if c.isdigit()])
                local_phone = clean_phone[-9:] if len(clean_phone) >= 9 else clean_phone
                v_query = """
                    SELECT v.id, v.name, v.completeness_score, v.capacity, v.has_power, v.power_backup, v.power_type,
                           v.internet_service_provider, v.wifi_name, v.wifi_password, v.router_accessibility,
                           v.power_socket_type, v.power_distance_from_livestream_desk, v.router_distance_from_livestream,
                           v.has_pa_system, v.pa_system_provider,
                           v.address_one, v.suburb, v.city, v.venue_type, v.is_private_residence,
                           v.website, v.facebook, v.instagram, v.notes
                    FROM venue_venue v
                    JOIN venue_venue_contacts vc ON v.id = vc.venue_id
                    JOIN contact_contact c ON vc.contact_id = c.id
                    WHERE c.phone LIKE %s OR c.phone LIKE %s
                    ORDER BY v.created_at DESC
                    LIMIT 1;
                """
                v_cols, v_rows = execute_read_query(v_query, (f"%{local_phone}", f"%{sender.strip()}"))
                if v_rows:
                    vr = v_rows[0]
                    (
                        v_id, v_name, v_score, v_cap, v_pow, v_pow_back, v_pow_type,
                        v_isp, v_wifi, v_wifi_pass, v_rtr_acc,
                        v_sock, v_pow_dist, v_rtr_dist,
                        v_pa, v_pa_prov,
                        v_addr, v_sub, v_city, v_type, v_priv,
                        v_web, v_fb, v_ig, v_notes
                    ) = vr
                    
                    filled_fields = []
                    missing_fields = []
                    
                    # Priority Tier 1: Core Power & Capacity
                    if v_cap: filled_fields.append(f"capacity: {v_cap}") 
                    else: missing_fields.append("capacity (Tier 1)")
                    
                    if v_pow or v_pow_back: filled_fields.append(f"power_backup: {v_pow_back or 'Yes'}") 
                    else: missing_fields.append("has_power/power_backup (Tier 1)")
                    
                    # Priority Tier 2: Wi-Fi & Internet Connectivity
                    if v_isp or v_wifi: filled_fields.append(f"wifi/isp: {v_isp or v_wifi}") 
                    else: missing_fields.append("internet_service_provider/wifi_name (Tier 2)")

                    if v_wifi_pass: filled_fields.append("wifi_password recorded")
                    else: missing_fields.append("wifi_password (Tier 2)")

                    if v_rtr_acc: filled_fields.append(f"router_accessibility: {v_rtr_acc}")
                    else: missing_fields.append("router_accessibility (Tier 2)")

                    # Priority Tier 3: Electrical & Desk Distances
                    if v_sock or v_pow_dist: filled_fields.append(f"power socket/dist: {v_pow_dist or v_sock}") 
                    else: missing_fields.append("power_socket_type/power_distance (Tier 3)")

                    # Priority Tier 4: Sound System & Vendor Details
                    if v_pa or v_pa_prov: filled_fields.append(f"pa_system: {v_pa_prov or 'Yes'}") 
                    else: missing_fields.append("has_pa_system/pa_system_provider (Tier 4)")

                    # Priority Tier 5: Location & Venue Type
                    if v_addr: filled_fields.append(f"address: {v_addr}, {v_sub or ''}") 
                    else: missing_fields.append("address_one/suburb/city (Tier 5)")

                    if v_type: filled_fields.append(f"venue_type: {v_type}")
                    else: missing_fields.append("venue_type (Tier 5)")

                    # Priority Tier 6: Online Presence & Website/Socials
                    if v_web: filled_fields.append(f"website: {v_web}")
                    else: missing_fields.append("website (Tier 6)")

                    if v_fb or v_ig: filled_fields.append(f"socials: {v_fb or v_ig}")
                    else: missing_fields.append("facebook/instagram (Tier 6)")
                    
                    venue_ctx_str = (
                        f"\nVENUE CONTEXT & MISSING FIELD TRACKER:\n"
                        f"- Target Venue: '{v_name}' (ID: {v_id}, DB Score: {v_score}%).\n"
                        f"- Filled Fields: {', '.join(filled_fields) if filled_fields else 'None'}.\n"
                        f"- Missing Fields: {', '.join(missing_fields) if missing_fields else 'None (All fields complete!)'}.\n"
                        f"- Action Required: Process any answers in the user's message, update `venue_venue` DB via SQL, and if missing fields remain, warmly acknowledge their response and ask the next missing question (max 1-2 questions at a time)."
                    )
            except Exception as v_err:
                logger.warning(f"Failed to fetch venue context for coordinator {sender}: {v_err}")

        # 3. Convert history to LangChain messages format, starting with a SystemMessage context
        langchain_messages = [
            SystemMessage(
                content=(
                    f"You are currently conversing via WhatsApp with {sender_name} at phone number {sender} (Role: {sender_role}).\n"
                    f"Their relation to the company: {'Crew/Staff Member (internal)' if is_crew else 'Client/Venue Coordinator (external)'}.\n"
                    f"Tone instructions: Use a {'friendly, buddy-like, informal, and joking' if is_crew else 'highly professional, polite, warm, and conversational'} tone with them.\n"
                    + (
                        f"Formatting guidelines for Client: Keep messages concise, intuitive, and easy to read. Use WhatsApp markdown (`*bolding*`, clear bullet points) and ask at most 1-2 questions at a time so they are never overwhelmed.{venue_ctx_str}"
                        if not is_crew else ""
                    )
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
        logger.info(f"Successfully processed incoming WhatsApp message from {sender} and sent reply.")
        
    except Exception as e:
        logger.error(f"Error processing incoming WhatsApp message from {sender}: {e}", exc_info=True)


@app.post("/api/whatsapp/webhook")
@app.post("/api/whatsapp/webhook/")
async def receive_whatsapp_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Webhook endpoint to receive incoming WhatsApp messages from Twilio or Meta.
    Returns HTTP 200 OK immediately to satisfy Meta's strict 5-second webhook response requirement,
    and processes the agent response in the background.
    """
    content_type = request.headers.get("content-type", "")
    sender = None
    message_body = None
    
    if "application/x-www-form-urlencoded" in content_type:
        # Twilio payload
        form_data = await request.form()
        raw_sender = form_data.get("From", "")
        message_body = form_data.get("Body")
        if raw_sender and raw_sender.startswith("whatsapp:"):
            raw_sender = raw_sender.split("whatsapp:")[1]
        digits = "".join([c for c in raw_sender if c.isdigit()])
        sender = f"+{digits}" if digits else raw_sender
    else:
        # Meta payload (JSON)
        try:
            body = await request.json()
            logger.info(f"Received Meta WhatsApp POST payload: {body}")
            
            entries = body.get("entry", [])
            for entry in entries:
                changes = entry.get("changes", [])
                for change in changes:
                    value = change.get("value", {})
                    messages = value.get("messages", [])
                    if messages:
                        msg = messages[0]
                        raw_sender = msg.get("from", "")
                        digits = "".join([c for c in raw_sender if c.isdigit()])
                        sender = f"+{digits}" if digits else raw_sender
                        
                        msg_type = msg.get("type")
                        if msg_type == "text":
                            message_body = msg.get("text", {}).get("body")
                        elif msg_type == "interactive":
                            interactive = msg.get("interactive", {})
                            i_type = interactive.get("type")
                            if i_type == "button_reply":
                                message_body = interactive.get("button_reply", {}).get("title") or interactive.get("button_reply", {}).get("id")
                            elif i_type == "list_reply":
                                message_body = interactive.get("list_reply", {}).get("title") or interactive.get("list_reply", {}).get("id")
                        elif msg_type == "button":
                            message_body = msg.get("button", {}).get("text") or msg.get("button", {}).get("payload")
                        else:
                            if isinstance(msg.get("text"), dict):
                                message_body = msg.get("text", {}).get("body")
                        break
        except Exception as e:
            logger.error(f"Error parsing Meta JSON payload: {e}")
            
    if not sender or not message_body:
        logger.info("Webhook received event without active text message content (e.g. delivery status update). Ignoring.")
        return {"status": "ignored", "reason": "No sender or message content found"}
        
    logger.info(f"Queuing WhatsApp message from {sender}: '{message_body}' for background processing")
    background_tasks.add_task(process_incoming_whatsapp_message, sender, message_body)
    return {"status": "success", "message": "Webhook received and processing in background"}

if __name__ == "__main__":

    # Get port from env or default to 8000
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)
