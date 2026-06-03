import os
import uuid
import json
import asyncio
from datetime import datetime
from fastapi import FastAPI, APIRouter, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List, Optional, Dict, Any

from app.config import settings
from app.schemas.models import (
    ComplianceAnalysisRequest,
    BatchAnalysisRequest,
    ComplianceReportResponse,
    ProjectHistoryResponse,
    TeamComparisonResponse,
    ComparisonItem,
    TrendPoint
)
from app.services.gitlab_service import gitlab_service
from app.services.compliance_checker import compliance_checker
from app.services.gemini_suggestions import gemini_suggestions
from app.services.supabase_service import supabase_service

app = FastAPI(
    title="GitLab Compliance Checker API",
    description="Backend service for analyzing GitLab repositories and generating custom compliance audits using Gemini AI.",
    version="1.0.0",
    docs_url="/docs",
    openapi_url="/openapi.json",
    redirect_slashes=False
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_router = APIRouter()

@api_router.get("/status")
def get_status():
    """Verify server status and external dependency state."""
    return {
        "status": "online",
        "service": "GitLab Compliance Checker API",
        "database": "Local JSON File Fallback" if supabase_service.is_mock else "Live Supabase PostgreSQL",
        "ai_suggestions": "Mock Offline Fallback" if not settings.GEMINI_API_KEY else "Active Live Gemini API"
    }

@api_router.get("/compliance/stream")
def stream_compliance_analysis(
    project_url: str = Query(..., description="GitLab repository URL or Project ID"),
    branch: Optional[str] = Query(None, description="Repository branch name"),
    pat: Optional[str] = Query(None, description="GitLab Personal Access Token")
):
    """
    Streams analysis log steps in real-time via Server-Sent Events (SSE).
    At the final step, it returns the generated ComplianceReportResponse model inside the stream.
    """
    async def log_generator():
        logs = []
        
        def add_log(msg: str):
            timestamp = datetime.utcnow().strftime("%H:%M:%S")
            logs.append({"timestamp": timestamp, "message": msg})
            # Format as Server-Sent Event
            return f"data: {json.dumps({'log': msg, 'timestamp': timestamp, 'percentage': len(logs) * 8})}\n\n"

        try:
            # Step 1: Parse input
            yield add_log(f"Extracting GitLab identifier from: {project_url}")
            project_path_or_id = gitlab_service.extract_project_path_or_id(project_url)
            await asyncio.sleep(0.2)
            
            # Step 2: Fetch project details
            yield add_log(f"Connecting to GitLab API to fetch metadata for project '{project_path_or_id}'...")
            try:
                project_info = gitlab_service.get_project_details(project_path_or_id, pat)
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)})}\n\n"
                return
            await asyncio.sleep(0.2)
            
            # Step 3: Resolve branch
            resolved_branch = branch or project_info.get("default_branch") or "main"
            yield add_log(f"Resolving analysis branch. Selected: '{resolved_branch}'")
            await asyncio.sleep(0.1)

            # Step 4: Fetch branches list
            yield add_log("Retrieving repository branch list...")
            branches = gitlab_service.get_project_branches(project_path_or_id, pat)
            if branches and resolved_branch not in branches:
                yield f"data: {json.dumps({'error': f'Branch {resolved_branch} not found in repository. Available: {branches}'})}\n\n"
                return
            await asyncio.sleep(0.1)

            # Step 5: Fetch releases & tags
            yield add_log("Querying repository releases and tags...")
            releases = gitlab_service.get_project_releases(project_path_or_id, pat)
            tags = gitlab_service.get_project_tags(project_path_or_id, pat)
            await asyncio.sleep(0.1)
            
            # Step 6: Fetch repository tree
            yield add_log(f"Fetching recursive file tree for branch '{resolved_branch}' (this may take a few seconds)...")
            try:
                tree_files = gitlab_service.get_repository_tree(project_path_or_id, resolved_branch, pat)
            except Exception as e:
                yield f"data: {json.dumps({'error': f'Failed to retrieve repository tree: {str(e)}'})}\n\n"
                return
            yield add_log(f"Loaded {len(tree_files)} objects from repository.")
            await asyncio.sleep(0.2)

            # Step 7: Run checkers
            yield add_log("Running compliance rules parser...")
            
            # Helper file content fetcher
            def fetch_content(path: str) -> Optional[str]:
                return gitlab_service.get_file_content(project_path_or_id, path, resolved_branch, pat)
                
            report_result = compliance_checker.run_check(
                project_info=project_info,
                releases=releases,
                tags=tags,
                tree_files=tree_files,
                fetch_file_content_fn=fetch_content,
                log_fn=None # We will log locally
            )
            
            yield add_log("Checks evaluated successfully.")
            await asyncio.sleep(0.1)
            
            # Step 8: Generate AI recommendations
            yield add_log("Consulting Gemini AI suggestions engine for custom stubs and fixes...")
            suggestions_md = gemini_suggestions.generate_suggestions(
                project_name=project_info.get("name", "Unknown Project"),
                score=report_result["score"],
                risk_level=report_result["risk_level"],
                category_scores=report_result["category_scores"],
                missing_files=report_result["missing_files"],
                details=report_result["details"]
            )
            yield add_log("AI analysis complete.")
            await asyncio.sleep(0.1)
            
            # Step 9: Save report
            yield add_log("Saving compliance report to history database...")
            report_id = f"report_{uuid.uuid4().hex[:10]}"
            now_iso = datetime.utcnow().isoformat() + "Z"
            
            # Match schema fields
            final_report_data = {
                "id": report_id,
                "project_id": str(project_info.get("id")),
                "project_name": project_info.get("name", "Unknown Project"),
                "project_url": project_info.get("web_url", project_url),
                "branch": resolved_branch,
                "score": report_result["score"],
                "risk_level": report_result["risk_level"],
                "metadata_score": report_result["category_scores"]["Metadata"],
                "documentation_score": report_result["category_scores"]["Documentation"],
                "health_score": report_result["category_scores"]["Health"],
                "code_quality_score": report_result["category_scores"]["CodeQuality"],
                "security_score": report_result["category_scores"]["Security"],
                "testing_score": report_result["category_scores"]["Testing"],
                "cicd_score": report_result["category_scores"]["CICD"],
                "spec_kit_score": report_result["category_scores"]["SpecKit"],
                "checks_passed": report_result["checks_passed"],
                "checks_failed": report_result["checks_failed"],
                "checks_total": report_result["checks_total"],
                "details": report_result["details"],
                "missing_files": report_result["missing_files"],
                "suggestions": suggestions_md,
                "analysis_logs": logs,
                "created_at": now_iso
            }
            
            supabase_service.create_report(final_report_data)
            
            # Final Event: return full report response
            yield f"data: {json.dumps({'log': 'Compliance analysis complete!', 'percentage': 100, 'report': final_report_data})}\n\n"
            
        except Exception as ex:
            yield f"data: {json.dumps({'error': f'An unexpected internal error occurred: {str(ex)}'})}\n\n"

    return StreamingResponse(log_generator(), media_type="text/event-stream")

