import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import asyncio
from app.db.database import engine, Base, init_db
from sqlalchemy import text

async def main():
    print("Dropping existing tables and recreating with Vector(3072)...")
    async with engine.begin() as conn:
        await conn.execute(text("DROP TABLE IF EXISTS code_chunks CASCADE;"))
        await conn.execute(text("DROP TABLE IF EXISTS repositories CASCADE;"))
    await init_db()
    print("SUCCESS: Tables recreated successfully with pgvector 3072-dim embeddings.")

if __name__ == "__main__":
    asyncio.run(main())
