"""
Model utility functions for OpenAI model management.
This module centralizes all model-related operations.
"""
from typing import Dict, List, Optional
from openai import OpenAI


def get_model_display_name(model_id: str) -> str:
    """
    Convert OpenAI model ID to user-friendly display name.
    
    Args:
        model_id: OpenAI model identifier (e.g., "gpt-3.5-turbo-16k")
    
    Returns:
        Human-readable model name (e.g., "GPT-3.5 Turbo (16K)")
    """
    # Exact matches - most common models
    model_name_map = {
        # GPT-4o family
        "gpt-4o": "GPT-4o",
        "gpt-4o-mini": "GPT-4o mini",
        "gpt-4o-2024-11-20": "GPT-4o",
        "gpt-4o-2024-08-06": "GPT-4o",
        "gpt-4o-2024-05-13": "GPT-4o",
        "gpt-4o-mini-2024-07-18": "GPT-4o mini",
        
        # GPT-4 family
        "gpt-4": "GPT-4",
        "gpt-4-turbo": "GPT-4 Turbo",
        "gpt-4-turbo-preview": "GPT-4 Turbo",
        "gpt-4-0125-preview": "GPT-4 Turbo",
        "gpt-4-1106-preview": "GPT-4 Turbo",
        "gpt-4-0613": "GPT-4",
        "gpt-4-32k": "GPT-4 (32K)",
        "gpt-4-32k-0613": "GPT-4 (32K)",
        
        # GPT-3.5 family
        "gpt-3.5-turbo": "GPT-3.5 Turbo",
        "gpt-3.5-turbo-16k": "GPT-3.5 Turbo (16K)",
        "gpt-3.5-turbo-1106": "GPT-3.5 Turbo",
        "gpt-3.5-turbo-0125": "GPT-3.5 Turbo",
        "gpt-3.5-turbo-0613": "GPT-3.5 Turbo",
        "gpt-3.5-turbo-16k-0613": "GPT-3.5 Turbo (16K)",
        
        # O-series models
        "o1": "o1",
        "o1-mini": "o1-mini",
        "o1-preview": "o1-preview",
        "o1-preview-2024-09-12": "o1-preview",
        "o1-mini-2024-09-12": "o1-mini",
        "o3": "o3",
        "o3-mini": "o3-mini",
    }
    
    # Check exact match first
    if model_id in model_name_map:
        return model_name_map[model_id]
    
    # Pattern matching for variants not explicitly listed
    model_lower = model_id.lower()
    
    # GPT-4o patterns
    if "gpt-4o-mini" in model_lower:
        return "GPT-4o mini"
    elif "gpt-4o" in model_lower:
        return "GPT-4o"
    
    # GPT-4 patterns
    elif "gpt-4-turbo" in model_lower or "gpt-4-preview" in model_lower:
        return "GPT-4 Turbo"
    elif "gpt-4-32k" in model_lower:
        return "GPT-4 (32K)"
    elif "gpt-4" in model_lower:
        return "GPT-4"
    
    # GPT-3.5 patterns
    elif "gpt-3.5" in model_lower and "16k" in model_lower:
        return "GPT-3.5 Turbo (16K)"
    elif "gpt-3.5" in model_lower:
        return "GPT-3.5 Turbo"
    
    # O-series patterns
    elif "o1-mini" in model_lower:
        return "o1-mini"
    elif "o1-preview" in model_lower:
        return "o1-preview"
    elif "o1" in model_lower:
        return "o1"
    elif "o3-mini" in model_lower:
        return "o3-mini"
    elif "o3" in model_lower:
        return "o3"
    
    # Fallback: return original model ID
    return model_id


def is_chat_model(model_id: str) -> bool:
    """
    Check if a model is suitable for chat completions.
    
    Args:
        model_id: OpenAI model identifier
    
    Returns:
        True if model supports chat completions
    """
    chat_model_patterns = [
        "gpt-4o",
        "gpt-4",
        "gpt-3.5-turbo",
        "o1",
        "o3",
    ]
    
    model_lower = model_id.lower()
    return any(pattern in model_lower for pattern in chat_model_patterns)


def fetch_available_models(api_key: str) -> List[Dict[str, str]]:
    """
    Fetch all chat models available to the provided API key.
    
    Args:
        api_key: OpenAI API key
    
    Returns:
        List of dicts with 'id' and 'name' keys, sorted by capability
    """
    try:
        client = OpenAI(api_key=api_key)
        
        # Fetch all models from OpenAI
        response = client.models.list()
        
        # Filter to chat-capable models only
        chat_models = []
        for model in response.data:
            if is_chat_model(model.id):
                chat_models.append({
                    "id": model.id,
                    "name": get_model_display_name(model.id),
                    "created": getattr(model, "created", 0)
                })
        
        # Sort by priority (newest/best first)
        def model_priority(model):
            model_id = model["id"].lower()
            
            # Priority order
            if "gpt-4o" in model_id and "mini" not in model_id:
                return 1  # GPT-4o (best)
            elif "gpt-4o-mini" in model_id:
                return 2  # GPT-4o mini
            elif "gpt-4-turbo" in model_id or "gpt-4-preview" in model_id:
                return 3  # GPT-4 Turbo
            elif "gpt-4-32k" in model_id:
                return 4  # GPT-4 32K
            elif "gpt-4" in model_id:
                return 5  # GPT-4
            elif "o1" in model_id and "mini" not in model_id and "preview" not in model_id:
                return 6  # o1
            elif "o1-preview" in model_id:
                return 7  # o1 preview
            elif "o1-mini" in model_id:
                return 8  # o1 mini
            elif "o3" in model_id and "mini" not in model_id:
                return 9  # o3
            elif "o3-mini" in model_id:
                return 10  # o3 mini
            elif "gpt-3.5-turbo-16k" in model_id:
                return 11  # GPT-3.5 16K
            elif "gpt-3.5-turbo" in model_id:
                return 12  # GPT-3.5
            else:
                return 99  # Unknown
        
        chat_models.sort(key=model_priority)
        
        # Remove duplicate display names (keep first occurrence)
        seen_names = set()
        unique_models = []
        for model in chat_models:
            if model["name"] not in seen_names:
                seen_names.add(model["name"])
                unique_models.append({"id": model["id"], "name": model["name"]})
        
        return unique_models
    
    except Exception as e:
        # Fallback to safe defaults if API call fails
        print(f"Error fetching models: {e}")
        return get_fallback_models()


def get_fallback_models() -> List[Dict[str, str]]:
    """
    Return safe fallback models if API call fails.
    These are commonly available models.
    """
    return [
        {"id": "gpt-4o-mini", "name": "GPT-4o mini"},
        {"id": "gpt-4o", "name": "GPT-4o"},
        {"id": "gpt-4-turbo", "name": "GPT-4 Turbo"},
        {"id": "gpt-4", "name": "GPT-4"},
        {"id": "gpt-3.5-turbo", "name": "GPT-3.5 Turbo"},
        {"id": "gpt-3.5-turbo-16k", "name": "GPT-3.5 Turbo (16K)"},
    ]