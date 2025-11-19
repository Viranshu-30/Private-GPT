from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import jwt

from .config import settings
from .database import SessionLocal, Base, engine
from .models import User
from .schemas import UserCreate, UserOut, Token, UserUpdateApiKey
from .utils.encryption import encrypt_api_key, decrypt_api_key, validate_openai_api_key

router = APIRouter(prefix="/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Create tables
Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(tz=timezone.utc) + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm="HS256")
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        user_id: int = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or inactive")
    return user


def get_user_api_key(user: User) -> str:
    """
    Get decrypted API key for user.
    Falls back to system API key if user hasn't set one.
    """
    if user.encrypted_api_key:
        try:
            return decrypt_api_key(user.encrypted_api_key)
        except Exception as e:
            print(f"Failed to decrypt user API key: {e}")
            # Fall back to system key
            return settings.openai_api_key if settings.openai_api_key else None
    
    # Fall back to system API key (backward compatibility)
    return settings.openai_api_key if settings.openai_api_key else None


from uuid import uuid4
from .models import Thread

@router.post("/signup", response_model=UserOut)
def signup(payload: UserCreate, db: Session = Depends(get_db)):
    """
    Sign up a new user with their OpenAI API key.
    """
    # Check if user already exists
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Validate API key format
    if not validate_openai_api_key(payload.openai_api_key):
        raise HTTPException(
            status_code=400, 
            detail="Invalid OpenAI API key format. Key should start with 'sk-' and be at least 20 characters long."
        )

    # Encrypt API key for secure storage
    try:
        encrypted_key = encrypt_api_key(payload.openai_api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process API key")

    # Create user with encrypted API key
    user = User(
        email=payload.email, 
        hashed_password=get_password_hash(payload.password),
        encrypted_api_key=encrypted_key
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Create initial personal thread
    personal_thread = Thread(
        title="Personal Chat",
        owner_user_id=user.id,
        project_id=None,
        session_id=f"t-{uuid4().hex[:12]}",
        group_scope=f"user-{user.id}",
    )
    db.add(personal_thread)
    db.commit()

    return UserOut(
        id=user.id,
        email=user.email,
        has_api_key=True
    )


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    # Check if user has API key configured
    if not user.encrypted_api_key:
        raise HTTPException(
            status_code=400, 
            detail="No API key configured. Please contact support or re-register with an API key."
        )
    
    token = create_access_token({"sub": str(user.id)})
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        has_api_key=bool(current_user.encrypted_api_key)
    )


@router.put("/api-key", response_model=UserOut)
def update_api_key(
    payload: UserUpdateApiKey,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update user's OpenAI API key.
    Allows users to change their API key after signup.
    """
    # Validate new API key
    if not validate_openai_api_key(payload.openai_api_key):
        raise HTTPException(
            status_code=400,
            detail="Invalid OpenAI API key format. Key should start with 'sk-' and be at least 20 characters long."
        )
    
    # Encrypt new API key
    try:
        encrypted_key = encrypt_api_key(payload.openai_api_key)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to process API key")
    
    # Update user's API key
    current_user.encrypted_api_key = encrypted_key
    db.commit()
    
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        has_api_key=True
    )


@router.delete("/api-key")
def delete_api_key(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Remove user's API key (will fall back to system key if configured).
    """
    current_user.encrypted_api_key = None
    db.commit()
    
    return {"status": "API key removed"}


from .memmachine_client import search as mm_search

@router.get("/history")
def history(user: User = Depends(get_current_user)):
    """
    Returns a lightweight view of user's remembered items (profile + episodic).
    Frontend can render this as a sidebar or preload list.
    """
    uid = str(user.id)
    # broad query to fetch recent items
    content = mm_search(uid, "recent uploaded documents and recent conversations", limit=20, session_id=f"sess-{uid}")
    return {"history": content}