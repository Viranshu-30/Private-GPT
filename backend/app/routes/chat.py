from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse, StreamingResponse
from typing import Any, Optional
import tempfile, os
import json
import asyncio
import logging
import re
from sqlalchemy.orm import Session
from openai import OpenAI

from ..auth import get_current_user, get_db, get_user_api_key
from ..config import settings
from ..schemas import ChatResponse
from ..models import Thread, ProjectMember, Message
from ..memmachine_client import search as mm_search, add_episodic, add_profile
from ..utils.parser import sniff_and_read
from ..utils.memory import chunk_text
from ..utils.model_utils import get_model_display_name
from ..utils.tavily_client import TavilyClient

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _ensure_access(thread: Thread, user_id: int, db: Session):
    """Check whether the current user can access this chat thread."""
    if thread.project_id:
        member = (
            db.query(ProjectMember)
            .filter_by(project_id=thread.project_id, user_id=user_id)
            .first()
        )
        if not member:
            raise HTTPException(status_code=403, detail="No access to this project chat")
    elif thread.owner_user_id != user_id:
        raise HTTPException(status_code=403, detail="No access to this personal chat")


def should_search_web(message: str) -> bool:
    """
    Determine if the message requires web search.
    Looks for indicators like current events, recent info, real-time data queries.
    """
    search_triggers = [
        # Explicit search requests
        r'\b(search|find|look up|google)\b',
        # Current events
        r'\b(latest|recent|current|today|now|this week|this month|2024|2025)\b',
        # Real-time data
        r'\b(price|stock|weather|news|score|result)\b',
        # Questions about specific things that change
        r'\b(what is|who is|when did|where is).*(now|today|currently|latest)\b',
    ]
    
    message_lower = message.lower()
    
    for pattern in search_triggers:
        if re.search(pattern, message_lower, re.IGNORECASE):
            logger.info(f"🔍 Web search triggered by pattern: {pattern}")
            return True
    
    return False


