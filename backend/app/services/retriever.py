import math
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from rank_bm25 import BM25Okapi
from app.db.models import CodeChunk
from app.services.embedder import embedder_service
from app.core.config import settings

class RetrievedChunk:
    def __init__(
        self,
        id: int,
        file_path: str,
        language: str,
        symbol_type: str,
        symbol_name: Optional[str],
        start_line: int,
        end_line: int,
        content: str,
        score: float,
        dense_rank: Optional[int] = None,
        bm25_rank: Optional[int] = None
    ):
        self.id = id
        self.file_path = file_path
        self.language = language
        self.symbol_type = symbol_type
        self.symbol_name = symbol_name
        self.start_line = start_line
        self.end_line = end_line
        self.content = content
        self.score = score
        self.dense_rank = dense_rank
        self.bm25_rank = bm25_rank

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "file_path": self.file_path,
            "language": self.language,
            "symbol_type": self.symbol_type,
            "symbol_name": self.symbol_name,
            "start_line": self.start_line,
            "end_line": self.end_line,
            "content": self.content,
            "score": round(self.score, 4),
            "match_percent": int(min(100, max(0, self.score * 100))),
            "dense_rank": self.dense_rank,
            "bm25_rank": self.bm25_rank,
            "citation": f"[{self.file_path}:L{self.start_line}-L{self.end_line}]"
        }


class HybridRetriever:
    def __init__(self, rrf_k: int = 60):
        self.rrf_k = rrf_k

    async def search(
        self,
        db: AsyncSession,
        query: str,
        repo_id: Optional[int] = None,
        top_k: int = 5
    ) -> List[RetrievedChunk]:
        # 1. Dense retrieval via pgvector
        query_vector = await embedder_service.get_embedding(query)
        
        # Dense query with cosine distance (<=>)
        filter_clause = f"WHERE repo_id = :repo_id" if repo_id else ""
        dense_sql = text(f"""
            SELECT id, file_path, language, symbol_type, symbol_name, 
                   start_line, end_line, content,
                   (embedding <=> :qvec) AS distance
            FROM code_chunks
            {filter_clause}
            ORDER BY distance ASC
            LIMIT :limit
        """)
        
        params = {"qvec": str(query_vector), "limit": top_k * 3}
        if repo_id:
            params["repo_id"] = repo_id
            
        dense_rows = (await db.execute(dense_sql, params)).fetchall()

        # 2. Lexical BM25 retrieval
        # Fetch candidate chunks from repo for lexical token matching
        all_chunks_sql = text(f"""
            SELECT id, file_path, language, symbol_type, symbol_name, 
                   start_line, end_line, content
            FROM code_chunks
            {filter_clause}
            LIMIT 500
        """)
        all_rows = (await db.execute(all_chunks_sql, {"repo_id": repo_id} if repo_id else {})).fetchall()

        dense_rankings: Dict[int, int] = {}
        for rank, row in enumerate(dense_rows, start=1):
            dense_rankings[row.id] = rank

        bm25_rankings: Dict[int, int] = {}
        row_lookup = {r.id: r for r in all_rows}

        if all_rows:
            corpus_tokens = [r.content.lower().split() for r in all_rows]
            bm25 = BM25Okapi(corpus_tokens)
            query_tokens = query.lower().split()
            scores = bm25.get_scores(query_tokens)
            
            # Pair IDs with scores
            ranked_pairs = sorted(zip([r.id for r in all_rows], scores), key=lambda x: x[1], reverse=True)
            for rank, (chunk_id, bm25_score) in enumerate(ranked_pairs[:top_k * 3], start=1):
                if bm25_score > 0:
                    bm25_rankings[chunk_id] = rank

        # 3. Reciprocal Rank Fusion (RRF)
        all_ids = set(dense_rankings.keys()) | set(bm25_rankings.keys())
        rrf_scores: Dict[int, float] = {}

        for cid in all_ids:
            score = 0.0
            if cid in dense_rankings:
                score += 1.0 / (self.rrf_k + dense_rankings[cid])
            if cid in bm25_rankings:
                score += 1.0 / (self.rrf_k + bm25_rankings[cid])
            rrf_scores[cid] = score

        sorted_ids = sorted(rrf_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]

        results = []
        for cid, score in sorted_ids:
            row = row_lookup.get(cid)
            if not row:
                # Might have come from dense rows
                for d in dense_rows:
                    if d.id == cid:
                        row = d
                        break
            if row:
                # Normalize RRF score to roughly 0..1 for UI display
                max_possible = 2.0 / (self.rrf_k + 1)
                normalized = min(1.0, score / max_possible)

                results.append(RetrievedChunk(
                    id=row.id,
                    file_path=row.file_path,
                    language=row.language,
                    symbol_type=row.symbol_type,
                    symbol_name=row.symbol_name,
                    start_line=row.start_line,
                    end_line=row.end_line,
                    content=row.content,
                    score=normalized,
                    dense_rank=dense_rankings.get(cid),
                    bm25_rank=bm25_rankings.get(cid)
                ))

        return results

    async def search_multi_query(
        self,
        db: AsyncSession,
        query: str,
        repo_id: Optional[int] = None,
        top_k: int = 5
    ) -> tuple[List[RetrievedChunk], List[str]]:
        """Decompose query into multiple angles, search in parallel, and fuse rankings."""
        import asyncio
        from app.services.query_expander import query_expander

        expanded_queries = await query_expander.expand_query(query)
        if len(expanded_queries) == 1:
            single_results = await self.search(db, query, repo_id, top_k)
            return single_results, expanded_queries

        # Run hybrid retrieval for all queries safely on the async session
        query_runs = []
        for q in expanded_queries:
            run = await self.search(db, q, repo_id, top_k * 2)
            query_runs.append(run)

        # Multi-query reciprocal rank fusion
        fused_scores: Dict[int, float] = {}
        chunk_map: Dict[int, RetrievedChunk] = {}

        for run in query_runs:
            for rank, chunk in enumerate(run, start=1):
                fused_scores[chunk.id] = fused_scores.get(chunk.id, 0.0) + (1.0 / (self.rrf_k + rank))
                if chunk.id not in chunk_map:
                    chunk_map[chunk.id] = chunk

        # Sort and take top_k
        sorted_items = sorted(fused_scores.items(), key=lambda x: x[1], reverse=True)[:top_k]
        final_chunks = []
        max_possible = len(expanded_queries) * (1.0 / (self.rrf_k + 1))

        for cid, score in sorted_items:
            chunk = chunk_map[cid]
            chunk.score = min(1.0, score / max_possible)
            final_chunks.append(chunk)

        return final_chunks, expanded_queries

retriever_service = HybridRetriever()
