import io
import json
import random
from PIL import Image
from typing import Dict, Any, Optional
from app.config import settings

# Attempt import of Google Gen AI SDK
try:
    from google import genai
    from google.genai import types
    GEMINI_AVAILABLE = True
except ImportError:
    GEMINI_AVAILABLE = False

class GeminiService:
    def __init__(self):
        self.is_configured = False
        self.client = None
        if not GEMINI_AVAILABLE:
            print("WARNING: google-genai package not found. Running Gemini in MOCK mode.")
            return
            
        if settings.GEMINI_API_KEY:
            try:
                self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
                self.is_configured = True
                print("Gemini API Client configured successfully.")
            except Exception as e:
                print(f"WARNING: Failed to configure Gemini API client: {e}")
        else:
            print("WARNING: GEMINI_API_KEY is not defined. Running Gemini in MOCK mode.")

    def analyze_waste_image(self, image_bytes: bytes) -> Dict[str, Any]:
        """
        Sends an uploaded waste image to the Gemini Vision API for classification.
        
        Returns:
            Dict: Keys include is_waste, waste_type, severity, confidence, and description.
        """
        if not self.is_configured:
            return self._generate_mock_analysis(image_bytes)
            
        try:
            # Read image bytes using Pillow
            image = Image.open(io.BytesIO(image_bytes))
            
            prompt = """
            You are a Smart Waste Management Classifier for Hyderabad Municipality.
            Analyze the provided image and extract classification information.
            
            Return a JSON object containing the following keys (do not wrap in markdown or any other tags other than valid JSON):
            {
              "is_waste": boolean, // True if garbage/trash/litter/waste/dump is present, False if it's a clean scene
              "waste_type": string, // Classify into one of: "Overflowing Garbage Bin", "Illegal Dumping", "Plastic Waste", "Construction Waste", "E-Waste", or "Other"
              "severity": string, // "Low" (scattered minor litter), "Medium" (small piles/full trash can), "High" (major illegal dumping, blocked pathways, hazardous accumulation)
              "confidence": float, // Float estimation between 0.0 and 1.0 representing classification confidence
              "description": string // Brief summary describing the image contents (max 2 sentences, e.g. "Overflowing blue bin with plastic bottles and dry waste")
            }
            """
            
            # Request structured JSON format from the model using the client
            response = self.client.models.generate_content(
                model='gemini-1.5-flash',
                contents=[prompt, image],
                config=types.GenerateContentConfig(
                    response_mime_type="application/json"
                )
            )
            
            result_text = response.text.strip()
            
            # Clean up potential markdown formatting blocks
            if result_text.startswith("```json"):
                result_text = result_text[7:]
            if result_text.endswith("```"):
                result_text = result_text[:-3]
            result_text = result_text.strip()
            
            parsed_result = json.loads(result_text)
            
            # Map parameters and apply standard fallbacks if any fields are missing
            return {
                "is_waste": parsed_result.get("is_waste", True),
                "waste_type": parsed_result.get("waste_type", "Other"),
                "severity": parsed_result.get("severity", "Medium"),
                "confidence": parsed_result.get("confidence", 0.85),
                "description": parsed_result.get("description", "Public waste accumulation detected.")
            }
            
        except Exception as e:
            print(f"Error executing Gemini API call: {e}. Defaulting to mock analysis.")
            return self._generate_mock_analysis(image_bytes)
 
    def _generate_mock_analysis(self, image_bytes: Optional[bytes] = None) -> Dict[str, Any]:
        """Generates realistic waste mock analysis for local offline testing."""
        import hashlib
        
        # Create a local random generator and seed it with the MD5 hash of image bytes
        r = random.Random()
        if image_bytes:
            hasher = hashlib.md5(image_bytes)
            seed = int(hasher.hexdigest(), 16)
            r.seed(seed)
            
        waste_types = ["Overflowing Garbage Bin", "Illegal Dumping", "Plastic Waste", "Construction Waste", "E-Waste", "Other"]
        severities = ["Low", "Medium", "High"]
        descriptions = [
            "A public garbage container overflowing with plastic wrappers and household refuse.",
            "Large heaps of mixed garbage bags dumped illegally on open ground.",
            "Discarded plastic bottles, bags, and packaging containers lining the curb.",
            "Debris from concrete blocks, bricks, and tiles obstructing the road shoulder.",
            "Old electronic wires, batteries, and keyboard parts discarded by the utility pole."
        ]
        
        selected_type = r.choice(waste_types)
        selected_sev = r.choice(severities)
        selected_desc = r.choice(descriptions)
        
        return {
            "is_waste": True,
            "waste_type": selected_type,
            "severity": selected_sev,
            "confidence": round(r.uniform(0.80, 0.96), 2),
            "description": f"[Mock AI] {selected_desc}"
        }
 
# Singleton instance
gemini_service = GeminiService()
