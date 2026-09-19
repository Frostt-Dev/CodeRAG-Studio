import os
import hashlib
import time
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.db.models import Repository, CodeChunk
from app.services.chunker import CodeChunker
from app.services.embedder import embedder_service

IGNORE_DIRS = {
    ".git", "node_modules", "__pycache__", ".venv", "venv", 
    "dist", "build", ".gemini", "pgvector_data", "coverage", 
    ".idea", ".vscode", "egg-info"
}

IGNORE_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
    ".zip", ".tar", ".gz", ".rar", ".7z",
    ".exe", ".dll", ".so", ".dylib", ".bin",
    ".pyc", ".pyo", ".pyd", ".whl",
    ".mp4", ".mp3", ".wav", ".pdf", ".lock"
}

SUPPORTED_EXTENSIONS = {
    ".py", ".js", ".jsx", ".ts", ".tsx", ".go", ".rs", ".java",
    ".sql", ".md", ".json", ".yaml", ".yml", ".html", ".css",
    ".sh", ".txt", ".env.example", ".toml"
}

def hash_content(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()

class IngestionService:
    def __init__(self):
        self.chunker = CodeChunker()

    async def ingest_repository(
        self,
        db: AsyncSession,
        repo_path: str,
        repo_name: Optional[str] = None
    ) -> Dict[str, Any]:
        start_time = time.time()
        abs_path = os.path.abspath(repo_path)
        if not os.path.exists(abs_path) or not os.path.isdir(abs_path):
            raise ValueError(f"Directory not found: {repo_path}")

        name = repo_name or os.path.basename(abs_path) or "root_repo"

        # 1. Get or create Repository in DB
        res = await db.execute(select(Repository).where(Repository.path == abs_path))
        repo = res.scalar_one_or_none()
        if not repo:
            repo = Repository(name=name, path=abs_path)
            db.add(repo)
            await db.commit()
            await db.refresh(repo)

        indexed_files = 0
        skipped_files = 0
        files_to_index = []

        # 2. Walk directory
        for root, dirs, files in os.walk(abs_path):
            # Prune ignored dirs in-place
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS and not d.startswith(".")]

            for file in files:
                ext = os.path.splitext(file)[1].lower()
                if ext in IGNORE_EXTENSIONS:
                    continue
                if ext not in SUPPORTED_EXTENSIONS and not file.endswith("file"):
                    continue

                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, abs_path).replace("\\", "/")

                try:
                    with open(full_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                except Exception:
                    continue

                if not content.strip():
                    continue

                content_hash = hash_content(content)

                # Incremental check: has this file changed?
                existing = (await db.execute(
                    select(CodeChunk.id)
                    .where(CodeChunk.repo_id == repo.id, CodeChunk.file_path == rel_path, CodeChunk.content_hash == content_hash)
                    .limit(1)
                )).scalar_one_or_none()

                if existing:
                    skipped_files += 1
                    continue

                # File is new or changed: clear old chunks for this file
                await db.execute(
                    delete(CodeChunk).where(CodeChunk.repo_id == repo.id, CodeChunk.file_path == rel_path)
                )

                # Chunk file
                raw_chunks = self.chunker.chunk_file(rel_path, content)
                if raw_chunks:
                    files_to_index.append((rel_path, full_path, content_hash, raw_chunks))

        # 3. Global batch embedding across all chunks
        all_raw_chunks = []
        for _, _, _, chunks in files_to_index:
            all_raw_chunks.extend(chunks)

        new_chunks_count = len(all_raw_chunks)

        if all_raw_chunks:
            all_texts = [c.content for c in all_raw_chunks]
            all_embeddings = await embedder_service.get_embeddings_batch(all_texts)

            idx = 0
            for rel_path, full_path, content_hash, chunks in files_to_index:
                for c in chunks:
                    emb = all_embeddings[idx]
                    idx += 1
                    chunk_row = CodeChunk(
                        repo_id=repo.id,
                        file_path=c.file_path,
                        language=c.language,
                        symbol_type=c.symbol_type,
                        symbol_name=c.symbol_name,
                        start_line=c.start_line,
                        end_line=c.end_line,
                        content=c.content,
                        content_hash=content_hash,
                        embedding=emb,
                        token_count=c.token_count,
                        meta_info={"full_path": full_path}
                    )
                    db.add(chunk_row)
                indexed_files += 1

            await db.commit()

        # Update repo stats
        total_chunks = (await db.execute(
            select(func.count(CodeChunk.id)).where(CodeChunk.repo_id == repo.id)
        )).scalar_one()

        repo.file_count = indexed_files + skipped_files
        repo.chunk_count = total_chunks
        await db.commit()

        elapsed = round(time.time() - start_time, 2)
        return {
            "repo_id": repo.id,
            "repo_name": repo.name,
            "repo_path": repo.path,
            "indexed_files": indexed_files,
            "skipped_files": skipped_files,
            "total_files": repo.file_count,
            "new_chunks": new_chunks_count,
            "total_chunks": total_chunks,
            "duration_seconds": elapsed
        }

ingestion_service = IngestionService()
