import os
from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    # Database (PostgreSQL + pgvector via Docker)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/coderag"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/coderag"

    # LLM & Embeddings Provider (OpenRouter with NVIDIA Nemotron)
    LLM_PROVIDER: str = "openrouter"

    # OpenRouter API Configuration
    OPENROUTER_API_KEY: Optional[str] = None
    OPENROUTER_MODEL: str = "nvidia/nemotron-3-ultra-550b-a55b:free"
    OPENROUTER_EMBEDDING_MODEL: str = "text-embedding-3-small"
    OPENROUTER_BASE_URL: str = "https://openrouter.ai/api/v1"

    # Retrieval Configuration
    TOP_K: int = 5
    CHUNK_SIZE: int = 600
    CHUNK_OVERLAP: int = 100
    RRF_K: int = 60  # Reciprocal Rank Fusion constant

    # App Settings
    APP_HOST: str = "127.0.0.1"
    APP_PORT: int = 8000
    DEBUG: bool = True

    @property
    def embedding_dimension(self) -> int:
        return 1536

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
