import os
from pydantic_settings import BaseSettings, SettingsConfigDict
from typing import Optional

class Settings(BaseSettings):
    # App Settings
    PORT: int = 8000
    HOST: str = "0.0.0.0"
    DEBUG: bool = True
    
    # Gemini Settings
    GEMINI_API_KEY: Optional[str] = None
    
    # AI Config Settings
    AI_PROVIDER: str = "gemini"  # "gemini" or "yolo"
    YOLO_MODEL_PATH: str = "yolov8n.pt"
    
    # Supabase Settings
    SUPABASE_URL: Optional[str] = "https://huxrjhtfmjqxdfsfchti.supabase.co"
    SUPABASE_ANON_KEY: Optional[str] = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh1eHJqaHRmbWpxeGRmc2ZjaHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwODk0MzksImV4cCI6MjA5MTY2NTQzOX0.Z3hUgQIZGF2gl4odfH4h9BDtWgAQjbvgVsI66hTXUy4"
    SUPABASE_SERVICE_KEY: Optional[str] = None

    # Load from .env file if present
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

settings = Settings()


