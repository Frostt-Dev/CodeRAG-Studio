from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.db.database import get_db
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["config"])

class ConfigUpdateRequest(BaseModel):
    provider: Optional[str] = None
    chat_model: Optional[str] = None
    top_k: Optional[int] = None

@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_db)):
    db_status = "error"
    pgvector_status = "disabled"
    try:
        res = await db.execute(text("SELECT extname FROM pg_extension WHERE extname = 'vector';"))
        ext = res.scalar_one_or_none()
        db_status = "healthy"
        pgvector_status = "enabled" if ext else "missing"
    except Exception as e:
        db_status = f"unhealthy: {str(e)}"

    return {
        "status": "online",
        "database": db_status,
        "pgvector": pgvector_status,
        "provider": "openrouter",
        "chat_model": "Nemotron 3 Ultra 550B",
        "openrouter_configured": bool(settings.OPENROUTER_API_KEY)
    }

@router.get("/config")
async def get_config():
    return {
        "llm_provider": settings.LLM_PROVIDER,
        "openrouter_model": settings.OPENROUTER_MODEL,
        "openrouter_embedding_model": settings.OPENROUTER_EMBEDDING_MODEL,
        "embedding_dimension": settings.embedding_dimension,
        "top_k": settings.TOP_K,
        "rrf_k": settings.RRF_K
    }

@router.post("/config")
async def update_config(req: ConfigUpdateRequest):
    if req.provider:
        settings.LLM_PROVIDER = req.provider.lower()
    if req.chat_model:
        settings.OPENROUTER_MODEL = req.chat_model
    if req.top_k:
        settings.TOP_K = req.top_k

    return {"status": "updated", "config": await get_config()}
