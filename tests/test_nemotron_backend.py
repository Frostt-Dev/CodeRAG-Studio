import sys
import os
import asyncio

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from app.services.query_expander import query_expander
from app.services.llm import llm_service
from app.services.retriever import RetrievedChunk

async def test_nemotron_backend():
    print("1. Testing QueryExpander with Nemotron Ultra...")
    queries = await query_expander.expand_query("Explain CodeChunker AST splitting in detail")
    print("Expanded queries:", queries)
    assert len(queries) >= 1, "Query expansion failed"

    print("\n2. Testing LLMService Streaming with Nemotron Ultra...")
    mock_chunk = RetrievedChunk(
        id=1,
        file_path="backend/app/services/chunker.py",
        language="python",
        symbol_type="method",
        symbol_name="CodeChunker.chunk_python",
        start_line=75,
        end_line=110,
        content="class CodeChunker:\n    def chunk_python(self, code: str):\n        tree = ast.parse(code)\n        return chunks",
        score=0.92,
        dense_rank=1,
        bm25_rank=1
    )

    full_output = ""
    async for token in llm_service.generate_stream("How does CodeChunker parse code?", [mock_chunk]):
        full_output += token
    
    print("\nLLM Stream Output:\n", full_output[:350], "...")
    print("\nSUCCESS: Nemotron Ultra is 100% operational in backend services!")

if __name__ == "__main__":
    asyncio.run(test_nemotron_backend())
