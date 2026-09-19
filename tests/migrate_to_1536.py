import asyncio
import os
from sqlalchemy import text
from app.db.database import engine, AsyncSessionLocal, Base
from app.db.models import Repository, CodeChunk
from app.services.ingest import ingestion_service

async def migrate_and_reindex():
    print("[MIGRATION] Dropping old 3072-dim tables...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS code_chunks CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS repositories CASCADE;"))
        print("[MIGRATION] Creating clean tables with vector(1536)...")
        await conn.run_sync(Base.metadata.create_all)
    
    print("[MIGRATION] Tables recreated successfully!")

    # Verify column dimension
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT atttypmod 
            FROM pg_attribute 
            WHERE attrelid = 'code_chunks'::regclass AND attname = 'embedding';
        """))
        print("Verified column embedding dimension in PostgreSQL:", res.scalar_one_or_none())

        print("\n[INGEST] Ingesting local repository with OpenRouter embeddings (1536-dim)...")
        # Ingest project root directory
        workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        stats = await ingestion_service.ingest_repository(session, workspace_dir, "Production Rag")
        print("[INGEST] Local ingestion result:", stats)

if __name__ == "__main__":
    asyncio.run(migrate_and_reindex())
