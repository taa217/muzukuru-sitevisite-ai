import os
import logging
import requests
from typing import Dict, Any

logger = logging.getLogger(__name__)

def send_whatsapp_message(to_number: str, message_body: str) -> Dict[str, Any]:
    """
    Sends a WhatsApp message using the configured provider (Twilio or Meta Cloud API).
    to_number: Recipient's phone number with country code (e.g. '+263770000000').
    message_body: The text content of the message.
    """
    provider = os.getenv("WHATSAPP_PROVIDER", "twilio").lower()
    
    # Clean up phone numbers (remove whitespace and non-numeric except +)
    clean_to = "".join([c for c in to_number if c.isdigit() or c == "+"])
    if not clean_to.startswith("+"):
        # Default to prefixing + if missing
        clean_to = "+" + clean_to
        
    if provider == "twilio":
        return _send_via_twilio(clean_to, message_body)
    elif provider == "meta":
        return _send_via_meta(clean_to, message_body)
    else:
        raise ValueError(f"Unsupported WHATSAPP_PROVIDER: '{provider}'")

def _send_via_twilio(to_number: str, message_body: str) -> Dict[str, Any]:
    """Sends WhatsApp message via Twilio's HTTP REST API using standard requests."""
    account_sid = os.getenv("TWILIO_ACCOUNT_SID")
    auth_token = os.getenv("TWILIO_AUTH_TOKEN")
    from_number = os.getenv("TWILIO_SENDER_NUMBER")
    
    if not account_sid or not auth_token or not from_number:
        raise ValueError("Missing required Twilio environment variables: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_SENDER_NUMBER")
        
    # Clean from_number format
    clean_from = "".join([c for c in from_number if c.isdigit() or c == "+"])
    if not clean_from.startswith("+"):
        clean_from = "+" + clean_from
        
    url = f"https://api.twilio.com/2010-04-01/Accounts/{account_sid}/Messages.json"
    
    data = {
        "To": f"whatsapp:{to_number}",
        "From": f"whatsapp:{clean_from}",
        "Body": message_body
    }
    
    logger.info(f"Sending Twilio WhatsApp message to {to_number}")
    response = requests.post(url, data=data, auth=(account_sid, auth_token))
    
    if not response.ok:
        logger.error(f"Twilio API Error ({response.status_code}): {response.text}")
        response.raise_for_status()
        
    return response.json()

def _send_via_meta(to_number: str, message_body: str) -> Dict[str, Any]:
    """Sends WhatsApp message via Meta's Cloud API using standard requests."""
    access_token = os.getenv("META_ACCESS_TOKEN")
    phone_number_id = os.getenv("META_PHONE_NUMBER_ID")
    
    if not access_token or not phone_number_id:
        raise ValueError("Missing required Meta environment variables: META_ACCESS_TOKEN, META_PHONE_NUMBER_ID")
        
    # Meta expects number with country code, e.g. '15550223131' or '+15550223131'. Let's strip '+'.
    clean_number = to_number.lstrip("+")
    
    url = f"https://graph.facebook.com/v22.0/{phone_number_id}/messages"
    
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Content-Type": "application/json"
    }
    
    # Defaulting to a text message
    data = {
        "messaging_product": "whatsapp",
        "to": clean_number,
        "type": "text",
        "text": {
            "body": message_body
        }
    }
    
    logger.info(f"Sending Meta WhatsApp message to {clean_number}")
    response = requests.post(url, headers=headers, json=data)
    
    if not response.ok:
        logger.error(f"Meta API Error ({response.status_code}): {response.text}")
        response.raise_for_status()
        
    return response.json()
