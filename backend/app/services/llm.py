import asyncio
from typing import List, AsyncGenerator
from openai import AsyncOpenAI
from app.core.config import settings
from app.services.retriever import RetrievedChunk

SYSTEM_PROMPT = """You are CodeRAG Studio, an elite developer AI assistant for codebase intelligence and documentation retrieval.
Your task is to answer questions thoroughly and accurately using the provided code snippets.

Guidelines:
1. Answer using the provided context chunks. If information is not in the context, state that clearly.
2. ALWAYS include clickable citations in the format `[filepath:Lstart-Lend]` whenever referencing code, functions, classes, or configuration. Example: `[src/auth/jwt.py:L45-L62]`.
3. Include well-formatted code blocks with syntax highlighting tags (` ```python `, ` ```typescript `, etc.).
4. Be direct, clear, and technically precise.
"""

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(
            api_key=settings.OPENROUTER_API_KEY or "none",
            base_url=settings.OPENROUTER_BASE_URL,
            default_headers={
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "CodeRAG Studio"
            }
        )
        self.model_name = settings.OPENROUTER_MODEL

    def build_prompt(self, query: str, chunks: List[RetrievedChunk]) -> str:
        context_blocks = []
        for idx, c in enumerate(chunks, 1):
            context_blocks.append(
                f"--- SOURCE CHUNK #{idx}: {c.file_path} (Lines {c.start_line}-{c.end_line}) ---\n"
                f"Language: {c.language} | Symbol: {c.symbol_name or 'block'}\n"
                f"Code:\n```\n{c.content}\n```\n"
            )
        
        context_str = "\n".join(context_blocks)
        prompt = (
            f"{SYSTEM_PROMPT}\n\n"
            f"=== RETRIEVED CONTEXT CHUNKS ===\n"
            f"{context_str}\n\n"
            f"=== USER QUESTION ===\n"
            f"{query}\n\n"
            f"=== ANSWER (with [file:Lstart-Lend] citations) ==="
        )
        return prompt

    async def generate_stream(
        self,
        query: str,
        chunks: List[RetrievedChunk]
    ) -> AsyncGenerator[str, None]:
        prompt = self.build_prompt(query, chunks)

        try:
            stream = await self.client.chat.completions.create(
                model=self.model_name,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=2048,
                temperature=0.2,
                stream=True
            )
            async for chunk in stream:
                content = chunk.choices[0].delta.content or ""
                if content:
                    yield content
        except Exception as e:
            yield f"\n[Generation error: {str(e)}]"

llm_service = LLMService()
