from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import AnyHttpUrl
from typing import List, Optional
import os
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))


class Settings(BaseSettings):
    api_host: str = "0.0.0.0"
    api_port: int = 8000
    cors_origins: List[AnyHttpUrl] | List[str] = ["http://localhost:5173"]

    secret_key: str
    access_token_expire_minutes: int = 60 * 24 * 7
    database_url: str = "sqlite:///./app.db"

    openai_api_key: str

    # Tavily API configuration
    tavily_api_key: Optional[str] = None

    # MemMachine V2 Configuration
    # NOTE: V2 uses /api/v2/* endpoints
    memmachine_base_url: str = "http://localhost:8080"
    
    # Deprecated V1 settings (kept for compatibility, not used)
    memmachine_group_prefix: str = "group"  # Not used in V2
    memmachine_agent_id: str = "web-assistant"  # Not used in V2

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env"), 
        env_file_encoding="utf-8", 
        case_sensitive=False
    )

settings = Settings()