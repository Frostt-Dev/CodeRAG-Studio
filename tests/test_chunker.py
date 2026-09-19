import sys
import os
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.chunker import CodeChunker

def test_python_ast_chunking():
    chunker = CodeChunker()
    code = """
import os

def calculate_hash(data: str) -> str:
    \"\"\"Calculate sha256 hash.\"\"\"
    return "hash123"

class AuthService:
    \"\"\"Handles authentication.\"\"\"
    def __init__(self, secret: str):
        self.secret = secret

    def verify(self, token: str) -> bool:
        return token == self.secret
"""
    chunks = chunker.chunk_file("test_auth.py", code)
    assert len(chunks) >= 2

    # Check function chunk
    func_chunk = next((c for c in chunks if c.symbol_name == "calculate_hash"), None)
    assert func_chunk is not None
    assert func_chunk.symbol_type == "function"
    assert "calculate_hash" in func_chunk.content

    # Check class chunk
    class_chunk = next((c for c in chunks if "AuthService" in (c.symbol_name or "")), None)
    assert class_chunk is not None

def test_markdown_chunking():
    chunker = CodeChunker()
    md = """
# Overview
This is the system overview.

## Architecture
The system uses pgvector and BM25.

### Database
PostgreSQL 16 with pgvector extension.
"""
    chunks = chunker.chunk_file("docs/architecture.md", md)
    assert len(chunks) == 3
    assert chunks[0].symbol_name == "Overview"
    assert chunks[1].symbol_name == "Architecture"
    assert chunks[2].symbol_name == "Database"
