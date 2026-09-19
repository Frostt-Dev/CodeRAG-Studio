import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.core.config import settings
from app.db.database import init_db
from app.api.routes_chat import router as chat_router
from app.api.routes_ingest import router as ingest_router
from app.api.routes_config import router as config_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & pgvector extension on startup
    print("[INIT] Initializing PostgreSQL connection & pgvector extension...")
    try:
        await init_db()
        print("[OK] Database & pgvector initialized successfully.")
    except Exception as e:
        print(f"[WARN] Warning during database init: {e}")
    yield

app = FastAPI(
    title="CodeRAG Studio API",
    version="2.4.0",
    description="Production-grade Codebase & Documentation RAG System with PostgreSQL + pgvector",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(chat_router)
app.include_router(ingest_router)
app.include_router(config_router)

# Mount Frontend (Vite dist bundle with fallback)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend"))
dist_dir = os.path.join(frontend_dir, "dist")
static_dir = dist_dir if os.path.exists(os.path.join(dist_dir, "index.html")) else frontend_dir

if os.path.exists(os.path.join(dist_dir, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(dist_dir, "assets")), name="assets")

if os.path.exists(frontend_dir):
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

@app.get("/")
async def serve_index():
    target_index = os.path.join(dist_dir, "index.html") if os.path.exists(os.path.join(dist_dir, "index.html")) else os.path.join(frontend_dir, "index.html")
    return FileResponse(target_index)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=settings.DEBUG)
