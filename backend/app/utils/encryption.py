"""
Encryption utility for securely storing user API keys.
Uses Fernet symmetric encryption from cryptography library.
"""
from cryptography.fernet import Fernet
from ..config import settings
import base64
import hashlib


def get_encryption_key() -> bytes:
    """
    Generate encryption key from SECRET_KEY.
    This ensures consistent encryption/decryption across app restarts.
    """
    # Use SECRET_KEY from settings to derive encryption key
    key_material = settings.secret_key.encode()
    # Create a proper 32-byte key for Fernet
    key = hashlib.sha256(key_material).digest()
    # Fernet requires base64-encoded key
    return base64.urlsafe_b64encode(key)


def encrypt_api_key(api_key: str) -> str:
    """
    Encrypt an API key for secure storage.
    
    Args:
        api_key: Plain text API key
    
    Returns:
        Encrypted API key as string
    """
    if not api_key:
        return None
    
    try:
        fernet = Fernet(get_encryption_key())
        encrypted = fernet.encrypt(api_key.encode())
        return encrypted.decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        raise ValueError("Failed to encrypt API key")


def decrypt_api_key(encrypted_api_key: str) -> str:
    """
    Decrypt an API key for use.
    
    Args:
        encrypted_api_key: Encrypted API key string
    
    Returns:
        Plain text API key
    """
    if not encrypted_api_key:
        return None
    
    try:
        fernet = Fernet(get_encryption_key())
        decrypted = fernet.decrypt(encrypted_api_key.encode())
        return decrypted.decode()
    except Exception as e:
        print(f"Decryption error: {e}")
        raise ValueError("Failed to decrypt API key")


def validate_openai_api_key(api_key: str) -> bool:
    """
    Validate that an API key looks like a valid OpenAI key.
    
    Args:
        api_key: API key to validate
    
    Returns:
        True if key format is valid
    """
    if not api_key:
        return False
    
    # OpenAI keys start with "sk-" and are reasonably long
    if not api_key.startswith("sk-"):
        return False
    
    if len(api_key) < 20:
        return False
    
    return True