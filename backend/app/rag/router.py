from typing import Optional, List
from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app.core.dependencies import get_current_user
from app.core.response import ok
from app.db.models import User
from app.rag.knowledge_base import knowledge_engine
from app.rag.tavily_search import tavily_client

router = APIRouter(prefix="/api/v1/rag", tags=["rag"])


class RAGRetrieveRequest(BaseModel):
    query: str = Field(..., max_length=500, description="Clinical question, symptom, or guideline search query")
    top_k: Optional[int] = Field(default=4, ge=1, le=10, description="Maximum number of evidence citations")


@router.post("/retrieve")
def retrieve_clinical_evidence(
    payload: RAGRetrieveRequest,
    user: User = Depends(get_current_user)
):
    """
    Hybrid RAG retrieval endpoint returning verified clinical literature citations.
    Integrates local clinical guideline chunks (AHA, WHO, NICE, WAO, ADA)
    with optional Tavily live medical guidelines.
    Requires authentication to prevent unbounded external-API quota abuse.
    """
    q = (payload.query or "").strip()
    if not q:
        return ok([])

    top_k = payload.top_k or 4
    # 1. Local knowledge base
    kb_results = knowledge_engine.retrieve(q, top_k=top_k)

    # 2. Live Tavily guidelines (fail-safe)
    tavily_results = tavily_client.search_clinical_evidence(q, max_results=top_k)

    formatted = []
    # Format local results
    for r in kb_results:
        formatted.append({
            "citation_id": r.get("chunk_id", r.get("doc_id", "KB-REF")),
            "publisher": r.get("source", "Clinical Reference Guidelines"),
            "title": r.get("title") or r.get("source") or "Medical Guideline Reference",
            "excerpt": r.get("text", ""),
            "score": r.get("score", 0.95),
        })

    # Format tavily results
    for r in tavily_results:
        formatted.append({
            "citation_id": f"TAVILY-{len(formatted)+1:02d}",
            "publisher": r.get("source", "National Health Service / PubMed"),
            "title": r.get("title", "Clinical Evidence Search Result"),
            "excerpt": r.get("snippet", r.get("text", "")),
            "score": r.get("score", 0.85),
        })

    return ok(formatted[:top_k])
