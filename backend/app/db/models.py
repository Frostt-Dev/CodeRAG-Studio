import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship
from pgvector.sqlalchemy import Vector
from app.db.database import Base
from app.core.config import settings

class Repository(Base):
    __tablename__ = "repositories"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    path = Column(String(1024), unique=True, nullable=False)
    file_count = Column(Integer, default=0)
    chunk_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    indexed_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    chunks = relationship("CodeChunk", back_populates="repository", cascade="all, delete-orphan")


class CodeChunk(Base):
    __tablename__ = "code_chunks"

    id = Column(Integer, primary_key=True, index=True)
    repo_id = Column(Integer, ForeignKey("repositories.id", ondelete="CASCADE"), nullable=False, index=True)
    file_path = Column(String(1024), nullable=False, index=True)
    language = Column(String(50), nullable=False, index=True)
    symbol_type = Column(String(50), default="code_block") # function, class, doc, block
    symbol_name = Column(String(255), nullable=True)
    start_line = Column(Integer, nullable=False)
    end_line = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    content_hash = Column(String(64), nullable=False, index=True)
    
    # Vector embedding with dynamic dimension (768 for Gemini, 1536 for OpenAI)
    embedding = Column(Vector(settings.embedding_dimension), nullable=False)
    
    token_count = Column(Integer, default=0)
    meta_info = Column(JSON, default={})
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    repository = relationship("Repository", back_populates="chunks")

    __table_args__ = (
        Index("ix_code_chunks_file_lines", "file_path", "start_line", "end_line"),
    )
