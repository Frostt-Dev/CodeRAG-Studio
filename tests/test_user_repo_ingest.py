import sys
import os
import asyncio

# Ensure backend directory is in Python module search path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.database import AsyncSessionLocal
from app.services.github_ingest import github_ingest_service

async def test_user_repo():
    print("[TEST] Ingesting https://github.com/rounakkumarsah/Production-RAG-Agent in-memory...")
    async with AsyncSessionLocal() as session:
        result = await github_ingest_service.ingest_github_repo(session, "https://github.com/rounakkumarsah/Production-RAG-Agent")
        print("[SUCCESS] Result:", result)

if __name__ == "__main__":
    # Handle Windows asyncio loop cleanup cleanly
    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(test_user_repo())
