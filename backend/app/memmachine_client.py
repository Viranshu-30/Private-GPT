"""
MemMachine client - Enhanced version with cross-thread memory support.
Uses /v1/memories endpoint to store in BOTH episodic and profile memory.
"""
import requests
import logging
from typing import Optional, Dict, Any, List
from app.config import settings

# Set up logging
logger = logging.getLogger(__name__)

BASE = settings.memmachine_base_url
GROUP_PREFIX = settings.memmachine_group_prefix
AGENT_ID = settings.memmachine_agent_id


def _session_payload(group_scope: str, user_id: str, session_id: Optional[str] = None):
    """
    Build session payload for MemMachine.
    
    CRITICAL: session_id is optional!
    - When storing: Include session_id to tag which thread the memory belongs to
    - When searching: Omit session_id (pass None) to search across ALL threads
    """
    payload = {
        "group_id": f"{GROUP_PREFIX}-{group_scope}",
        "agent_id": [AGENT_ID] if AGENT_ID else [],
        "user_id": [str(user_id)],
    }
    
    # Only add session_id if explicitly provided (not None)
    if session_id is not None:
        payload["session_id"] = session_id
    
    logger.debug(f"Session payload: {payload}")
    return payload


def add_memory(
    group_scope: str,
    user_id: str,
    content: str,
    episode_type: str = "message",
    metadata: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
    related_episodes: Optional[List[str]] = None,
):
    """
    Add memory to BOTH episodic AND profile storage.
    Uses /v1/memories endpoint per official documentation.
    """
    meta = metadata or {}
    
    if related_episodes:
        meta["related_to"] = related_episodes
        meta["has_context"] = True
    
    payload = {
        "session": _session_payload(group_scope, user_id, session_id or "default"),
        "producer": AGENT_ID or "system",
        "produced_for": str(user_id),
        "episode_content": content,
        "episode_type": episode_type,
        "metadata": meta,
    }
    
    try:
        logger.info(f"Adding memory: type={episode_type}, session={session_id}, content_len={len(content)}")
        r = requests.post(f"{BASE}/v1/memories", json=payload, timeout=10)
        r.raise_for_status()
        logger.info(f"Memory added successfully")
        return True
    except Exception as e:
        logger.error(f"Failed to add memory: {e}")
        return False


def add_episodic(
    group_scope: str,
    user_id: str,
    content: str,
    episode_type: str = "message",
    metadata: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
    related_episodes: Optional[List[str]] = None,
):
    """Add to both memories using unified endpoint."""
    return add_memory(group_scope, user_id, content, episode_type, metadata, session_id, related_episodes)


def add_profile(
    group_scope: str,
    user_id: str,
    content: str,
    profile_type: str = "user_info",
    metadata: Optional[Dict[str, Any]] = None,
    session_id: Optional[str] = None,
):
    """Add to both memories using unified endpoint."""
    return add_memory(group_scope, user_id, content, profile_type, metadata, session_id)


def search(
    group_scope: str,
    user_id: str,
    query: str,
    limit: int = 100,
    session_id: Optional[str] = None,
):
    """
    Search memories across both episodic and profile storage.
    
    CRITICAL: When session_id is None, searches across ALL sessions for the user.
    This enables cross-thread memory recall!
    """
    payload = {
        "session": _session_payload(group_scope, user_id, session_id),
        "query": query or "",
        "filter": {},
        "limit": limit,
    }
    
    try:
        logger.info(f"Searching memories: query='{query[:50]}...', session_id={session_id}, limit={limit}")
        r = requests.post(f"{BASE}/v1/memories/search", json=payload, timeout=60)
        r.raise_for_status()
        
        result = r.json()
        
        if isinstance(result, str):
            import json
            result = json.loads(result)
        
        content = result.get("content", {})
        
        # Handle nested array structure
        episodic_nested = content.get("episodic_memory", []) or []
        profile_nested = content.get("profile_memory", []) or []
        
        logger.debug(f"Raw episodic results: {type(episodic_nested)}, {len(episodic_nested) if isinstance(episodic_nested, list) else 'not a list'}")
        logger.debug(f"Raw profile results: {type(profile_nested)}, {len(profile_nested) if isinstance(profile_nested, list) else 'not a list'}")
        
        # Flatten arrays
        episodic = []
        if isinstance(episodic_nested, list):
            for group in episodic_nested:
                if isinstance(group, list):
                    episodic.extend(group)
                elif isinstance(group, dict):
                    episodic.append(group)
        
        profile = []
        if isinstance(profile_nested, list):
            for group in profile_nested:
                if isinstance(group, list):
                    profile.extend(group)
                elif isinstance(group, dict):
                    profile.append(group)
        
        # Convert to standard format
        episodic_results = []
        for item in episodic:
            if isinstance(item, dict):
                content_text = item.get("content", "")
                if content_text:  # Only add non-empty content
                    episodic_results.append({
                        "episode_content": content_text,
                        "metadata": item.get("user_metadata", {}),
                        "episode_type": item.get("episode_type", ""),
                    })
        
        profile_results = []
        for item in profile:
            if isinstance(item, dict):
                content_text = item.get("content", "")
                if content_text:  # Only add non-empty content
                    profile_results.append({
                        "profile_content": content_text,
                        "metadata": item.get("user_metadata", {}),
                        "profile_type": item.get("episode_type", ""),
                    })
        
        logger.info(f"Search results: {len(episodic_results)} episodic, {len(profile_results)} profile")
        
        # Debug: Print first few results
        if episodic_results:
            logger.debug(f"First episodic: {episodic_results[0]['episode_content'][:100]}...")
        if profile_results:
            logger.debug(f"First profile: {profile_results[0]['profile_content'][:100]}...")
        
        return {
            "episodic_results": episodic_results,
            "profile_results": profile_results,
            "total": len(episodic_results) + len(profile_results)
        }
        
    except Exception as e:
        logger.error(f"Memory search failed: {e}")
        return {
            "episodic_results": [],
            "profile_results": [],
            "total": 0
        }