@router.post("/", response_model=ChatResponse)
def chat_endpoint(
    thread_id: int = Form(...),
    message: str = Form(...),
    model: str = Form("gpt-4o-mini"),
    temperature: float = Form(1.0),
    system_prompt: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Chat endpoint with memory integration (non-streaming)."""
    
    # ✅ Get user's personal API key
    user_api_key = get_user_api_key(user)
    if not user_api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Please add your OpenAI API key in settings."
        )
    
    # Load thread + access check
    thread = db.query(Thread).filter_by(id=thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    _ensure_access(thread, user.id, db)

    # Build scope identifiers
    uid = str(user.id)
    session_id = f"t-{thread.id}"
    
    # Use consistent group_scope for all personal chats
    if thread.project_id:
        group_scope = f"project-{thread.project_id}"
    else:
        group_scope = f"user-{user.id}"
    
    logger.info(f"=== CHAT REQUEST (Non-Streaming) ===")
    logger.info(f"Thread: {thread.id}, User: {uid}, Model: {model}")
    logger.info(f"Group scope: {group_scope}, Session: {session_id}")
    logger.info(f"Using user's personal API key")
    logger.info(f"Message: {message[:100]}...")

    # Handle file upload
    uploaded_texts = []
    if file and file.filename:
        try:
            file_content = file.file.read()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            try:
                parsed, _ = sniff_and_read(tmp_path, file.filename)
            except:
                with open(tmp_path, 'r', encoding='utf-8', errors='ignore') as f:
                    parsed = f.read()
            
            os.remove(tmp_path)
            
            uploaded_texts.append(f"[File: {file.filename}]\n{parsed}")
            
            logger.info(f"File uploaded: {file.filename}, size: {len(parsed)} chars")
            
            # Store file upload with thread context
            add_episodic(
                group_scope, uid,
                f"User uploaded file: {file.filename}\n\nContent:\n{parsed}",
                episode_type="file_upload",
                metadata={"thread_id": thread.id, "filename": file.filename, "size": len(parsed)},
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"File processing error: {e}")
            uploaded_texts.append(f"[File: {file.filename}]\n[Error reading file]")

    # ===== WEB SEARCH with Tavily (if needed) =====
    web_search_results = ""
    if settings.tavily_api_key and should_search_web(message):
        try:
            logger.info("🌐 Performing Tavily web search...")
            tavily = TavilyClient(settings.tavily_api_key)
            search_result = tavily.search(message, max_results=5)
            web_search_results = tavily.format_results_for_llm(search_result)
            logger.info(f"✅ Web search complete: {len(web_search_results)} chars")
        except Exception as e:
            logger.error(f"Tavily search failed: {e}")
            web_search_results = ""

    # ===== CRITICAL: Search WITHOUT session_id to get memories from ALL threads =====
    logger.info("=== MEMORY SEARCH (CROSS-THREAD) ===")
    try:
        search_result = mm_search(
            group_scope=group_scope,
            user_id=uid,
            query=message or "context",
            limit=100,
            session_id=None  # ← KEY: None = search ALL threads
        )
        episodic = search_result.get("episodic_results", []) or []
        profile = search_result.get("profile_results", []) or []
        
        logger.info(f"Memory search returned: {len(episodic)} episodic, {len(profile)} profile")
        
        # Debug: Show first few memories
        if episodic:
            logger.debug(f"First episodic memory: {episodic[0].get('episode_content', '')[:100]}...")
        if profile:
            logger.debug(f"First profile memory: {profile[0].get('profile_content', '')[:100]}...")
            
    except Exception as e:
        logger.error(f"Memory search error: {e}")
        episodic = []
        profile = []

    # Separate current thread vs other threads
    current_thread_memories = []
    other_thread_memories = []
    
    logger.info("=== CATEGORIZING MEMORIES ===")
    for m in (episodic + profile):
        metadata = m.get("metadata", {})
        mem_thread_id = metadata.get("thread_id")
        content = m.get("episode_content") or m.get("profile_content") or ""
        
        if not content:
            continue
            
        if mem_thread_id == thread.id:
            current_thread_memories.append(content)
            logger.debug(f"Current thread memory: {content[:50]}...")
        else:
            other_thread_memories.append(content)
            logger.debug(f"Other thread memory (thread {mem_thread_id}): {content[:50]}...")
    
    logger.info(f"Categorized: {len(current_thread_memories)} current, {len(other_thread_memories)} other")

    # Build enriched system prompt with cross-thread context
    current_model_name = get_model_display_name(model)
    
    system_prompt_parts = [
        system_prompt or "You are a helpful AI assistant with persistent memory and web search capabilities.",
        f"\n\nYou are currently using the {current_model_name} model.",
    ]

    if current_thread_memories:
        logger.info(f"Adding {len(current_thread_memories[:20])} current thread memories to prompt")
        system_prompt_parts.append(
            f"\n\n📝 CURRENT CONVERSATION CONTEXT (from this chat):\n" + 
            "\n".join(f"- {m}" for m in current_thread_memories[:20])
        )

    if other_thread_memories:
        logger.info(f"Adding {len(other_thread_memories[:15])} other thread memories to prompt")
        system_prompt_parts.append(
            f"\n\n💭 RELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS (from other chats):\n" + 
            "\n".join(f"- {m}" for m in other_thread_memories[:15])
        )
    
    if not current_thread_memories and not other_thread_memories:
        logger.warning("⚠️ NO MEMORIES FOUND! This might indicate a problem.")

    if uploaded_texts:
        system_prompt_parts.append(f"\n\n📄 Recently uploaded documents:\n" + "\n\n".join(uploaded_texts))

    if web_search_results:
        system_prompt_parts.append(f"\n\n🌐 WEB SEARCH RESULTS:\n{web_search_results}")
        system_prompt_parts.append("\n\nℹ️ Use the web search results above to provide current, accurate information.")

    final_system_prompt = "".join(system_prompt_parts)
    
    logger.info(f"System prompt length: {len(final_system_prompt)} chars")

    # Load conversation history FROM DATABASE (for current thread only)
    hist = db.query(Message).filter_by(thread_id=thread.id).order_by(Message.created_at.asc()).all()
    
    conversation_messages = []
    for h in hist:
        if h.sender == "user":
            conversation_messages.append({"role": "user", "content": h.content or "[file uploaded]"})
        else:
            conversation_messages.append({"role": "assistant", "content": h.content})
    
    conversation_messages.append({"role": "user", "content": message})
    
    logger.info(f"Conversation history: {len(hist)} previous messages")

    # Save user message to DB
    user_msg = Message(thread_id=thread.id, sender="user", content=message, type="text", model_used=model)
    db.add(user_msg)
    db.flush()

    # Store user message in MemMachine (with session_id for organization)
    logger.info("Storing user message in MemMachine")
    add_episodic(
        group_scope, uid, message,
        episode_type="user_message",
        metadata={"thread_id": thread.id, "sender": "user", "model": model},
        session_id=session_id
    )

    # ✅ Call OpenAI API with user's personal API key
    try:
        logger.info("Calling OpenAI API with user's API key")
        client = OpenAI(api_key=user_api_key)
        completion = client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": final_system_prompt}, *conversation_messages],
            temperature=temperature,
        )
        reply = completion.choices[0].message.content
        logger.info(f"Response received: {len(reply)} chars")
    except Exception as e:
        logger.error(f"OpenAI API error: {e}")
        db.rollback()
        
        # Provide helpful error messages
        error_detail = str(e)
        if "invalid_api_key" in error_detail.lower() or "incorrect api key" in error_detail.lower():
            raise HTTPException(status_code=400, detail="Invalid API key. Please update your API key in settings.")
        elif "insufficient_quota" in error_detail.lower():
            raise HTTPException(status_code=402, detail="API key has insufficient quota. Please check your OpenAI account.")
        else:
            raise HTTPException(status_code=500, detail=f"OpenAI error: {error_detail}")

    # Save assistant reply to DB
    asst_msg = Message(thread_id=thread.id, sender="assistant", content=reply, type="text", model_used=model)
    db.add(asst_msg)

    # Store assistant reply in MemMachine (with session_id for organization)
    logger.info("Storing assistant response in MemMachine")
    add_episodic(
        group_scope, uid, reply,
        episode_type="assistant_message",
        metadata={"thread_id": thread.id, "sender": "assistant", "model": model},
        session_id=session_id
    )

    # Update thread
    thread.active_model = model
    from datetime import datetime
    thread.last_message_at = datetime.utcnow()

    db.commit()
    logger.info("=== CHAT COMPLETE (Non-Streaming) ===\n")

    return ChatResponse(reply=reply)


@router.post("/stream")
async def chat_stream(
    thread_id: int = Form(...),
    message: str = Form(...),
    model: str = Form("gpt-4o-mini"),
    temperature: float = Form(1.0),
    system_prompt: str = Form(""),
    file: Optional[UploadFile] = File(None),
    user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Streaming chat endpoint with Tavily web search and enhanced cross-thread memory integration."""
    
    # ✅ Get user's personal API key
    user_api_key = get_user_api_key(user)
    if not user_api_key:
        raise HTTPException(
            status_code=400,
            detail="No API key configured. Please add your OpenAI API key in settings."
        )
    
    # Load thread + access check
    thread = db.query(Thread).filter_by(id=thread_id).first()
    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")
    _ensure_access(thread, user.id, db)

    # Build scope identifiers
    uid = str(user.id)
    session_id = f"t-{thread.id}"
    
    # Use consistent group_scope for all personal chats
    if thread.project_id:
        group_scope = f"project-{thread.project_id}"
    else:
        group_scope = f"user-{user.id}"
    
    logger.info(f"=== CHAT REQUEST (Streaming) ===")
    logger.info(f"Thread: {thread.id}, User: {uid}, Model: {model}")
    logger.info(f"Group scope: {group_scope}, Session: {session_id}")
    logger.info(f"Using user's personal API key")
    logger.info(f"Message: {message[:100]}...")

    # Handle file upload
    uploaded_texts = []
    if file and file.filename:
        try:
            file_content = file.file.read()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=f"_{file.filename}") as tmp:
                tmp.write(file_content)
                tmp_path = tmp.name

            try:
                parsed, _ = sniff_and_read(tmp_path, file.filename)
            except:
                with open(tmp_path, 'r', encoding='utf-8', errors='ignore') as f:
                    parsed = f.read()
            
            os.remove(tmp_path)
            
            uploaded_texts.append(f"[File: {file.filename}]\n{parsed}")
            
            logger.info(f"File uploaded: {file.filename}, size: {len(parsed)} chars")
            
            add_episodic(
                group_scope, uid,
                f"User uploaded file: {file.filename}\n\nContent:\n{parsed}",
                episode_type="file_upload",
                metadata={"thread_id": thread.id, "filename": file.filename, "size": len(parsed)},
                session_id=session_id
            )
            
        except Exception as e:
            logger.error(f"File processing error: {e}")
            uploaded_texts.append(f"[File: {file.filename}]\n[Error reading file]")

    # ===== WEB SEARCH with Tavily (if needed) =====
    web_search_results = ""
    if settings.tavily_api_key and should_search_web(message):
        try:
            logger.info("🌐 Performing Tavily web search...")
            tavily = TavilyClient(settings.tavily_api_key)
            search_result = tavily.search(message, max_results=5)
            web_search_results = tavily.format_results_for_llm(search_result)
            logger.info(f"✅ Web search complete: {len(web_search_results)} chars")
        except Exception as e:
            logger.error(f"Tavily search failed: {e}")
            web_search_results = ""

    # ===== CRITICAL: Search WITHOUT session_id to get memories from ALL threads =====
    logger.info("=== MEMORY SEARCH (CROSS-THREAD) ===")
    try:
        search_result = mm_search(
            group_scope=group_scope,
            user_id=uid,
            query=message or "context",
            limit=100,
            session_id=None  # ← KEY: None = search ALL threads
        )
        episodic = search_result.get("episodic_results", []) or []
        profile = search_result.get("profile_results", []) or []
        
        logger.info(f"Memory search returned: {len(episodic)} episodic, {len(profile)} profile")
        
        # Debug: Show first few memories
        if episodic:
            logger.debug(f"First episodic memory: {episodic[0].get('episode_content', '')[:100]}...")
        if profile:
            logger.debug(f"First profile memory: {profile[0].get('profile_content', '')[:100]}...")
            
    except Exception as e:
        logger.error(f"Memory search error: {e}")
        episodic = []
        profile = []

    # Separate current thread vs other threads
    current_thread_memories = []
    other_thread_memories = []
    
    logger.info("=== CATEGORIZING MEMORIES ===")
    for m in (episodic + profile):
        metadata = m.get("metadata", {})
        mem_thread_id = metadata.get("thread_id")
        content = m.get("episode_content") or m.get("profile_content") or ""
        
        if not content:
            continue
            
        if mem_thread_id == thread.id:
            current_thread_memories.append(content)
            logger.debug(f"Current thread memory: {content[:50]}...")
        else:
            other_thread_memories.append(content)
            logger.debug(f"Other thread memory (thread {mem_thread_id}): {content[:50]}...")
    
    logger.info(f"Categorized: {len(current_thread_memories)} current, {len(other_thread_memories)} other")

    # Build enriched system prompt with cross-thread context and web search
    current_model_name = get_model_display_name(model)
    
    system_prompt_parts = [
        system_prompt or "You are a helpful AI assistant with persistent memory and web search capabilities.",
        f"\n\nYou are currently using the {current_model_name} model.",
    ]

    if current_thread_memories:
        logger.info(f"Adding {len(current_thread_memories[:20])} current thread memories to prompt")
        system_prompt_parts.append(
            f"\n\n📝 CURRENT CONVERSATION CONTEXT (from this chat):\n" + 
            "\n".join(f"- {m}" for m in current_thread_memories[:20])
        )

    if other_thread_memories:
        logger.info(f"Adding {len(other_thread_memories[:15])} other thread memories to prompt")
        system_prompt_parts.append(
            f"\n\n💭 RELEVANT MEMORIES FROM PREVIOUS CONVERSATIONS (from other chats):\n" + 
            "\n".join(f"- {m}" for m in other_thread_memories[:15])
        )
    
    if not current_thread_memories and not other_thread_memories:
        logger.warning("⚠️ NO MEMORIES FOUND! This might indicate a problem.")

    if uploaded_texts:
        system_prompt_parts.append(f"\n\n📄 Recently uploaded documents:\n" + "\n\n".join(uploaded_texts))

    if web_search_results:
        system_prompt_parts.append(f"\n\n🌐 WEB SEARCH RESULTS:\n{web_search_results}")
        system_prompt_parts.append("\n\nℹ️ Use the web search results above to provide current, accurate information.")

    final_system_prompt = "".join(system_prompt_parts)
    
    logger.info(f"System prompt length: {len(final_system_prompt)} chars")

    # Load conversation history FROM DATABASE (for current thread only)
    hist = db.query(Message).filter_by(thread_id=thread.id).order_by(Message.created_at.asc()).all()
    
    conversation_messages = []
    for h in hist:
        if h.sender == "user":
            conversation_messages.append({"role": "user", "content": h.content or "[file uploaded]"})
        else:
            conversation_messages.append({"role": "assistant", "content": h.content})
    
    conversation_messages.append({"role": "user", "content": message})
    
    logger.info(f"Conversation history: {len(hist)} previous messages")

    # Save user message to DB
    user_msg = Message(thread_id=thread.id, sender="user", content=message, type="text", model_used=model)
    db.add(user_msg)
    db.flush()

    # Store user message in MemMachine (with session_id for organization)
    logger.info("Storing user message in MemMachine")
    add_episodic(
        group_scope, uid, message,
        episode_type="user_message",
        metadata={"thread_id": thread.id, "sender": "user", "model": model},
        session_id=session_id
    )

    async def generate():
        full_response = ""
        
        try:
            # ✅ Call OpenAI API with user's personal API key
            logger.info("Starting OpenAI streaming with user's API key")
            client = OpenAI(api_key=user_api_key)
            
            stream = client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": final_system_prompt}, *conversation_messages],
                temperature=temperature,
                stream=True
            )
            
            # Stream chunks to client
            for chunk in stream:
                if chunk.choices[0].delta.content is not None:
                    content = chunk.choices[0].delta.content
                    full_response += content
                    
                    # Send SSE formatted data
                    yield f"data: {json.dumps({'content': content})}\n\n"
                    
                    # Small delay to make streaming visible
                    await asyncio.sleep(0.01)
            
            # Send completion signal
            yield "data: [DONE]\n\n"
            
            logger.info(f"Response complete: {len(full_response)} chars")
            
            # Save assistant reply to DB
            asst_msg = Message(thread_id=thread.id, sender="assistant", content=full_response, type="text", model_used=model)
            db.add(asst_msg)

            # Store assistant reply in MemMachine (with session_id for organization)
            logger.info("Storing assistant response in MemMachine")
            add_episodic(
                group_scope, uid, full_response,
                episode_type="assistant_message",
                metadata={"thread_id": thread.id, "sender": "assistant", "model": model},
                session_id=session_id
            )

            # Update thread
            thread.active_model = model
            from datetime import datetime
            thread.last_message_at = datetime.utcnow()

            db.commit()
            logger.info("=== CHAT COMPLETE (Streaming) ===\n")
            
        except Exception as e:
            db.rollback()
            logger.error(f"Streaming error: {e}")
            
            # Provide helpful error messages
            error_detail = str(e)
            if "invalid_api_key" in error_detail.lower() or "incorrect api key" in error_detail.lower():
                error_msg = "Invalid API key. Please update your API key in settings."
            elif "insufficient_quota" in error_detail.lower():
                error_msg = "API key has insufficient quota. Please check your OpenAI account."
            else:
                error_msg = f"Error: {error_detail}"
            
            yield f"data: {json.dumps({'error': error_msg})}\n\n"
            yield "data: [DONE]\n\n"
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )