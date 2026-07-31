import os
import re
import logging
import requests
from typing import Dict, Any, Optional, List, Tuple

logger = logging.getLogger(__name__)

# Regex pattern to match image URLs in text (e.g. .jpg, .jpeg, .png, .webp, .gif, .jfif, .avif, .bmp, .svg, .tiff with optional query parameters)
IMAGE_URL_PATTERN = re.compile(
    r'https?://[^\s<>"\'\)\()]+\.(?:jpg|jpeg|png|webp|gif|jfif|avif|bmp|svg|tiff)(?:\?[^\s<>"\'\)\()]*)?',
    re.IGNORECASE
)

def extract_image_urls_from_text(text: str) -> Tuple[List[str], str]:
    """
    Extracts all image URLs from a text string.
    Returns (list_of_image_urls, cleaned_text_without_urls).
    """
    if not text:
        return [], ""
    
    image_urls = IMAGE_URL_PATTERN.findall(text)
    unique_urls = []
    for url in image_urls:
        if url not in unique_urls:
            unique_urls.append(url)
            
    cleaned_text = text
    for url in unique_urls:
        cleaned_text = cleaned_text.replace(url, "")
        
    cleaned_text = re.sub(r'\[\s*\]|\(\s*\)', '', cleaned_text)
    cleaned_text = re.sub(r'\n\s*\n', '\n', cleaned_text).strip()
    return unique_urls, cleaned_text

def send_whatsapp_message(to_number: str, message_body: str = "", media_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Sends a WhatsApp message using the configured provider (Twilio or Meta Cloud API).
    to_number: Recipient's phone number with country code (e.g. '+263770000000').
    message_body: The text content or caption of the message.
    media_url: Optional URL of an image/media file to send.
    """
    provider = os.getenv("WHATSAPP_PROVIDER", "twilio").lower()
    
    # Clean up phone numbers (remove whitespace and non-numeric except +)
    clean_to = "".join([c for c in to_number if c.isdigit() or c == "+"])
    if not clean_to.startswith("+"):
        # Default to prefixing + if missing
        clean_to = "+" + clean_to
        
    # Auto-extract any image URLs embedded inside message_body text
    found_urls, cleaned_body = extract_image_urls_from_text(message_body)
    
    all_media_urls = []
    if media_url and media_url.strip():
        all_media_urls.append(media_url.strip())
        
    for url in found_urls:
        if url not in all_media_urls:
            all_media_urls.append(url)

    # If no image/media URLs exist, send standard text message
    if not all_media_urls:
        if provider == "twilio":
            return _send_via_twilio(clean_to, message_body=message_body, media_url=None)
        elif provider == "meta":
            return _send_via_meta(clean_to, message_body=message_body, media_url=None)
        else:
            raise ValueError(f"Unsupported WHATSAPP_PROVIDER: '{provider}'")

    # If media URLs exist, send real image attachments (media_url) via WhatsApp API
    first_media = all_media_urls[0]
    caption = cleaned_body
    
    if provider == "twilio":
        last_res = _send_via_twilio(clean_to, message_body=caption, media_url=first_media)
        for extra_media in all_media_urls[1:]:
            last_res = _send_via_twilio(clean_to, message_body="", media_url=extra_media)
        return last_res
    elif provider == "meta":
        last_res = _send_via_meta(clean_to, message_body=caption, media_url=first_media)
        for extra_media in all_media_urls[1:]:
            last_res = _send_via_meta(clean_to, message_body="", media_url=extra_media)
        return last_res
    else:
        raise ValueError(f"Unsupported WHATSAPP_PROVIDER: '{provider}'")


def _send_via_twilio(to_number: str, message_body: str = "", media_url: Optional[str] = None) -> Dict[str, Any]:
    """Sends WhatsApp message (text and/or media) via Twilio's HTTP REST API using standard requests."""
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
    }
    
    if message_body:
        data["Body"] = message_body
        
    if media_url:
        data["MediaUrl"] = media_url
        
    if not message_body and not media_url:
        raise ValueError("Either message_body or media_url must be provided for WhatsApp message.")

    logger.info(f"Sending Twilio WhatsApp message to {to_number} (media: {bool(media_url)})")
    response = requests.post(url, data=data, auth=(account_sid, auth_token))
    
    if not response.ok:
        logger.error(f"Twilio API Error ({response.status_code}): {response.text}")
        response.raise_for_status()
        
    return response.json()

def _send_via_meta(to_number: str, message_body: str = "", media_url: Optional[str] = None) -> Dict[str, Any]:
    """Sends WhatsApp message (text or media) via Meta's Cloud API using standard requests."""
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
    
    if media_url:
        img_payload = {"link": media_url}
        if message_body:
            img_payload["caption"] = message_body
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_number,
            "type": "image",
            "image": img_payload
        }
    else:
        if not message_body:
            raise ValueError("Either message_body or media_url must be provided for WhatsApp message.")
        data = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_number,
            "type": "text",
            "text": {
                "body": message_body
            }
        }
    
    logger.info(f"Sending Meta WhatsApp message to {clean_number} (media: {bool(media_url)})")
    response = requests.post(url, headers=headers, json=data)
    
    if not response.ok:
        logger.error(f"Meta API Error ({response.status_code}): {response.text}")
        response.raise_for_status()
        
    return response.json()
