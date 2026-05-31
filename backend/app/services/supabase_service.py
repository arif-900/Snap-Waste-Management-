import os
import uuid
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from app.config import settings

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

class SupabaseService:
    def __init__(self):
        self.url = settings.SUPABASE_URL
        # Prioritize service role key for backend admin operations to bypass RLS, fallback to anon key
        self.key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
        self.client: Optional[Client] = None
        self.is_mock = True
        self.mock_db: Dict[str, Dict[str, Any]] = {}

        if not SUPABASE_AVAILABLE:
            print("WARNING: supabase-py package is not installed. Running in MOCK mode.")
            return

        if not self.url or not self.key:
            print("WARNING: Supabase URL or Key is missing from settings. Running in MOCK mode.")
            return

        try:
            self.client = create_client(self.url, self.key)
            self.is_mock = False
            print("Successfully initialized Supabase Client.")
        except Exception as e:
            print(f"WARNING: Supabase initialization failed. Falling back to MOCK mode. Error: {e}")
            self.is_mock = True

    def upload_image(self, file_bytes: bytes, filename: str, content_type: str) -> str:
        """Uploads image to Supabase Storage bucket 'waste_images'. Falls back to local static directory on failure."""
        if self.is_mock or not self.client:
            return self._save_locally(file_bytes, filename)
        
        try:
            # Generate unique safe path name
            unique_name = f"{uuid.uuid4()}_{filename}"
            
            # Perform upload to storage bucket
            self.client.storage.from_("waste_images").upload(
                path=unique_name,
                file=file_bytes,
                file_options={"content-type": content_type}
            )
            
            # Fetch public static URL
            public_url = self.client.storage.from_("waste_images").get_public_url(unique_name)
            return public_url
        except Exception as e:
            print(f"Error uploading to Supabase Storage: {e}. Saving locally instead.")
            return self._save_locally(file_bytes, filename)

    def _save_locally(self, file_bytes: bytes, filename: str) -> str:
        os.makedirs("static/uploads", exist_ok=True)
        safe_filename = f"{uuid.uuid4()}_{filename}"
        filepath = os.path.join("static/uploads", safe_filename)
        with open(filepath, "wb") as f:
            f.write(file_bytes)
        return f"/static/uploads/{safe_filename}"

    def create_complaint(self, complaint_data: Dict[str, Any]) -> Dict[str, Any]:
        """Creates a new complaint document in the PostgreSQL table."""
        complaint_id = complaint_data["id"]
        
        # Always maintain backup copy in mock db
        self.mock_db[complaint_id] = complaint_data
        
        if self.is_mock or not self.client:
            return complaint_data
            
        try:
            # Insert into Supabase table
            self.client.table("complaints").insert(complaint_data).execute()
            return complaint_data
        except Exception as e:
            print(f"Error creating complaint in Supabase: {e}. Retained in-memory backup.")
            return complaint_data

    def get_complaints(self, status: Optional[str] = None, waste_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves complaints with optional filter parameters."""
        if self.is_mock or not self.client:
            return self._get_mock_complaints(status, waste_type)

        try:
            query = self.client.table("complaints").select("*")
            if status:
                query = query.eq("status", status)
            if waste_type:
                query = query.eq("wasteType", waste_type)
            
            response = query.execute()
            results = response.data or []
            
            # Sort by creation date descending
            results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
            return results
        except Exception as e:
            print(f"Error fetching from Supabase: {e}. Falling back to in-memory store.")
            return self._get_mock_complaints(status, waste_type)

    def _get_mock_complaints(self, status: Optional[str] = None, waste_type: Optional[str] = None) -> List[Dict[str, Any]]:
        results = list(self.mock_db.values())
        if status:
            results = [c for c in results if c["status"].lower() == status.lower()]
        if waste_type:
            results = [c for c in results if c["wasteType"].lower() == waste_type.lower()]
        results.sort(key=lambda x: x.get("createdAt", ""), reverse=True)
        return results

    def get_complaint_by_id(self, complaint_id: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single complaint by ID."""
        if self.is_mock or not self.client:
            return self.mock_db.get(complaint_id)
            
        try:
            response = self.client.table("complaints").select("*").eq("id", complaint_id).execute()
            results = response.data or []
            if results:
                return results[0]
            return self.mock_db.get(complaint_id)
        except Exception as e:
            print(f"Error fetching complaint from Supabase: {e}. Trying in-memory backup.")
            return self.mock_db.get(complaint_id)

    def update_complaint_status(self, complaint_id: str, new_status: str) -> Optional[Dict[str, Any]]:
        """Updates the status of a complaint and sets updatedAt timestamp."""
        now_iso = datetime.utcnow().isoformat() + "Z"
        
        # Keep mock db updated
        if complaint_id in self.mock_db:
            self.mock_db[complaint_id]["status"] = new_status
            self.mock_db[complaint_id]["updatedAt"] = now_iso
            
        if self.is_mock or not self.client:
            return self.mock_db.get(complaint_id)
            
        try:
            response = self.client.table("complaints").update({
                "status": new_status,
                "updatedAt": now_iso
            }).eq("id", complaint_id).execute()
            results = response.data or []
            if results:
                return results[0]
            elif complaint_id in self.mock_db:
                return self.mock_db[complaint_id]
            return None
        except Exception as e:
            print(f"Error updating in Supabase: {e}. Updating in-memory only.")
            return self.mock_db.get(complaint_id)

    def update_complaint(self, complaint_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Updates arbitrary fields of a complaint and sets updatedAt timestamp."""
        now_iso = datetime.utcnow().isoformat() + "Z"
        update_data["updatedAt"] = now_iso
        
        # Keep mock db updated
        if complaint_id in self.mock_db:
            for k, v in update_data.items():
                self.mock_db[complaint_id][k] = v
            
        if self.is_mock or not self.client:
            return self.mock_db.get(complaint_id)
            
        try:
            response = self.client.table("complaints").update(update_data).eq("id", complaint_id).execute()
            results = response.data or []
            if results:
                return results[0]
            elif complaint_id in self.mock_db:
                return self.mock_db[complaint_id]
            return None
        except Exception as e:
            print(f"Error updating in Supabase: {e}. Updated in-memory only.")
            return self.mock_db.get(complaint_id)

    def delete_complaint(self, complaint_id: str) -> bool:
        """Deletes a complaint by ID."""
        deleted = False
        if complaint_id in self.mock_db:
            del self.mock_db[complaint_id]
            deleted = True
            
        if self.is_mock or not self.client:
            return deleted
            
        try:
            self.client.table("complaints").delete().eq("id", complaint_id).execute()
            deleted = True
            return deleted
        except Exception as e:
            print(f"Error deleting from Supabase: {e}.")
            return deleted

    def get_analytics_summary(self) -> Dict[str, Any]:
        """Computes summarized counts for the analytics dashboard."""
        complaints = self.get_complaints()
        
        summary = {
            "total": len(complaints),
            "pending": 0,
            "in_progress": 0,
            "resolved": 0,
            "types": {},
            "severity": {
                "Low": 0,
                "Medium": 0,
                "High": 0
            }
        }
        
        for c in complaints:
            # Status counter
            status = c.get("status", "Pending").lower()
            if status == "pending":
                summary["pending"] += 1
            elif status in ["in progress", "in_progress"]:
                summary["in_progress"] += 1
            elif status == "resolved":
                summary["resolved"] += 1
                
            # Waste Type counter
            w_type = c.get("wasteType", "Unknown")
            summary["types"][w_type] = summary["types"].get(w_type, 0) + 1
            
            # Severity counter
            ai = c.get("aiAnalysis", {})
            sev = ai.get("severity", "Medium")
            if sev in summary["severity"]:
                summary["severity"][sev] += 1
                
        return summary

    def get_hotspots(self) -> List[Dict[str, Any]]:
        """Groups complaints by proximity (3 decimal places of latitude/longitude)."""
        complaints = self.get_complaints()
        clusters: Dict[tuple, Dict[str, Any]] = {}
        
        for c in complaints:
            loc = c.get("location", {})
            lat = loc.get("latitude")
            lng = loc.get("longitude")
            if lat is None or lng is None:
                continue
                
            # Round coordinates to ~110m grid
            grid_key = (round(lat, 3), round(lng, 3))
            
            ai = c.get("aiAnalysis", {})
            severity = ai.get("severity", "Medium")
            
            if grid_key not in clusters:
                clusters[grid_key] = {
                    "latitude": lat,
                    "longitude": lng,
                    "count": 1,
                    "severities": {severity: 1}
                }
            else:
                clusters[grid_key]["count"] += 1
                clusters[grid_key]["severities"][severity] = clusters[grid_key]["severities"].get(severity, 0) + 1
                
        results = []
        for key, data in clusters.items():
            sevs = data["severities"]
            dominant_severity = max(sevs, key=sevs.get)
            
            results.append({
                "latitude": data["latitude"],
                "longitude": data["longitude"],
                "count": data["count"],
                "severity": dominant_severity
            })
            
        return results

supabase_service = SupabaseService()


