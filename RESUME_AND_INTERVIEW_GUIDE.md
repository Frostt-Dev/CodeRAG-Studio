# CodeRAG Studio: Resume & Interview Preparation Guide

---

## 1. Resume Section (Ready to Copy-Paste)

### Project Title & Tech Stack
**CodeRAG Studio — Enterprise Codebase Intelligence & Hybrid AST RAG Platform**  
*Technologies:* Python, FastAPI, PostgreSQL (pgvector, HNSW), React 18, TypeScript, Vite, TailwindCSS, NVIDIA Nemotron 3 Ultra 550B, OpenRouter, Tree-Sitter / AST Parsing, BM25, Reciprocal Rank Fusion (RRF), Server-Sent Events (SSE), Docker.

### Bullet Points for Resume (Tailor for Software Engineer / AI / Backend Roles)
- **Architected and deployed a production-grade Code RAG system** enabling semantic search and reasoning over local and public GitHub repositories, indexing 800+ code chunks with sub-second hybrid retrieval.
- **Engineered a zero-disk in-memory GitHub ingestion pipeline** using HTTP zipball streaming (`io.BytesIO` + `zipfile`) that parses, chunks, and indexes codebases 100% in RAM, eliminating cloud disk I/O and clone overhead.
- **Designed language-aware AST chunking & SHA-256 incremental hashing** to preserve function and class boundaries, skipping unchanged files to reduce embedding token costs by over 70%.
- **Implemented a hybrid retrieval engine combining dense vector embeddings (1536-dim) with sparse BM25 keyword search** using Reciprocal Rank Fusion (RRF), resolving the limitation of vector search on exact syntax identifiers.
- **Integrated multi-query expansion and real-time SSE streaming** powered by NVIDIA Nemotron 3 Ultra 550B, providing line-level AST citations (`file:L#–L#`) and an interactive split-screen Source Inspector.
- **Optimized embedding throughput via global batching** (50 items/batch with exponential backoff), accelerating end-to-end repository indexing from minutes to ~20 seconds.

---

## 2. Project Explanation in Simple Words (The "Elevator Pitch")

