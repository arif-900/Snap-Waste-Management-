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
        self.key = settings.SUPABASE_SERVICE_KEY or settings.SUPABASE_ANON_KEY
        self.client: Optional[Client] = None
        self.is_mock = True
        self.mock_file_path = "compliance_db.json"
        self.mock_db: Dict[str, Dict[str, Any]] = {}
        
        # Load local database if available
        self._load_local_db()

        if not SUPABASE_AVAILABLE:
            print("WARNING: supabase-py package is not installed. Running in MOCK mode.")
            return

        if not self.url or not self.key:
            print("WARNING: Supabase URL or Key is missing from settings. Running in MOCK mode with compliance_db.json.")
            return

        try:
            self.client = create_client(self.url, self.key)
            self.is_mock = False
            print("Successfully initialized Supabase Client for GitLab Compliance Checker.")
        except Exception as e:
            print(f"WARNING: Supabase initialization failed. Falling back to MOCK mode with local file. Error: {e}")
            self.is_mock = True

    def _load_local_db(self):
        """Loads in-memory database from compliance_db.json to ensure persistence during mock development."""
        if os.path.exists(self.mock_file_path):
            try:
                with open(self.mock_file_path, "r", encoding="utf-8") as f:
                    self.mock_db = json.load(f)
                print(f"Loaded {len(self.mock_db)} records from local database file '{self.mock_file_path}'")
            except Exception as e:
                print(f"Error loading {self.mock_file_path}: {e}")
                self.mock_db = {}
        else:
            self.mock_db = {}

    def _save_local_db(self):
        """Saves current in-memory database state to compliance_db.json."""
        try:
            with open(self.mock_file_path, "w", encoding="utf-8") as f:
                json.dump(self.mock_db, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving to {self.mock_file_path}: {e}")

    def create_report(self, report_data: Dict[str, Any]) -> Dict[str, Any]:
        """Saves a new compliance report in Supabase or the local persistent file."""
        report_id = report_data["id"]
        
        # Save in mock memory + persist file
        self.mock_db[report_id] = report_data
        self._save_local_db()
        
        if self.is_mock or not self.client:
            return report_data
            
        try:
            # Insert into Supabase 'compliance_reports' table
            self.client.table("compliance_reports").insert(report_data).execute()
            return report_data
        except Exception as e:
            print(f"Error creating report in Supabase: {e}. Retained in local database file.")
            return report_data

    def get_reports(self, project_url: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieves scan reports, optionally filtered by project_url."""
        if self.is_mock or not self.client:
            return self._get_mock_reports(project_url)

        try:
            query = self.client.table("compliance_reports").select("*")
            if project_url:
                query = query.eq("project_url", project_url)
            
            response = query.execute()
            results = response.data or []
            # Sort by creation date descending
            results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
            return results
        except Exception as e:
            print(f"Error fetching reports from Supabase: {e}. Falling back to local data.")
            return self._get_mock_reports(project_url)

    def _get_mock_reports(self, project_url: Optional[str] = None) -> List[Dict[str, Any]]:
        results = list(self.mock_db.values())
        if project_url:
            results = [r for r in results if r.get("project_url", "").lower() == project_url.lower()]
        results.sort(key=lambda x: x.get("created_at", ""), reverse=True)
        return results

    def get_report_by_id(self, report_id: str) -> Optional[Dict[str, Any]]:
        """Gets details of a single scan report by ID."""
        if self.is_mock or not self.client:
            return self.mock_db.get(report_id)
            
        try:
            response = self.client.table("compliance_reports").select("*").eq("id", report_id).execute()
            results = response.data or []
            if results:
                return results[0]
            return self.mock_db.get(report_id)
        except Exception as e:
            print(f"Error fetching report from Supabase: {e}. Checking local database.")
            return self.mock_db.get(report_id)

    def get_project_history(self, project_url: str) -> List[Dict[str, Any]]:
        """Retrieves compliance check history sorted chronologically ascending for trends."""
        reports = self.get_reports(project_url=project_url)
        # Sort ascending for time series trends
        reports.sort(key=lambda x: x.get("created_at", ""))
        return reports

    def get_latest_project_reports(self) -> List[Dict[str, Any]]:
        """Returns only the single latest report for each unique project URL (latest status)."""
        reports = self.get_reports()
        
        latest_map = {}
        for r in reports:
            p_url = r.get("project_url")
            c_at = r.get("created_at", "")
            if p_url not in latest_map or c_at > latest_map[p_url].get("created_at", ""):
                latest_map[p_url] = r
                
        return list(latest_map.values())

    def delete_report(self, report_id: str) -> bool:
        """Deletes a report by ID."""
        deleted = False
        if report_id in self.mock_db:
            del self.mock_db[report_id]
            self._save_local_db()
            deleted = True
            
        if self.is_mock or not self.client:
            return deleted
            
        try:
            self.client.table("compliance_reports").delete().eq("id", report_id).execute()
            deleted = True
            return deleted
        except Exception as e:
            print(f"Error deleting report from Supabase: {e}")
            return deleted

supabase_service = SupabaseService()
