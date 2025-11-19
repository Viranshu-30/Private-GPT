"""
Tavily API client for web search functionality.
Provides intelligent web search optimized for AI/LLM applications.
"""
import requests
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)


class TavilyClient:
    """Client for Tavily Search API"""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.base_url = "https://api.tavily.com"
    
    def search(
        self,
        query: str,
        search_depth: str = "basic",
        max_results: int = 5,
        include_answer: bool = True,
    ) -> Dict[str, Any]:
        """Perform web search using Tavily API"""
        try:
            payload = {
                "api_key": self.api_key,
                "query": query,
                "search_depth": search_depth,
                "max_results": min(max_results, 10),
                "include_answer": include_answer,
            }
            
            logger.info(f"🔍 Tavily search: '{query[:50]}...'")
            
            response = requests.post(
                f"{self.base_url}/search",
                json=payload,
                timeout=30
            )
            
            response.raise_for_status()
            result = response.json()
            
            logger.info(f"✅ Tavily returned {len(result.get('results', []))} results")
            
            return result
            
        except Exception as e:
            logger.error(f"❌ Tavily API error: {e}")
            return {"error": str(e), "results": [], "answer": None}
    
    def format_results_for_llm(self, search_result: Dict[str, Any]) -> str:
        """Format Tavily results for LLM context"""
        if "error" in search_result:
            return f"⚠️ Search error: {search_result['error']}"
        
        parts = []
        
        # Add AI answer
        if search_result.get("answer"):
            parts.append(f"📊 ANSWER:\n{search_result['answer']}\n")
        
        # Add search results
        results = search_result.get("results", [])
        if results:
            parts.append("🔍 WEB SEARCH RESULTS:\n")
            for idx, result in enumerate(results, 1):
                title = result.get("title", "No title")
                url = result.get("url", "")
                content = result.get("content", "")
                
                parts.append(
                    f"\n{idx}. {title}\n"
                    f"   URL: {url}\n"
                    f"   {content[:300]}...\n"
                )
        
        return "\n".join(parts)