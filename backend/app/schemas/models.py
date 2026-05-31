from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, List
from datetime import datetime

class Location(BaseModel):
    latitude: float = Field(..., description="Latitude of the waste report")
    longitude: float = Field(..., description="Longitude of the waste report")

class AIAnalysis(BaseModel):
    severity: str = Field(..., description="Severity of the waste (Low, Medium, High)")
    confidence: float = Field(..., description="Confidence score from Gemini Vision API")
    description: str = Field(..., description="Brief description of the waste pile")
    is_waste: bool = Field(True, description="Flag indicating if the image actually contains waste")

class ComplaintResponse(BaseModel):
    id: str = Field(..., description="Unique identifier for the complaint")
    imageUrl: str = Field(..., description="Public download URL of the uploaded image")
    location: Location = Field(..., description="Geocoordinates of the complaint")
    address: Optional[str] = Field(None, description="Human-readable address resolved from coordinates")
    wasteType: str = Field(..., description="Classified waste category (e.g., Organic, Plastic, Mixed)")
    aiAnalysis: AIAnalysis = Field(..., description="Structured analysis metadata from AI")
    status: str = Field("Pending", description="Status of complaint (Pending, In Progress, Resolved)")
    reporterPhone: Optional[str] = Field(None, description="Optional phone number of reporting citizen")
    reporterNotes: Optional[str] = Field(None, description="Citizen comments or context")
    reportCount: int = Field(1, description="Number of times this issue has been reported/upvoted")
    additionalReporters: List[str] = Field(default=[], description="List of phone numbers of additional upvoters")
    imageHash: Optional[str] = Field(None, description="Perceptual difference hash of the waste image")
    createdAt: str = Field(..., description="ISO timestamp of creation")
    updatedAt: str = Field(..., description="ISO timestamp of last update")

class StatusUpdate(BaseModel):
    status: str = Field(..., description="New status for the complaint (Pending, In Progress, Resolved)")

    class Config:
        json_schema_extra = {
            "example": {
                "status": "In Progress"
            }
        }

class AnalyticsSummaryResponse(BaseModel):
    total: int = Field(..., description="Total number of complaints")
    pending: int = Field(..., description="Count of pending complaints")
    in_progress: int = Field(..., description="Count of complaints in progress")
    resolved: int = Field(..., description="Count of resolved complaints")
    types: Dict[str, int] = Field(..., description="Count grouped by waste type")
    severity: Dict[str, int] = Field(..., description="Count grouped by severity level")

class HotspotResponse(BaseModel):
    latitude: float = Field(..., description="Latitude of the cluster center or individual report")
    longitude: float = Field(..., description="Longitude of the cluster center or individual report")
    count: int = Field(..., description="Number of complaints in this vicinity")
    severity: str = Field(..., description="Dominant severity level in this hotspot")

class ImageAnalysisResponse(BaseModel):
    wasteType: str = Field(..., description="Classified waste category (e.g., Organic, Plastic, Mixed)")
    aiAnalysis: AIAnalysis = Field(..., description="Structured analysis metadata from AI")
    is_duplicate: bool = Field(False, description="Flag indicating if a duplicate active report exists")
    duplicate_id: Optional[str] = Field(None, description="The ID of the existing duplicate report")
    show_bypass: bool = Field(True, description="Flag indicating if the user should be allowed to bypass AI validation")