@api_router.get("/compliance/history", response_model=List[ComplianceReportResponse])
def get_all_reports():
    """Retrieve full history of scans."""
    return supabase_service.get_reports()

@api_router.get("/compliance/latest", response_model=List[ComplianceReportResponse])
def get_latest_project_reports():
    """Retrieve single latest status report for each scanned repository."""
    return supabase_service.get_latest_project_reports()

@api_router.get("/compliance/history/project", response_model=ProjectHistoryResponse)
def get_project_history(project_url: str = Query(..., description="GitLab project URL to fetch")):
    """Get scan logs and time-series trends for a single repository."""
    history = supabase_service.get_project_history(project_url)
    if not history:
        raise HTTPException(status_code=404, detail="No compliance history found for this repository.")
        
    trends = [
        TrendPoint(date=r["created_at"], score=r["score"])
        for r in history
    ]
    
    return ProjectHistoryResponse(
        project_url=project_url,
        project_name=history[0]["project_name"],
        history=history,
        trends=trends
    )

@api_router.get("/compliance/comparison", response_model=TeamComparisonResponse)
def get_team_comparison():
    """Get project ranks and side-by-side compliance ratings."""
    latest_reports = supabase_service.get_latest_project_reports()
    
    comparison_items = [
        ComparisonItem(
            project_name=r["project_name"],
            project_url=r["project_url"],
            score=r["score"],
            risk_level=r["risk_level"],
            checks_passed=r["checks_passed"],
            checks_failed=r["checks_failed"],
            created_at=r["created_at"]
        )
        for r in latest_reports
    ]
    
    # Sort by score descending (leaderboard)
    comparison_items.sort(key=lambda x: x.score, reverse=True)
    
    avg_score = sum(item.score for item in comparison_items) / len(comparison_items) if comparison_items else 0.0
    
    return TeamComparisonResponse(
        projects=comparison_items,
        average_score=round(avg_score, 1)
    )

