import os
import math
import uuid
from datetime import datetime
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Path, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from typing import List, Optional, Dict, Any

from app.config import settings
from app.schemas.models import (
    ComplaintResponse,
    StatusUpdate,
    AnalyticsSummaryResponse,
    HotspotResponse,
    ImageAnalysisResponse
)
from app.services.supabase_service import supabase_service
from app.services.gemini_service import gemini_service
from app.services.yolo_service import yolo_service
from app.services.image_hash import calculate_dhash, calculate_hamming_distance

app = FastAPI(
    title="Smart Waste Management System API",
    description="Backend services for reporting and monitoring public waste in Hyderabad, powered by Gemini AI and Supabase.",
    version="1.0.0",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redirect_slashes=False
)

# CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Set to specific origins in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class APIPrefixMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http":
            path = scope.get("path", "")
            if path.startswith("/v1") or path.startswith("/docs") or path.startswith("/openapi.json"):
                new_path = "/api" + path
                scope["path"] = new_path
                if "raw_path" in scope:
                    scope["raw_path"] = new_path.encode("ascii")
        await self.app(scope, receive, send)

app.add_middleware(APIPrefixMiddleware)


# Ensure folders exist for local upload testing
try:
    os.makedirs("static/uploads", exist_ok=True)
except Exception as e:
    print(f"Could not create static/uploads directory: {e}")

app.mount("/static", StaticFiles(directory="static"), name="static")

# On Vercel, mount /tmp for serving mock local uploads
if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
    app.mount("/tmp", StaticFiles(directory="/tmp"), name="tmp_static")

