import os
import json
import logging
from datetime import datetime
import functions_framework
import googlemaps
from google.cloud import firestore
import vertexai
from vertexai.generative_models import GenerativeModel, Part, GenerationConfig

# Configure structured logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Clients
PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "reliefgrid-dev")
LOCATION = os.environ.get("GCP_LOCATION", "us-central1")
MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY")

vertexai.init(project=PROJECT_ID, location=LOCATION)
db = firestore.Client()
maps_client = googlemaps.Client(key=MAPS_API_KEY) if MAPS_API_KEY else None

# Specialized NLP Engine System Prompt
SYSTEM_PROMPT = """
Act as a specialized NLP engine for Indian relief logistics. Your goal is to process multimodal inputs (Image/Audio/Text) which may contain Hindi, Tamil, or Bengali scripts or dialects.

TASKS:
1. OCR/TRANSCRIPTION: Extract all text, prioritising handwritten notes on paper survey forms. 
2. TRANSLATION: Convert the intent and resource needs into English for the central database.
   - CONSTRAINT: STRICTLY preserve original location names (e.g., 'T. Nagar', 'Velachery', 'Howrah') to ensure geocoding accuracy.
3. STRUCTURED OUTPUT: Generate a JSON object.

SCHEMA:
{
  "language_detected": "string",
  "request_type": "string (e.g., medical, food, water, search_and_rescue)",
  "item": "string",
  "quantity": number,
  "urgency_level": number (1-5),
  "location": "string",
  "subject": "string",
  "timestamp": "ISO-8601 string"
}

CONSTRAINTS:
- 'urgency_level': 1 (Routine) to 5 (Critical/Life-threatening).
- 'subject': IF THE INPUT IS AUDIO (WhatsApp voice note), provide a summary of the core need in EXACTLY 10 words or less. Otherwise, set to null.
- RETURN ONLY VALID JSON. No prefixes or markdown formatting.
"""

def get_coordinates(location_str):
    """Resolve location string to Lat/Lng via Google Maps Geocoding API."""
    if not maps_client or not location_str:
        return {"lat": 13.0827, "lng": 80.2707} # Default to Chennai
    
    try:
        geocode_result = maps_client.geocode(location_str + ", India")
        if geocode_result:
            loc = geocode_result[0]['geometry']['location']
            return {"lat": loc['lat'], "lng": loc['lng']}
    except Exception as e:
        logger.error(f"Geocoding error for '{location_str}': {e}")
    
    return {"lat": 13.0827, "lng": 80.2707}

@functions_framework.cloud_event
def handle_aid_ingestion(cloud_event):
    """
    Entry point for GCS Object Finalized events.
    Functions as a specialized NLP engine for multimodal intake.
    """
    data = cloud_event.data
    bucket_name = data["bucket"]
    file_name = data["name"]
    mime_type = data.get("contentType", "application/octet-stream")
    
    gcs_uri = f"gs://{bucket_name}/{file_name}"
    logger.info(f"Specialized NLP Processing: {gcs_uri} (MIME: {mime_type})")

    try:
        # 1. Initialize Gemini 1.5 Flash
        model = GenerativeModel("gemini-1.5-flash-001")
        
        # 2. Prepare Multimodal Part
        file_part = Part.from_uri(uri=gcs_uri, mime_type=mime_type)
        
        # 3. Execution with optimized config
        generation_config = GenerationConfig(
            temperature=0.0, # Zero temperature for precision extraction
            top_p=0.95,
            response_mime_type="application/json"
        )
        
        response = model.generate_content(
            [SYSTEM_PROMPT, file_part],
            generation_config=generation_config
        )
        
        # 4. Parse & Sanitize
        extraction_data = json.loads(response.text)
        logger.info(f"NLP Extraction Successful for {file_name}")

        # 5. Geocoding Enrichment
        coords = get_coordinates(extraction_data.get("location"))
        
        # Structure for Firestore `aid_requests` collection
        final_payload = {
            **extraction_data,
            "coordinates": coords,
            "source_file": gcs_uri,
            "processed_at": datetime.utcnow().isoformat(),
            "status": "pending",
            "extractedData": { # Alias for dashboard compatibility
                "item": extraction_data.get("item"),
                "quantity": extraction_data.get("quantity"),
                "urgency": extraction_data.get("urgency_level"),
                "location": extraction_data.get("location"),
                "lat": coords["lat"],
                "lng": coords["lng"]
            }
        }
        
        # 6. Persistence
        doc_ref = db.collection("aid_requests").document()
        doc_ref.set(final_payload)
        
        logger.info(f"Resource Indexing Complete: {doc_ref.id}")
        
        return "Indexed", 200

    except Exception as e:
        logger.error(f"NLP Engine Failure for {file_name}: {e}")
        return "Internal Error", 500
