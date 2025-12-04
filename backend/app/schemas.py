"""
Enhanced schemas.py with multi-provider support and flexible API key management.
⭐ UPDATED: No API keys required at signup! Added location & profile schemas.
"""
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional, List, Any, Dict
from datetime import datetime


# ============================================================================
# AUTHENTICATION & USER MANAGEMENT
# ============================================================================

class UserCreate(BaseModel):
    """
    API keys can be added later in settings.
    Accepts optional location data from geolocation.
    """
    email: EmailStr
    password: str = Field(min_length=6, description="Password (min 6 characters)")
    
    #  Optional profile fields
    name: Optional[str] = Field(None, description="User's name")
    occupation: Optional[str] = Field(None, description="User's occupation")
    
    # Optional location from geolocation
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: Optional[str] = None
    location_latitude: Optional[str] = None
    location_longitude: Optional[str] = None
    location_timezone: Optional[str] = None
    location_formatted: Optional[str] = None
    
    @validator('password')
    def validate_password(cls, v):
        if len(v) < 6:
            raise ValueError('Password must be at least 6 characters')
        return v
    
    class Config:
        json_schema_extra = {
            "example": {
                "email": "user@example.com",
                "password": "securepass123",
                "name": "John Doe",
                "occupation": "ML Engineer"
            }
        }


class UserLogin(BaseModel):
    """User login credentials"""
    email: EmailStr
    password: str


class UserOut(BaseModel):
    """User information response (without sensitive data)"""
    id: int
    email: EmailStr
    has_openai_key: bool = False
    has_anthropic_key: bool = False
    has_google_key: bool = False
    has_tavily_key: bool = False
    
    # Backward compatibility property
    @property
    def has_api_key(self) -> bool:
        """For backward compatibility with old code"""
        return self.has_openai_key or self.has_anthropic_key or self.has_google_key
    
    class Config:
        from_attributes = True  # Pydantic v2


class UserUpdateApiKeys(BaseModel):
    """Update user API keys (any combination)"""
    openai_api_key: Optional[str] = Field(None, description="OpenAI API key")
    anthropic_api_key: Optional[str] = Field(None, description="Anthropic API key")  
    google_api_key: Optional[str] = Field(None, description="Google AI API key")
    tavily_api_key: Optional[str] = Field(None, description="Tavily API key")
    
    class Config:
        json_schema_extra = {
            "example": {
                "openai_api_key": "sk-...",
                "anthropic_api_key": "sk-ant-...",
                "google_api_key": "AIza...",
                "tavily_api_key": "tvly-..."
            }
        }


class UserUpdateApiKey(BaseModel):
    """Update single API key (backward compatibility)"""
    openai_api_key: str


class UserUpdateDefaultProvider(BaseModel):
    """Update default AI provider preference"""
    default_provider: str = Field(..., description="Default provider: openai, anthropic, or google")
    
    @validator('default_provider')
    def validate_provider(cls, v):
        if v not in ['openai', 'anthropic', 'google']:
            raise ValueError('Provider must be: openai, anthropic, or google')
        return v


