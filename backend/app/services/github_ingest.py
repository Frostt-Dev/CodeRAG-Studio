import re
import io
import time
import zipfile
import httpx
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, func
from app.db.models import Repository, CodeChunk
from app.services.chunker import CodeChunker
from app.services.embedder import embedder_service
from app.services.ingest import IGNORE_DIRS, IGNORE_EXTENSIONS, SUPPORTED_EXTENSIONS, hash_content

class GitHubIngestService:
    def __init__(self):
        self.chunker = CodeChunker()

    def parse_repo_url(self, url: str) -> tuple[str, str]:
        """Extract owner and repo name from GitHub URL."""
        cleaned = url.strip()
        match = re.search(r"github\.com[/:]([A-Za-z0-9_.-]+)/([A-Za-z0-9_.-]+?)(?:\.git|/)?$", cleaned)
        if not match:
            raise ValueError(f"Invalid GitHub URL format: '{url}'. Expected format: 'https://github.com/owner/repo'")
        return match.group(1), match.group(2)

    async def ingest_github_repo(
        self,
        db: AsyncSession,
        repo_url: str,
        branch: Optional[str] = None,
        token: Optional[str] = None
    ) -> Dict[str, Any]:
        """Download GitHub repository as in-memory zipball and index directly into PostgreSQL (zero disk writes)."""
        start_time = time.time()
        owner, repo_name = self.parse_repo_url(repo_url)
        full_repo_id = f"github.com/{owner}/{repo_name}"

        # 1. Download zip stream from GitHub into RAM
        zip_url = f"https://api.github.com/repos/{owner}/{repo_name}/zipball/{branch or ''}"
        headers = {
            "User-Agent": "CodeRAG-Studio/2.5",
            "Accept": "application/vnd.github.v3+json"
        }
        if token and token.strip():
            headers["Authorization"] = f"Bearer {token.strip()}"

        async with httpx.AsyncClient(follow_redirects=True, timeout=60.0) as client:
            resp = await client.get(zip_url, headers=headers)
            if resp.status_code == 404:
                raise ValueError(f"Repository '{owner}/{repo_name}' not found on GitHub. If private, please provide a Personal Access Token.")
            elif resp.status_code in (401, 403):
                raise ValueError(f"GitHub authentication error ({resp.status_code}): {resp.text}")
            elif resp.status_code != 200:
                raise ValueError(f"Failed to fetch repo from GitHub ({resp.status_code}): {resp.text[:200]}")

            zip_bytes = resp.content

        # 2. Get or create Repository record in DB
        res = await db.execute(select(Repository).where(Repository.path == full_repo_id))
        repo = res.scalar_one_or_none()
        if not repo:
            repo = Repository(name=f"{owner}/{repo_name}", path=full_repo_id)
            db.add(repo)
            await db.commit()
            await db.refresh(repo)

        indexed_files = 0
        skipped_files = 0

        # Data structure: [(rel_path, content_hash, [RawChunk, ...])]
        files_to_index = []

        # 3. Read files in-memory from zip archive and chunk them
        with zipfile.ZipFile(io.BytesIO(zip_bytes)) as zf:
            file_names = zf.namelist()
            if not file_names:
                raise ValueError("Repository archive is empty.")

            prefix = file_names[0].split("/")[0] + "/"

            for member in zf.infolist():
                if member.is_dir():
                    continue

                rel_path = member.filename
                if rel_path.startswith(prefix):
                    rel_path = rel_path[len(prefix):]

                parts = rel_path.split("/")
                if any(p in IGNORE_DIRS or p.startswith(".") for p in parts[:-1]):
                    continue

                filename = parts[-1]
                ext = "." + filename.split(".")[-1].lower() if "." in filename else ""
                if ext in IGNORE_EXTENSIONS:
                    continue
                if ext not in SUPPORTED_EXTENSIONS and not filename.endswith("file"):
                    continue

                try:
                    with zf.open(member) as f:
                        content = f.read().decode("utf-8", errors="ignore")
                except Exception:
                    continue

                if not content.strip():
                    continue

                content_hash = hash_content(content)

                # Incremental check: is this file already indexed with identical hash?
                existing = (await db.execute(
                    select(CodeChunk.id)
                    .where(CodeChunk.repo_id == repo.id, CodeChunk.file_path == rel_path, CodeChunk.content_hash == content_hash)
                    .limit(1)
                )).scalar_one_or_none()

                if existing:
                    skipped_files += 1
                    continue

                # Remove old chunks for this file
                await db.execute(
                    delete(CodeChunk).where(CodeChunk.repo_id == repo.id, CodeChunk.file_path == rel_path)
                )

                raw_chunks = self.chunker.chunk_file(rel_path, content)
                if raw_chunks:
                    files_to_index.append((rel_path, content_hash, raw_chunks))

        # 4. Global High-Throughput Batch Embedding across all chunks
        all_raw_chunks = []
        for _, _, chunks in files_to_index:
            all_raw_chunks.extend(chunks)

        new_chunks_count = len(all_raw_chunks)

        if all_raw_chunks:
            all_texts = [c.content for c in all_raw_chunks]
            # Embed all chunks in optimized batches of 50 via OpenRouter
            all_embeddings = await embedder_service.get_embeddings_batch(all_texts)

            # Insert chunks with embeddings into PostgreSQL
            idx = 0
            for rel_path, content_hash, chunks in files_to_index:
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
                        meta_info={"github_repo": f"{owner}/{repo_name}", "branch": branch or "default"}
                    )
                    db.add(chunk_row)
                indexed_files += 1

            await db.commit()

        # Update repository stats
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
            "repo_url": repo_url,
            "mode": "in_memory_stream (zero disk)",
            "indexed_files": indexed_files,
            "skipped_files": skipped_files,
            "total_files": repo.file_count,
            "new_chunks": new_chunks_count,
            "total_chunks": total_chunks,
            "duration_seconds": elapsed
        }

github_ingest_service = GitHubIngestService()