def resolve_hyderabad_address(lat: float, lng: float) -> str:
    """Helper to convert coordinates to high-fidelity Hyderabad locations for the demo."""
    # Hyderabad range: Latitude (~17.34 to 17.55), Longitude (~78.30 to 78.55)
    if 17.42 <= lat <= 17.48 and 78.35 <= lng <= 78.40:
        return "Madhapur Rd, Jubilee Hills, Hyderabad, Telangana 500033"
    elif 17.40 <= lat <= 17.45 and 78.42 <= lng <= 78.47:
        return "Banjara Hills Rd, Hyderabad, Telangana 500034"
    elif 17.35 <= lat <= 17.38 and 78.45 <= lng <= 78.49:
        return "Charminar Rd, Ghansi Bazaar, Hyderabad, Telangana 500002"
    elif 17.40 <= lat <= 17.45 and 78.30 <= lng <= 78.35:
        return "ISB Road, Financial District, Gachibowli, Hyderabad, Telangana 500032"
    elif 17.48 <= lat <= 17.55 and 78.38 <= lng <= 78.45:
        return "KHB Colony Road, Kukatpally, Hyderabad, Telangana 500072"
    else:
        # Fallback dynamic ward generation
        ward_num = int(abs(lat * 100)) % 150 + 1
        return f"GHMC Ward {ward_num}, Secunderabad Area, Hyderabad, Telangana"

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates Haversine distance in meters between two geocoordinates."""
    R = 6371000  # Radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi / 2) ** 2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def check_duplicate_complaint(
    lat1: float,
    lon1: float,
    waste_type: str,
    image_hash: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """
    Checks if there's an existing active report of the same type within 50 meters,
    OR if the same photo (via perceptual image hash similarity <= 10 Hamming distance)
    is uploaded within 100 meters of an active report.
    """
    try:
        complaints = supabase_service.get_complaints()
        for c in complaints:
            if c.get("status") in ["Pending", "In Progress"]:
                loc = c.get("location", {})
                lat2 = loc.get("latitude")
                lon2 = loc.get("longitude")
                if lat2 is not None and lon2 is not None:
                    distance = calculate_distance(lat1, lon1, lat2, lon2)
                    
                    # 1. Image Similarity Check (dHash) within 100m
                    existing_hash = c.get("imageHash")
                    if image_hash and existing_hash and distance <= 100.0:
                        hamming_dist = calculate_hamming_distance(image_hash, existing_hash)
                        if hamming_dist <= 10:  # <= 10 bits difference means highly similar (>84% match)
                            print(f"Perceptual duplicate detected via dHash! Hamming dist: {hamming_dist}")
                            return c
                    
                    # 2. Standard Proximity + Classification Check within 50m
                    if c.get("wasteType") == waste_type and distance <= 50.0:
                        return c
    except Exception as e:
        print(f"Error checking duplicate complaints: {e}")
    return None

# --- Error Handlers ---

@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"success": False, "detail": exc.detail}
    )

@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"success": False, "detail": f"Internal Server Error: {str(exc)}"}
    )

# --- Endpoints ---

@app.get("/api/v1/status")
@app.get("/api/v1/status/")
def get_status():
    """Server status check endpoint."""
    ai_status = "Unknown"
    if settings.AI_PROVIDER == "yolo":
        ai_status = f"YOLOv8 Local Model ({settings.YOLO_MODEL_PATH})"
    elif settings.AI_PROVIDER == "gemini":
        ai_status = "Mock (Static classifier fallback)" if not gemini_service.is_configured else "Live (Gemini API Active)"
        
    return {
        "status": "online",
        "service": "Smart Waste Monitoring System API",
        "docs": "/docs",
        "database": "Mock (In-Memory fallback)" if supabase_service.is_mock else "Live (Supabase PostgreSQL)",
        "active_ai_provider": settings.AI_PROVIDER,
        "ai_status": ai_status
    }

@app.post(
    "/api/v1/complaints/analyze",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_200_OK,
    summary="Analyze waste image without saving",
    description="Processes uploaded image, runs YOLO or Gemini classification, and checks for proximity duplicates without writing records to DB or Cloud Storage."
)
@app.post(
    "/api/v1/complaints/analyze/",
    response_model=ImageAnalysisResponse,
    status_code=status.HTTP_200_OK,
    include_in_schema=False
)
async def analyze_complaint_image(
    image: UploadFile = File(..., description="Waste image file to analyze"),
    latitude: float = Form(..., description="GPS Latitude"),
    longitude: float = Form(..., description="GPS Longitude")
):
    # Validate file type
    extension = os.path.splitext(image.filename)[1].lower()
    if extension not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Please upload a JPG, JPEG, PNG, or WEBP image."
        )

    try:
        # Read file contents
        image_bytes = await image.read()
        
        # Calculate image perceptual dHash
        img_hash = calculate_dhash(image_bytes)
        
        # Analyze with active AI model
        if settings.AI_PROVIDER == "yolo":
            ai_analysis = yolo_service.analyze_waste_image(image_bytes)
        else:
            ai_analysis = gemini_service.analyze_waste_image(image_bytes)
            
        # Check for duplication within 50m, or identical image within 100m
        duplicate = check_duplicate_complaint(latitude, longitude, ai_analysis["waste_type"], img_hash)
        is_duplicate = duplicate is not None
        duplicate_id = duplicate["id"] if duplicate else None
            
        return {
            "wasteType": ai_analysis["waste_type"],
            "aiAnalysis": {
                "severity": ai_analysis["severity"],
                "confidence": ai_analysis["confidence"],
                "description": ai_analysis["description"],
                "is_waste": ai_analysis["is_waste"]
            },
            "is_duplicate": is_duplicate,
            "duplicate_id": duplicate_id,
            "show_bypass": ai_analysis.get("show_bypass", True)
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred during AI image analysis: {str(e)}"
        )

@app.post(
    "/api/v1/complaints/report",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Submit citizen report",
    description="Processes uploaded image, executes Gemini classification, uploads image, and stores the resulting complaint in the database."
)
@app.post(
    "/api/v1/complaints/report/",
    response_model=ComplaintResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False
)
async def submit_complaint(
    image: UploadFile = File(..., description="Waste image file upload"),
    latitude: float = Form(..., description="GPS Latitude"),
    longitude: float = Form(..., description="GPS Longitude"),
    phone: str = Form(..., description="Reporter mobile number"),
    notes: Optional[str] = Form(None, description="Optional citizen notes")
):
    # Validate file type
    extension = os.path.splitext(image.filename)[1].lower()
    if extension not in [".jpg", ".jpeg", ".png", ".webp"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Unsupported image type. Please upload a JPG, JPEG, PNG, or WEBP image."
        )

    try:
        # Read file contents
        image_bytes = await image.read()
        
        # Compute image perceptual dHash
        img_hash = calculate_dhash(image_bytes)
        
        # 1. Analyze with configured AI model (Gemini or YOLO)
        if settings.AI_PROVIDER == "yolo":
            ai_analysis = yolo_service.analyze_waste_image(image_bytes)
        else:
            ai_analysis = gemini_service.analyze_waste_image(image_bytes)
            
        # 1b. Double-check duplicate safeguard in backend
        duplicate = check_duplicate_complaint(latitude, longitude, ai_analysis["waste_type"], img_hash)
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Duplicate complaint detected. A similar active report (ID: {duplicate['id']}) exists in this area."
            )
        
        # 2. Upload photo (handles Firestore bucket or mock static uploads)
        image_url = supabase_service.upload_image(
            file_bytes=image_bytes,
            filename=image.filename,
            content_type=image.content_type
        )
        
        # 3. Compile report metadata
        complaint_id = f"complaint_{uuid.uuid4().hex[:10]}"
        now_iso = datetime.utcnow().isoformat() + "Z"
        resolved_address = resolve_hyderabad_address(latitude, longitude)
        
        complaint_data = {
            "id": complaint_id,
            "imageUrl": image_url,
            "location": {
                "latitude": latitude,
                "longitude": longitude
            },
            "address": resolved_address,
            "wasteType": ai_analysis["waste_type"],
            "aiAnalysis": {
                "severity": ai_analysis["severity"],
                "confidence": ai_analysis["confidence"],
                "description": ai_analysis["description"],
                "is_waste": ai_analysis["is_waste"]
            },
            "status": "Pending",
            "reporterPhone": phone,
            "reporterNotes": notes,
            "reportCount": 1,
            "additionalReporters": [],
            "imageHash": img_hash,
            "createdAt": now_iso,
            "updatedAt": now_iso
        }
        
        # 4. Save to Firestore / DB
        result = supabase_service.create_complaint(complaint_data)
        return result

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while creating the report: {str(e)}"
        )

@app.get(
    "/api/v1/complaints",
    response_model=List[ComplaintResponse],
    summary="Get all complaints",
    description="Retrieve all complaints with optional filtering by status or waste type category."
)
def get_all_complaints(
    status: Optional[str] = Query(None, description="Filter by status (Pending, In Progress, Resolved)"),
    waste_type: Optional[str] = Query(None, description="Filter by waste type category")
):
    return supabase_service.get_complaints(status=status, waste_type=waste_type)

@app.get(
    "/api/v1/complaints/{id}",
    response_model=ComplaintResponse,
    summary="Get complaint by ID",
    description="Retrieve full details for a single reported complaint."
)
def get_complaint_by_id(
    id: str = Path(..., description="Complaint Unique ID")
):
    complaint = supabase_service.get_complaint_by_id(id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID '{id}' was not found."
        )
    return complaint

@app.patch(
    "/api/v1/complaints/{id}/status",
    response_model=ComplaintResponse,
    summary="Update complaint status",
    description="Modifies the resolution status of a complaint. Accepted values: 'Pending', 'In Progress', 'Resolved'."
)
def update_complaint_status(
    id: str = Path(..., description="Complaint Unique ID"),
    status_update: StatusUpdate = None
):
    if not status_update:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Request body containing status field is required."
        )

    valid_statuses = ["Pending", "In Progress", "Resolved"]
    normalized_status = status_update.status.strip()
    
    # Capitalize for schema consistency if user sends lowercase
    if normalized_status.lower() == "in progress":
        normalized_status = "In Progress"
    else:
        normalized_status = normalized_status.capitalize()

    if normalized_status not in valid_statuses:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid status value. Must be one of: {', '.join(valid_statuses)}"
        )

    updated_complaint = supabase_service.update_complaint_status(id, normalized_status)
    if not updated_complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID '{id}' was not found."
        )
    return updated_complaint

@app.post(
    "/api/v1/complaints/{id}/upvote",
    response_model=ComplaintResponse,
    summary="Upvote an active complaint",
    description="Increments the report count and adds the reporter's phone to the list. Escalates severity based on report counts."
)
def upvote_complaint(
    id: str = Path(..., description="Complaint Unique ID"),
    phone: str = Form(..., description="Upvoter phone number")
):
    complaint = supabase_service.get_complaint_by_id(id)
    if not complaint:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID '{id}' was not found."
        )
    
    if complaint.get("status") not in ["Pending", "In Progress"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only active complaints (Pending or In Progress) can be upvoted."
        )

    current_reporters = complaint.get("additionalReporters")
    if current_reporters is None:
        current_reporters = []
    
    primary_phone = complaint.get("reporterPhone")
    
    clean_phone = phone.strip().replace(" ", "")
    clean_primary = primary_phone.strip().replace(" ", "") if primary_phone else ""
    clean_additional = [p.strip().replace(" ", "") for p in current_reporters]
    
    if clean_phone == clean_primary or clean_phone in clean_additional:
        return complaint
        
    current_reporters.append(phone.strip())
    new_count = complaint.get("reportCount", 1) + 1
    
    update_data = {
        "reportCount": new_count,
        "additionalReporters": current_reporters
    }
    
    ai_analysis = complaint.get("aiAnalysis", {})
    current_severity = ai_analysis.get("severity", "Low")
    
    new_severity = current_severity
    if new_count >= 5:
        new_severity = "Critical"
    elif new_count >= 3:
        if current_severity not in ["High", "Critical"]:
            new_severity = "High"
            
    if new_severity != current_severity:
        ai_analysis["severity"] = new_severity
        update_data["aiAnalysis"] = ai_analysis

    updated = supabase_service.update_complaint(id, update_data)
    if not updated:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update complaint upvote metrics."
        )
    return updated

@app.delete(
    "/api/v1/complaints/{id}",
    status_code=status.HTTP_200_OK,
    summary="Delete complaint",
    description="Permanently removes a complaint record from the database."
)
def delete_complaint(
    id: str = Path(..., description="Complaint Unique ID")
):
    success = supabase_service.delete_complaint(id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Complaint with ID '{id}' was not found."
        )
    return {
        "success": True,
        "message": f"Complaint with ID '{id}' has been deleted successfully."
    }

@app.get(
    "/api/v1/analytics/summary",
    response_model=AnalyticsSummaryResponse,
    summary="Get analytics summary",
    description="Fetch aggregated statistics on total, pending, in-progress, resolved, and waste distribution."
)
def get_analytics_summary():
    return supabase_service.get_analytics_summary()

@app.get(
    "/api/v1/analytics/hotspots",
    response_model=List[HotspotResponse],
    summary="Get hotspots coordinates",
    description="Group complaints by physical proximity (approx. 100 meters) to locate waste concentration areas."
)
def get_analytics_hotspots():
    return supabase_service.get_hotspots()

# --- Serve Frontend build in Production / Single-Server Mode ---
# Resolves path to frontend/dist
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
frontend_assets_dir = os.path.join(frontend_dist_dir, "assets")

# Mount assets directory if it exists
if os.path.exists(frontend_assets_dir):
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="assets")

@app.get("/{catchall:path}")
def serve_frontend(catchall: str):
    # Try serving specific file from frontend/dist (e.g. favicon.ico, logo.png)
    if catchall:
        file_path = os.path.join(frontend_dist_dir, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
    # Default fallback to index.html to support React Router client-side routing
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
        
    return {
        "message": "Welcome to the Smart Waste Management API.",
        "frontend_status": "Vite production build not found. Run 'npm run build' in the frontend folder to serve the UI on this port."
    }
