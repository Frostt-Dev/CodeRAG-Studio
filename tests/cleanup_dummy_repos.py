import asyncio
import sys
import os

sys.path.insert(0, os.path.abspath("backend"))

from app.db.database import AsyncSessionLocal
from app.db.models import Repository
from sqlalchemy import delete

async def clean():
    async with AsyncSessionLocal() as db:
        await db.execute(delete(Repository).where(Repository.id == 2))
        await db.commit()
        print("Successfully removed dummy repository")

if __name__ == "__main__":
    asyncio.run(clean())
