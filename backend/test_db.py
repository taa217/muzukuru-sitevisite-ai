import sys
import os
from dotenv import load_dotenv

# Load env variables
load_dotenv()

# Add the current directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.dirname(__file__)))

from app.agent.db import save_whatsapp_message, get_whatsapp_chat_history

test_phone = "+1234567890"

try:
    print("Saving test message to database...")
    save_whatsapp_message(test_phone, "user", "Hello this is a test message from test_db.py!")
    print("Saved user message successfully.")
    
    save_whatsapp_message(test_phone, "assistant", "This is an AI response from test_db.py!")
    print("Saved assistant reply successfully.")
    
    print("\nRetrieving chat history from database...")
    history = get_whatsapp_chat_history(test_phone)
    print(f"Retrieved {len(history)} messages:")
    for msg in history:
        print(f"- {msg['role']}: {msg['content']}")
        
except Exception as e:
    print(f"Error occurred during testing: {e}")
    sys.exit(1)

print("\nDatabase test completed successfully!")