class Token(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"


# ============================================================================
# MODEL PROVIDER SCHEMAS
# ============================================================================

class ModelInfo(BaseModel):
    """Information about an AI model"""
    id: str
    name: str
    provider: str
    context_window: Optional[int] = None
    supports_streaming: bool = True
    supports_vision: bool = False
    cost_per_1k_input: Optional[float] = None
    cost_per_1k_output: Optional[float] = None


class AvailableModelsResponse(BaseModel):
    """Response with all available models across providers"""
    openai: List[ModelInfo] = []
    anthropic: List[ModelInfo] = []
    google: List[ModelInfo] = []
    total_count: int = 0
    user_has_access: Dict[str, bool] = {}


# ============================================================================
# CHAT & MESSAGE SCHEMAS
# ============================================================================

class ChatRequest(BaseModel):
    """Chat message request"""
    thread_id: int
    message: str
    model: Optional[str] = "gpt-4o-mini"
    provider: Optional[str] = "openai"
    temperature: Optional[float] = 1.0
    system_prompt: Optional[str] = ""
    enable_web_search: Optional[bool] = True


class ChatResponse(BaseModel):
    """Chat response"""
    reply: str
    model_used: Optional[str] = "gpt-4o-mini"
    provider_used: Optional[str] = "openai"
    tokens_used: Optional[int] = None
    used_memory: bool = False
    used_web_search: bool = False
    memory_count: Optional[int] = None
    used_context: List[str] = []  # For backward compatibility


class MessageOut(BaseModel):
    """Message response"""
    id: int
    thread_id: int
    sender: str
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    model_used: Optional[str] = None
    provider_used: Optional[str] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# THREAD SCHEMAS
# ============================================================================

class ThreadCreate(BaseModel):
    """Create new thread"""
    title: Optional[str] = "New chat"
    project_id: Optional[int] = None
    model: Optional[str] = "gpt-4o-mini"
    provider: Optional[str] = "openai"
    temperature: Optional[float] = 1.0
    system_prompt: Optional[str] = ""


class ThreadUpdate(BaseModel):
    """Update thread configuration"""
    title: Optional[str] = None
    model: Optional[str] = None
    provider: Optional[str] = None
    temperature: Optional[float] = None
    system_prompt: Optional[str] = None


class ThreadOut(BaseModel):
    """Thread response"""
    id: int
    title: str
    project_id: Optional[int] = None
    session_id: str
    group_scope: str
    active_model: Optional[str] = None
    active_provider: Optional[str] = None
    temperature: Optional[str] = None
    system_prompt: Optional[str] = None
    created_at: datetime
    last_message_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


# ============================================================================
# PROJECT SCHEMAS
# ============================================================================

class ProjectCreate(BaseModel):
    """Create new project"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class ProjectUpdate(BaseModel):
    """Update project"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class ProjectOut(BaseModel):
    """Project response"""
    id: int
    name: str
    description: Optional[str] = None
    owner_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class InviteMember(BaseModel):
    """Invite user to project"""
    email: EmailStr
    role: Optional[str] = "member"
    
    @validator('role')
    def validate_role(cls, v):
        if v not in ['owner', 'admin', 'member', 'viewer']:
            raise ValueError('Role must be: owner, admin, member, or viewer')
        return v


class ProjectMemberOut(BaseModel):
    """Project member response"""
    id: int
    project_id: int
    user_id: int
    role: str
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# MEMORY SCHEMAS
# ============================================================================

class MemorySearchRequest(BaseModel):
    """Memory search request"""
    query: str
    thread_id: Optional[int] = None
    limit: Optional[int] = 100
    include_profile: Optional[bool] = True
    include_episodic: Optional[bool] = True


class MemoryItem(BaseModel):
    """Individual memory item"""
    content: str
    type: str  # profile, episodic
    thread_id: Optional[int] = None
    created_at: Optional[str] = None
    relevance_score: Optional[float] = None


class MemorySearchResponse(BaseModel):
    """Memory search response"""
    profile_memories: List[MemoryItem] = []
    episodic_memories: List[MemoryItem] = []
    current_thread_memories: List[MemoryItem] = []
    other_thread_memories: List[MemoryItem] = []
    total_count: int = 0


# ============================================================================
# SYSTEM SCHEMAS
# ============================================================================

class HealthCheck(BaseModel):
    """Health check response"""
    status: str
    version: str
    database: str
    memmachine: str
    timestamp: datetime


class SystemStats(BaseModel):
    """System statistics"""
    total_users: int
    total_threads: int
    total_messages: int
    total_projects: int
    active_providers: List[str]
    memmachine_status: str


# ============================================================================
# API KEYS MANAGEMENT SCHEMAS
# ============================================================================

class ApiKeysCheck(BaseModel):
    """Check which API keys user has configured"""
    has_openai: bool = False
    has_anthropic: bool = False
    has_google: bool = False
    has_tavily: bool = False


class ApiKeysSave(BaseModel):
    """Save user API keys"""
    openai_api_key: Optional[str] = Field(None, description="OpenAI API key")
    anthropic_api_key: Optional[str] = Field(None, description="Anthropic API key")
    google_api_key: Optional[str] = Field(None, description="Google API key")
    tavily_api_key: Optional[str] = Field(None, description="Tavily API key")


# ============================================================================
#  USER SETTINGS SCHEMAS
# ============================================================================

class UserSettings(BaseModel):
    """User profile settings"""
    name: Optional[str] = None
    occupation: Optional[str] = None
    preferences: Optional[str] = None


# ============================================================================
#  LOCATION DATA SCHEMA
# ============================================================================

class LocationData(BaseModel):
    """Location data from browser geolocation"""
    city: str
    state: Optional[str] = None
    country: Optional[str] = None
    latitude: str
    longitude: str
    timezone: str
    formatted: str