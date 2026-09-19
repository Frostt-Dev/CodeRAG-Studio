import asyncio
from sqlalchemy import text
from app.db.database import AsyncSessionLocal

async def check_db_dim():
    async with AsyncSessionLocal() as session:
        res = await session.execute(text("""
            SELECT atttypmod 
            FROM pg_attribute 
            WHERE attrelid = 'code_chunks'::regclass AND attname = 'embedding';
        """))
        print("Column embedding type modifier (dimension):", res.scalar_one_or_none())

if __name__ == "__main__":
    asyncio.run(check_db_dim())
