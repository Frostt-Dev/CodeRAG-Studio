from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.db.database import get_db
from app.db.models import Repository, CodeChunk
from app.services.ingest import ingestion_service
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["ingest"])

class IngestRequest(BaseModel):
    repo_path: str
    repo_name: Optional[str] = None

class GitHubIngestRequest(BaseModel):
    repo_url: str
    branch: Optional[str] = None
    token: Optional[str] = None

@router.post("/ingest")
async def ingest_repo(req: IngestRequest, db: AsyncSession = Depends(get_db)):
    try:
        result = await ingestion_service.ingest_repository(
            db=db,
            repo_path=req.repo_path,
            repo_name=req.repo_name
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/ingest/github")
async def ingest_github(req: GitHubIngestRequest, db: AsyncSession = Depends(get_db)):
    from app.services.github_ingest import github_ingest_service
    try:
        result = await github_ingest_service.ingest_github_repo(
            db=db,
            repo_url=req.repo_url,
            branch=req.branch,
            token=req.token
        )
        return {"status": "success", "data": result}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/repositories")
async def list_repositories(db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(Repository).order_by(Repository.indexed_at.desc()))
    repos = res.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "path": r.path,
            "file_count": r.file_count,
            "chunk_count": r.chunk_count,
            "indexed_at": r.indexed_at.isoformat() if r.indexed_at else None
        }
        for r in repos
    ]

@router.get("/repository/{repo_id}/files")
async def get_repository_files(repo_id: int, db: AsyncSession = Depends(get_db)):
    # Group chunks by file_path
    res = await db.execute(
        select(
            CodeChunk.file_path,
            CodeChunk.language,
            func.count(CodeChunk.id).label("chunk_count"),
            func.min(CodeChunk.start_line).label("min_line"),
            func.max(CodeChunk.end_line).label("max_line")
        )
        .where(CodeChunk.repo_id == repo_id)
        .group_by(CodeChunk.file_path, CodeChunk.language)
        .order_by(CodeChunk.file_path.asc())
    )
    files = res.fetchall()
    return [
        {
            "file_path": f.file_path,
            "language": f.language,
            "chunk_count": f.chunk_count,
            "lines": f"{f.min_line}-{f.max_line}"
        }
        for f in files
    ]

@router.get("/chunk/{chunk_id}")
async def get_chunk_details(chunk_id: int, db: AsyncSession = Depends(get_db)):
    chunk = (await db.execute(select(CodeChunk).where(CodeChunk.id == chunk_id))).scalar_one_or_none()
    if not chunk:
        raise HTTPException(status_code=404, detail="Chunk not found")

    return {
        "id": chunk.id,
        "repo_id": chunk.repo_id,
        "file_path": chunk.file_path,
        "language": chunk.language,
        "symbol_type": chunk.symbol_type,
        "symbol_name": chunk.symbol_name,
        "start_line": chunk.start_line,
        "end_line": chunk.end_line,
        "content": chunk.content,
        "token_count": chunk.token_count,
        "meta_info": chunk.meta_info,
        "created_at": chunk.created_at.isoformat() if chunk.created_at else None
    }

@router.get("/stats")
async def get_system_stats(db: AsyncSession = Depends(get_db)):
    total_repos = (await db.execute(select(func.count(Repository.id)))).scalar_one()
    total_chunks = (await db.execute(select(func.count(CodeChunk.id)))).scalar_one()

    return {
        "total_repositories": total_repos,
        "total_chunks": total_chunks,
        "provider": "openrouter",
        "chat_model": "Nemotron 3 Ultra 550B",
        "embedding_model": settings.OPENROUTER_EMBEDDING_MODEL,
        "embedding_dimension": settings.embedding_dimension,
        "database": "PostgreSQL + pgvector"
    }
