import asyncio
import os
from app.db.database import AsyncSessionLocal
from app.services.ingest import ingestion_service

async def main():
    print("[START] Running local repository ingestion...")
    workspace_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    print(f"Target directory: {workspace_dir}")
    
    async with AsyncSessionLocal() as session:
        result = await ingestion_service.ingest_repository(session, workspace_dir, "Production Rag")
        print("[SUCCESS] Local ingestion finished!")
        print("Indexed files:", result["indexed_files"])
        print("Total chunks:", result["total_chunks"])
        print("Duration:", result["duration_seconds"], "seconds")

if __name__ == "__main__":
    asyncio.run(main())