### What is the problem?
When developers join a new project or work on large legacy codebases (thousands of files), finding how things work is painful. Generic AI chatbots (like ChatGPT) can't see private repos, hallucinate function names, and don't cite exact line numbers. Simple text search (like `Ctrl+F` or `grep`) only finds exact words and misses conceptual meanings (e.g., searching for *"how is authentication verified"* won't match a function named `validate_bearer_jwt`).

### What does this project do?
**CodeRAG Studio** is a private, intelligent codebase assistant. You give it any GitHub repo URL or local directory path, and it indexes the entire codebase into a vector database. You can then ask questions in plain English (*"How does this project handle database migrations?"* or *"Explain the payment webhook flow"*). The AI immediately responds in streaming real-time, cites the exact source files and line ranges, and lets you inspect and copy the code in a side-by-side inspector.

### How does it work step-by-step?
1. **Ingestion & AST Chunking**:
   - Instead of dumb chunking (e.g. splitting every 500 words and cutting functions in half), the system parses code according to grammar rules. Each chunk represents a complete function, class, or logical block.
2. **Hashing for Speed**:
   - Each file is hashed with SHA-256. If a file didn't change, it skips re-embedding it, saving API costs and time.
3. **In-Memory Streaming**:
   - For GitHub repos, instead of running a slow `git clone` to the server's hard drive, it downloads the repo zipball directly into RAM, unpacks it in memory, and writes nothing to disk.
4. **Hybrid Search (Vector + BM25)**:
   - Code contains both **meaning** (*"connect to database"*) and **exact symbols** (`def get_db_conn()`).
   - We use **Dense Vector Search** (using 1536-dim embeddings) for semantic understanding + **BM25 Search** for exact syntax.
   - A mathematical formula called **Reciprocal Rank Fusion (RRF)** combines both rankings to return the most relevant snippets.
5. **NVIDIA Nemotron 3 Ultra 550B Generation**:
   - The query and the retrieved code chunks are fed to NVIDIA's 550B Nemotron model via OpenRouter.
   - The AI generates a streaming Markdown response, embedding clickable citations (`[app/main.py:L20-L45]`).
6. **Frontend Experience**:
   - Built with React, TypeScript, and TailwindCSS. Features resizable sidebars, dark/light warm aesthetic, workspace switching, and an interactive Source Inspector drawer.

---

## 3. Top Technical Interview Questions & Answers

### Q1: Why did you build a Hybrid Search engine instead of relying solely on Vector Embeddings?
**Answer:**  
"Standard vector embeddings excel at capturing conceptual semantics (e.g. knowing that 'initialize database' relates to `create_engine()`), but they perform poorly on exact programming keywords, specific variable names, error codes, and unique identifiers (e.g. `ERR_AUTH_TOKEN_EXPIRED`).  
BM25 (sparse keyword search) excels at exact string token matches but understands zero semantics.  
By using **Reciprocal Rank Fusion (RRF)**:
$$RRF\\_Score(d) = \\sum_{m \\in \\{Dense, BM25\\}} \\frac{1}{60 + rank_m(d)}$$  
we normalize and merge rankings from both retrieval systems. This guarantees that whether a user asks a conceptual question or searches for a specific function name, the top retrieved code chunks are always accurate."

---

### Q2: Why did you implement in-memory streaming for GitHub repos instead of shallow cloning (`git clone --depth 1`)?
**Answer:**  
"In cloud-native or containerized environments (like AWS ECS, Kubernetes, or serverless functions):
1. Disk space is limited and ephemeral. Running `git clone` fills server disks and requires garbage collection jobs.
2. Security: Storing arbitrary third-party code on the server's filesystem creates security and persistence vulnerabilities.
3. Performance: Disk I/O is a major bottleneck compared to memory bus bandwidth.  
By streaming GitHub's `/zipball` endpoint directly into Python's `io.BytesIO` and parsing files on-the-fly with `zipfile.ZipFile`, the entire codebase is processed in RAM and directly indexed into PostgreSQL without ever touching disk."

---

### Q3: Why PostgreSQL with `pgvector` instead of standalone vector DBs like Pinecone, Chroma, or Milvus?
**Answer:**  
"In a real enterprise system, you rarely need *only* vector similarity. You need transactional integrity (ACID), metadata management, repository tracking, and relational relationships (e.g., Repositories ↔ Files ↔ CodeChunks).  
PostgreSQL with `pgvector` provides:
1. **Single Source of Truth**: Metadata, repository records, file hashes, and vectors live in one database, eliminating synchronization bugs between a relational DB and an external vector DB.
2. **HNSW Indexing**: We use Hierarchical Navigable Small World (HNSW) indexing with cosine distance (`vector_cosine_ops`), which yields single-digit millisecond approximate nearest neighbor searches.
3. **Operational Simplicity**: One database to back up, monitor, and scale."

---

### Q4: What is AST-aware chunking and why is it better than fixed-size chunking for code?
**Answer:**  
"Fixed-size chunking (e.g. splitting text every 512 tokens with 50-token overlap) works for plain text, but it breaks code. A fixed split might cut a function signature from its body, or sever a loop condition from its inner logic, rendering the embedding meaningless.  
AST (Abstract Syntax Tree) chunking parses the syntax tree of languages (Python, TypeScript, Go, etc.) to identify top-level definitions like classes, methods, and functions. It keeps logical scopes intact and preserves context (file path, symbol names, line numbers), leading to vastly superior retrieval quality."

---

### Q5: How did you handle LLM streaming and low latency on the frontend?
**Answer:**  
"We utilized **FastAPI Server-Sent Events (SSE)** via `StreamingResponse(media_type='text/event-stream')`.  
- The first event emitted is a JSON payload containing retrieval telemetry (retrieved chunks, latency, and expanded query list).
- Subsequent events are streaming tokens emitted as NVIDIA Nemotron 3 Ultra generates them in real-time.
- The React frontend processes the stream using a ReadableStream reader, updating the UI progressively. This reduces perceived Time-to-First-Token (TTFT) from 15+ seconds down to under 1.5 seconds."

---

### Q6: What was the biggest bug/challenge you faced during this project and how did you resolve it?
**Answer:**  
*"During testing, we initially used a free-tier embedding provider that threw strict 429 quota exhaustion errors during large repository indexing. Additionally, sequential per-file HTTP requests caused ingestion to take several minutes for repositories with 100+ files.*  
*To solve this:*
1. *I eliminated the quota-exhausted provider and migrated the database schema from 3072 to 1536 dimensions to support OpenRouter's high-throughput `text-embedding-3-small` and NVIDIA Nemotron 3 Ultra 550B.*
2. *I redesigned the ingestion architecture around **global batching**: rather than sending an embedding request per file, the worker walks the repo in memory, aggregates all code chunks, and issues batched requests of 50 chunks with exponential backoff.*
3. *This reduced ingestion time for an entire multi-package repository from over 3 minutes to just ~20 seconds without a single rate-limit error."*

---

### Q7: How does Multi-Query Expansion work in your retrieval pipeline?
**Answer:**  
"A user's prompt is often colloquial or abbreviated (e.g. *'auth middleware'*). Before searching, our pipeline uses the LLM to generate alternative formulations and specific code-centric synonyms (e.g. *'validate token header'*, *'Bearer authentication dependency'*, *'HTTPBearer security'*).  
The retriever searches for the original query and expanded variations across vector and keyword indices, then deduplicates and fuses the candidate chunks with RRF. This prevents false negatives when the user's terminology differs from the developer's variable names."

---

## 4. Architecture Diagram for Technical Interviews

```
 [User Browser (React 18 + TS)] 
               |
        HTTP / SSE Stream
               v
     [FastAPI Backend Server]
     /         |             \
    v          v              v
[In-Memory] [Hybrid RRF Engine] [NVIDIA Nemotron 3 Ultra]
 GitHub      /            \             (OpenRouter 550B)
 Stream     /              \
           v                v
     Dense Search        BM25 Search
   (OpenRouter Emb)   (Lexical Tokens)
          \                 /
           v               v
       [PostgreSQL 16 + pgvector (HNSW)]
```

---

## 5. Summary Cheat-Sheet for Live Demonstrations
- **URL**: `http://127.0.0.1:8000/`
- **Model**: NVIDIA Nemotron 3 Ultra 550B (`nvidia/nemotron-3-ultra-550b-a55b`)
- **Embeddings**: OpenRouter 1536-dim (`text-embedding-3-small`)
- **Indexed Chunks**: 820+ across local & GitHub repositories
- **UI Highlights**: Split-view docked code inspector, drag-to-resize sidebars (`Ctrl+B` toggle), zero-disk GitHub streamer, dynamic file-aware exploration chips.
