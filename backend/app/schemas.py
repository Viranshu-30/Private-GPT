from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any

# -------- Auth ----------
class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    # ✅ NEW: API key required at signup
    openai_api_key: str = Field(min_length=20, description="Your OpenAI API key")

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    email: EmailStr
    has_api_key: bool = False  # ✅ NEW: Indicate if user has configured API key

    class Config:
        from_attributes = True

class UserUpdateApiKey(BaseModel):
    """Schema for updating API key"""
    openai_api_key: str = Field(min_length=20, description="Your OpenAI API key")

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# -------- Chat ----------
class ChatResponse(BaseModel):
    reply: str
    used_context: List[Any] = []

# -------- Projects ----------
class ProjectCreate(BaseModel):
    name: str

class ProjectOut(BaseModel):
    id: int
    name: str
    owner_id: int

    class Config:
        from_attributes = True

class InviteMember(BaseModel):
    email: EmailStr
    role: Optional[str] = "member"

# -------- Threads ----------
class ThreadCreate(BaseModel):
    title: Optional[str] = "New chat"
    project_id: Optional[int] = None  # null -> personal thread

class ThreadOut(BaseModel):
    id: int
    title: str
    project_id: Optional[int] = None
    session_id: str
    group_scope: str
    active_model: str  

    class Config:
        from_attributes = True

# -------- Messages ----------
class MessageOut(BaseModel):
    id: int
    thread_id: int
    sender: str
    type: str
    content: Optional[str] = None
    filename: Optional[str] = None
    model_used: str  

    class Config:
        from_attributes = True