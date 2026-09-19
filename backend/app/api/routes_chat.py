import json
import time
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.database import get_db
from app.services.retriever import retriever_service
from app.services.llm import llm_service
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["chat"])

class ChatRequest(BaseModel):
    query: str
    repo_id: Optional[int] = None
    top_k: Optional[int] = None

@router.post("/chat/stream")
async def chat_stream(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    top_k = req.top_k or settings.TOP_K

    # 1. Retrieve hybrid chunks with multi-query expansion
    try:
        chunks, expanded_queries = await retriever_service.search_multi_query(
            db=db,
            query=req.query,
            repo_id=req.repo_id,
            top_k=top_k
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Retrieval failed: {str(e)}")

    retrieval_latency = int((time.time() - start_time) * 1000)

    async def event_generator():
        # First event: Send retrieved chunks, expanded queries & metrics
        chunk_dicts = [c.to_dict() for c in chunks]
        init_payload = {
            "type": "retrieval",
            "chunks": chunk_dicts,
            "count": len(chunk_dicts),
            "expanded_queries": expanded_queries,
            "retrieval_latency_ms": retrieval_latency
        }
        yield f"data: {json.dumps(init_payload)}\n\n"

        # Second phase: Stream LLM response
        token_count = 0
        try:
            async for token in llm_service.generate_stream(req.query, chunks):
                token_count += 1
                token_payload = {
                    "type": "token",
                    "content": token
                }
                yield f"data: {json.dumps(token_payload)}\n\n"
        except Exception as e:
            err_payload = {"type": "error", "content": str(e)}
            yield f"data: {json.dumps(err_payload)}\n\n"

        # Final event: Done
        total_latency = int((time.time() - start_time) * 1000)
        done_payload = {
            "type": "done",
            "total_latency_ms": total_latency,
            "retrieval_latency_ms": retrieval_latency
        }
        yield f"data: {json.dumps(done_payload)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )

@router.post("/chat")
async def chat_sync(req: ChatRequest, db: AsyncSession = Depends(get_db)):
    start_time = time.time()
    top_k = req.top_k or settings.TOP_K
    chunks = await retriever_service.search(db=db, query=req.query, repo_id=req.repo_id, top_k=top_k)
    retrieval_latency = int((time.time() - start_time) * 1000)

    # Collect streamed response into single string
    response_tokens = []
    async for token in llm_service.generate_stream(req.query, chunks):
        response_tokens.append(token)

    total_latency = int((time.time() - start_time) * 1000)
    return {
        "query": req.query,
        "answer": "".join(response_tokens),
        "chunks": [c.to_dict() for c in chunks],
        "telemetry": {
            "retrieval_latency_ms": retrieval_latency,
            "total_latency_ms": total_latency
        }
    }
