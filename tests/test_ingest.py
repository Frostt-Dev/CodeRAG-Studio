import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import asyncio
from app.db.database import AsyncSessionLocal
from app.services.ingest import ingestion_service
from app.services.retriever import retriever_service

async def main():
    print("Testing repository ingestion on current workspace...")
    async with AsyncSessionLocal() as db:
        res = await ingestion_service.ingest_repository(
            db=db,
            repo_path=".",
            repo_name="Production Rag"
        )
        print("Ingestion Result:", res)

        print("\nTesting Hybrid Search query: 'How does CodeChunker work?'")
        chunks = await retriever_service.search(db, query="How does CodeChunker work?", top_k=3)
        for idx, c in enumerate(chunks, 1):
            print(f"Match #{idx}: {c.file_path} (L{c.start_line}-L{c.end_line}) | Score: {c.score} | Symbol: {c.symbol_name}")

if __name__ == "__main__":
    asyncio.run(main())
