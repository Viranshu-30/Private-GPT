from sqlalchemy import (
    Column, Integer, String, DateTime, func,
    Boolean, ForeignKey, UniqueConstraint, Text
)
from .database import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    # ✅ NEW: Store user's encrypted OpenAI API key
    encrypted_api_key = Column(Text, nullable=True)  # Encrypted storage for security
    created_at = Column(DateTime(timezone=True), server_default=func.now())

# ---- Projects & Memberships ----
class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProjectMember(Base):
    __tablename__ = "project_members"
    id = Column(Integer, primary_key=True)
    project_id = Column(Integer, ForeignKey("projects.id", ondelete="CASCADE"), index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
    role = Column(String, default="member")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("project_id", "user_id", name="uq_project_member"),)

# ---- Threads & Messages ----
class Thread(Base):
    __tablename__ = "threads"
    id = Column(Integer, primary_key=True)
    title = Column(String, default="New chat")
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    session_id = Column(String, unique=True, index=True, nullable=False)
    group_scope = Column(String, nullable=False)
    active_model = Column(String, default="gpt-4o-mini")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_message_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True)
    thread_id = Column(Integer, ForeignKey("threads.id", ondelete="CASCADE"), index=True, nullable=False)
    sender = Column(String, nullable=False)
    content = Column(String, nullable=True)
    type = Column(String, default="text")
    filename = Column(String, nullable=True)
    model_used = Column(String, default="gpt-4o-mini")
    created_at = Column(DateTime(timezone=True), server_default=func.now())