import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.db.database import AsyncSessionLocal
from app.services.github_ingest import github_ingest_service

async def test_github():
    print("[GITHUB] Testing in-memory GitHub ingestion...")
    repo_url = "https://github.com/octocat/Hello-World"
    async with AsyncSessionLocal() as session:
        result = await github_ingest_service.ingest_github_repo(session, repo_url)
        print("[SUCCESS] GitHub ingestion finished!")
        print("Result:", result)

if __name__ == "__main__":
    asyncio.run(test_github())
