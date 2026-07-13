import sys
import os

# Add the 'backend' directory to the Python path
# This allows us to import from the 'app' module directly as configured in the backend
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Import the FastAPI application
from app.main import app