@api_router.post("/compliance/batch", response_model=List[ComplianceReportResponse])
async def analyze_batch(payload: BatchAnalysisRequest):
    """
    Synchronously analyze a batch of project URLs and return the collection of results.
    Useful for CSV audits or instant bulk processing.
    """
    results = []
    for project_url in payload.project_urls:
        try:
            project_path_or_id = gitlab_service.extract_project_path_or_id(project_url)
            project_info = gitlab_service.get_project_details(project_path_or_id, payload.pat)
            resolved_branch = payload.branch or project_info.get("default_branch") or "main"
            
            releases = gitlab_service.get_project_releases(project_path_or_id, payload.pat)
            tags = gitlab_service.get_project_tags(project_path_or_id, payload.pat)
            tree_files = gitlab_service.get_repository_tree(project_path_or_id, resolved_branch, payload.pat)
            
            def fetch_content(path: str) -> Optional[str]:
                return gitlab_service.get_file_content(project_path_or_id, path, resolved_branch, payload.pat)
                
            report_result = compliance_checker.run_check(
                project_info=project_info,
                releases=releases,
                tags=tags,
                tree_files=tree_files,
                fetch_file_content_fn=fetch_content
            )
            
            suggestions_md = gemini_suggestions.generate_suggestions(
                project_name=project_info.get("name", "Unknown Project"),
                score=report_result["score"],
                risk_level=report_result["risk_level"],
                category_scores=report_result["category_scores"],
                missing_files=report_result["missing_files"],
                details=report_result["details"]
            )
            
            report_id = f"report_{uuid.uuid4().hex[:10]}"
            now_iso = datetime.utcnow().isoformat() + "Z"
            
            final_report_data = {
                "id": report_id,
                "project_id": str(project_info.get("id")),
                "project_name": project_info.get("name", "Unknown Project"),
                "project_url": project_info.get("web_url", project_url),
                "branch": resolved_branch,
                "score": report_result["score"],
                "risk_level": report_result["risk_level"],
                "metadata_score": report_result["category_scores"]["Metadata"],
                "documentation_score": report_result["category_scores"]["Documentation"],
                "health_score": report_result["category_scores"]["Health"],
                "code_quality_score": report_result["category_scores"]["CodeQuality"],
                "security_score": report_result["category_scores"]["Security"],
                "testing_score": report_result["category_scores"]["Testing"],
                "cicd_score": report_result["category_scores"]["CICD"],
                "spec_kit_score": report_result["category_scores"]["SpecKit"],
                "checks_passed": report_result["checks_passed"],
                "checks_failed": report_result["checks_failed"],
                "checks_total": report_result["checks_total"],
                "details": report_result["details"],
                "missing_files": report_result["missing_files"],
                "suggestions": suggestions_md,
                "analysis_logs": [{"timestamp": now_iso, "message": "Batch processed scan"}],
                "created_at": now_iso
            }
            
            supabase_service.create_report(final_report_data)
            results.append(final_report_data)
        except Exception as e:
            # If a single repo fails in batch mode, we log and continue
            print(f"Error scanning {project_url} in batch: {e}")
            
    return results

@api_router.delete("/compliance/{id}")
def delete_report(id: str):
    """Delete a report record by ID."""
    success = supabase_service.delete_report(id)
    if not success:
        raise HTTPException(status_code=404, detail="Report ID not found.")
    return {"success": True, "message": f"Compliance report '{id}' deleted successfully."}

app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/v1", include_in_schema=False)

# Serve Frontend build in Production
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
frontend_assets_dir = os.path.join(frontend_dist_dir, "assets")

if os.path.exists(frontend_assets_dir):
    app.mount("/assets", StaticFiles(directory=frontend_assets_dir), name="assets")

@app.get("/{catchall:path}")
def serve_frontend(catchall: str):
    if catchall:
        file_path = os.path.join(frontend_dist_dir, catchall)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
            
    index_file = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_file):
        return FileResponse(index_file)
        
    return {
        "message": "Welcome to the GitLab Compliance Checker API.",
        "frontend_status": "Production build not found. Please build the frontend."
    }
