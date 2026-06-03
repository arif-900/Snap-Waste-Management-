import re
import urllib.parse
import httpx
from typing import List, Dict, Any, Optional

class GitLabService:
    def __init__(self):
        self.base_url = "https://gitlab.com/api/v4"

    def _get_headers(self, pat: Optional[str] = None) -> Dict[str, str]:
        headers = {}
        if pat:
            headers["PRIVATE-TOKEN"] = pat
        return headers

    def extract_project_path_or_id(self, input_val: str) -> str:
        """
        Extracts the project path (namespace/project) or ID from a GitLab URL or ID string.
        """
        val = input_val.strip()
        if val.startswith("http://") or val.startswith("https://"):
            path = val.split("://", 1)[1]
            parts = path.split("/")
            if len(parts) > 1:
                project_parts = parts[1:]
                if project_parts[-1].endswith(".git"):
                    project_parts[-1] = project_parts[-1][:-4]
                return "/".join(project_parts)
        return val

    def get_project_details(self, project_path_or_id: str, pat: Optional[str] = None) -> Dict[str, Any]:
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        url = f"{self.base_url}/projects/{encoded_path}"
        
        with httpx.Client() as client:
            headers = self._get_headers(pat)
            response = client.get(url, headers=headers, timeout=15.0)
            
            if response.status_code == 404:
                raise ValueError("GitLab repository not found. Please verify the URL/ID and visibility.")
            elif response.status_code == 401:
                raise ValueError("Unauthorized. Access to this repository requires a valid Personal Access Token (PAT).")
            elif response.status_code != 200:
                raise ValueError(f"GitLab API returned status code {response.status_code}: {response.text}")
                
            return response.json()

    def get_project_branches(self, project_path_or_id: str, pat: Optional[str] = None) -> List[str]:
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        url = f"{self.base_url}/projects/{encoded_path}/repository/branches"
        
        try:
            with httpx.Client() as client:
                headers = self._get_headers(pat)
                response = client.get(url, headers=headers, timeout=15.0)
                if response.status_code == 200:
                    return [b["name"] for b in response.json()]
        except Exception as e:
            print(f"Error fetching branches: {e}")
        return []

    def get_project_releases(self, project_path_or_id: str, pat: Optional[str] = None) -> List[Dict[str, Any]]:
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        url = f"{self.base_url}/projects/{encoded_path}/releases"
        
        try:
            with httpx.Client() as client:
                headers = self._get_headers(pat)
                response = client.get(url, headers=headers, timeout=15.0)
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            print(f"Error fetching releases: {e}")
        return []

    def get_project_tags(self, project_path_or_id: str, pat: Optional[str] = None) -> List[Dict[str, Any]]:
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        url = f"{self.base_url}/projects/{encoded_path}/repository/tags"
        
        try:
            with httpx.Client() as client:
                headers = self._get_headers(pat)
                response = client.get(url, headers=headers, timeout=15.0)
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            print(f"Error fetching tags: {e}")
        return []

    def _fetch_tree_page(self, client: httpx.Client, url: str, headers: Dict[str, str], params: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Helper to fetch a paged tree query."""
        tree_files = []
        page = 1
        while True:
            params["page"] = page
            response = client.get(url, headers=headers, params=params, timeout=20.0)
            if response.status_code != 200:
                break
            items = response.json()
            if not items:
                break
            tree_files.extend(items)
            
            next_page = response.headers.get("x-next-page")
            if not next_page:
                break
            page = int(next_page)
            if len(tree_files) >= 1000:
                break
        return tree_files

    def get_repository_tree(self, project_path_or_id: str, branch: str, pat: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Fetches the repository tree in an optimized two-stage way:
        1. Fetch root-level files (non-recursive).
        2. Selectively fetch contents of test and spec folders recursively.
        """
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        url = f"{self.base_url}/projects/{encoded_path}/repository/tree"
        
        headers = self._get_headers(pat)
        merged_tree = []
        
        with httpx.Client() as client:
            # 1. Fetch Root Level (Non-recursive)
            root_params = {
                "ref": branch,
                "recursive": "false",
                "per_page": 100
            }
            root_items = self._fetch_tree_page(client, url, headers, root_params)
            merged_tree.extend(root_items)
            
            # Find folders to scan further
            folders_to_scan = []
            for item in root_items:
                if item["type"] == "tree":
                    name = item["name"].lower()
                    path = item["path"]
                    # If folder matches test, tests, spec, specs, .specify
                    if name in ["test", "tests", "spec", "specs", ".specify"]:
                        folders_to_scan.append(path)

            # 2. Selectively scan target subdirectories recursively
            for path in folders_to_scan:
                sub_params = {
                    "ref": branch,
                    "path": path,
                    "recursive": "true",
                    "per_page": 100
                }
                sub_items = self._fetch_tree_page(client, url, headers, sub_params)
                # Prefix sub items path with parent if not already
                merged_tree.extend(sub_items)
                
        return merged_tree

    def get_file_content(self, project_path_or_id: str, file_path: str, branch: str, pat: Optional[str] = None) -> Optional[str]:
        encoded_path = urllib.parse.quote(project_path_or_id, safe="")
        encoded_file = urllib.parse.quote(file_path, safe="")
        url = f"{self.base_url}/projects/{encoded_path}/repository/files/{encoded_file}/raw"
        
        try:
            with httpx.Client() as client:
                headers = self._get_headers(pat)
                params = {"ref": branch}
                response = client.get(url, headers=headers, params=params, timeout=15.0)
                if response.status_code == 200:
                    return response.text
        except Exception as e:
            print(f"Error fetching file content for {file_path}: {e}")
        return None

gitlab_service = GitLabService()
