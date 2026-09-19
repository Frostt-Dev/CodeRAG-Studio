import json
import asyncio
from typing import List
import httpx
from app.core.config import settings

EXPAND_PROMPT_TEMPLATE = """You are a Codebase Search Query Expander.
Given a developer's question about a codebase, decompose and expand it into 3 targeted, diverse search queries for our Hybrid (Dense Vector + BM25) retrieval engine:

1. The original query (cleaned of conversational filler)
2. An exact symbol & code signature search (e.g. likely function names, class names, API endpoints, variable names, or decorator names)
3. A technical / architectural query (e.g. underlying libraries, protocols, database schema, or algorithmic concepts)

Format your output STRICTLY as a JSON array of strings with exactly 3 items. Do not include markdown code fences or other text.
Example for "how do we check JWT tokens?":
["how do we check JWT tokens", "jwt.decode verify_token Authorization Bearer", "JWT token authentication and validation middleware"]

User Question: {query}
JSON Array:"""

class QueryExpander:
    def __init__(self):
        self.model_name = settings.OPENROUTER_MODEL
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL

    async def expand_query(self, query: str) -> List[str]:
        cleaned = query.strip()
        if len(cleaned.split()) <= 2:
            return [cleaned]

        prompt = EXPAND_PROMPT_TEMPLATE.format(query=cleaned)

        try:
            headers = {
                "Authorization": f"Bearer {self.api_key}",
                "HTTP-Referer": "http://localhost:8000",
                "X-Title": "CodeRAG Studio",
                "Content-Type": "application/json"
            }
            payload = {
                "model": self.model_name,
                "messages": [
                    {"role": "system", "content": "You are a code query decomposition engine. Output strictly a JSON array of strings."},
                    {"role": "user", "content": prompt}
                ],
                "temperature": 0.1,
                "max_tokens": 150
            }

            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    f"{self.base_url}/chat/completions",
                    headers=headers,
                    json=payload
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"].strip()
                    if raw_text.startswith("```"):
                        raw_text = raw_text.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
                    parsed = json.loads(raw_text)
                    if isinstance(parsed, list) and len(parsed) > 0:
                        queries = [cleaned]
                        for q in parsed:
                            if isinstance(q, str) and q.strip() and q.strip() not in queries:
                                queries.append(q.strip())
                        return queries[:3]
        except Exception:
            pass

        return [cleaned]

query_expander = QueryExpander()
