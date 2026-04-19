import base64
import json
import os
import vertexai
from vertexai.generative_models import GenerativeModel, Part

def verify_distribution_proof(image_bytes, dispatch_instructions):
    """
    Uses Gemini 1.5 Flash to verify if the photo of aid distribution
    matches the dispatch instructions (items and quantities).
    """
    vertexai.init(project="reliefgrid-dev", location="us-central1")
    model = GenerativeModel("gemini-1.5-flash")

    prompt = f"""
    Act as a High-Integrity Forensic Auditor for Disaster Relief.
    Verify if the items and quantities in the provided 'Proof of Delivery' photo match these 'Dispatch Instructions'.

    DISPATCH INSTRUCTIONS:
    {dispatch_instructions}

    RESPONSE SCHEMA (JSON):
    {{
        "verified": boolean,
        "confidence_score": float (0-1),
        "detected_items": [{{ "name": string, "quantity": number }}],
        "mismatch_details": string (if any),
        "audit_note": string
    }}
    """

    image_part = Part.from_data(data=image_bytes, mime_type="image/jpeg")
    
    response = model.generate_content([prompt, image_part])
    
    try:
        # Extract JSON from Markdown wrapper if present
        clean_json = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(clean_json)
    except:
        return {"verified": False, "error": "AI Audit failed to parse image integrity"}
