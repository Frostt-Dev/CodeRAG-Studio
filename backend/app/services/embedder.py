import asyncio
from typing import List
import httpx
from app.core.config import settings

class EmbedderService:
    def __init__(self):
        self.dimension = settings.embedding_dimension
        self.model_name = settings.OPENROUTER_EMBEDDING_MODEL
        self.api_key = settings.OPENROUTER_API_KEY
        self.base_url = settings.OPENROUTER_BASE_URL

    async def get_embedding(self, text: str) -> List[float]:
        results = await self.get_embeddings_batch([text])
        return results[0] if results else [0.0] * self.dimension

    async def get_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        if not texts:
            return []

        # Sanitize and truncate overly long snippets
        cleaned = [t[:8000].strip() or " " for t in texts]

        # Batch in chunks of 50 to optimize network roundtrips
        batch_size = 50
        all_embeddings: List[List[float]] = []

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "HTTP-Referer": "http://localhost:8000",
            "X-Title": "CodeRAG Studio",
            "Content-Type": "application/json"
        }

        async with httpx.AsyncClient(timeout=45.0) as client:
            for i in range(0, len(cleaned), batch_size):
                batch = cleaned[i : i + batch_size]
                payload = {
                    "model": self.model_name,
                    "input": batch
                }

                # Resilient retry mechanism
                success = False
                last_err = None
                for attempt in range(3):
                    try:
                        resp = await client.post(
                            f"{self.base_url}/embeddings",
                            headers=headers,
                            json=payload
                        )
                        if resp.status_code == 200:
                            data = resp.json()
                            items = data.get("data", [])
                            items.sort(key=lambda x: x.get("index", 0))
                            batch_vectors = [item["embedding"] for item in items]
                            all_embeddings.extend(batch_vectors)
                            success = True
                            break
                        else:
                            last_err = f"OpenRouter embedding failed ({resp.status_code}): {resp.text}"
                    except Exception as e:
                        last_err = str(e)
                    
                    if attempt < 2:
                        await asyncio.sleep(1.0 * (attempt + 1))

                if not success:
                    raise RuntimeError(f"Embedding service error: {last_err}")

        return all_embeddings

embedder_service = EmbedderService()
