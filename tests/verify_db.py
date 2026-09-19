import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import asyncio
from app.db.database import init_db, engine
from sqlalchemy import text

async def main():
    print("Testing PostgreSQL connection & pgvector extension...")
    await init_db()
    async with engine.connect() as conn:
        res = await conn.execute(text("SELECT extname, extversion FROM pg_extension WHERE extname = 'vector';"))
        row = res.fetchone()
        if row:
            print(f"SUCCESS: pgvector extension enabled! Version: {row[1]}")
        else:
            print("ERROR: pgvector extension not found!")

if __name__ == "__main__":
    asyncio.run(main())
