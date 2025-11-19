from fastapi import APIRouter, Depends, HTTPException
from typing import List, Dict, Any
from openai import OpenAI

from ..config import settings
from ..auth import get_current_user
from ..utils.model_utils import fetch_available_models, get_fallback_models

router = APIRouter(prefix="/models", tags=["models"])


@router.get("", response_model=List[Dict[str, str]])
def list_models(_: Any = Depends(get_current_user)) -> List[Dict[str, str]]:
    """
    Dynamically fetch chat models available to the configured OpenAI API key.
    
    Returns list of models with:
    - id: OpenAI model identifier (e.g., "gpt-3.5-turbo-16k")
    - name: Human-readable name (e.g., "GPT-3.5 Turbo (16K)")
    
    Models are sorted by capability (best models first).
    Only returns models that the API key has access to.
    """
    api_key = settings.openai_api_key
    
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="OpenAI API key not configured. Set OPENAI_API_KEY in .env file."
        )
    
    try:
        # Fetch models available to this API key
        models = fetch_available_models(api_key)
        
        if not models:
            # If no models found, return fallback
            models = get_fallback_models()
        
        return models
    
    except Exception as e:
        print(f"Error in list_models endpoint: {e}")
        # Return fallback models on error
        return get_fallback_models()


@router.get("/check/{model_id}")
def check_model_access(
    model_id: str,
    _: Any = Depends(get_current_user)
) -> Dict[str, Any]:
    """
    Check if a specific model is accessible with the current API key.
    
    Args:
        model_id: OpenAI model identifier to check
    
    Returns:
        Dict with 'accessible' boolean and model details
    """
    api_key = settings.openai_api_key
    
    if not api_key:
        return {
            "accessible": False,
            "error": "OpenAI API key not configured"
        }
    
    try:
        client = OpenAI(api_key=api_key)
        
        # Try to retrieve specific model
        model = client.models.retrieve(model_id)
        
        return {
            "accessible": True,
            "id": model.id,
            "name": model.id,
            "created": getattr(model, "created", None),
        }
    
    except Exception as e:
        return {
            "accessible": False,
            "error": str(e),
            "model_id": model_id
        }