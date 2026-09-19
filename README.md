# CodeRAG Studio: Enterprise Codebase Intelligence & Hybrid AST RAG Platform

[![Python 3.10+](https://img.shields.io/badge/Python-3.10+-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![PostgreSQL pgvector](https://img.shields.io/badge/PostgreSQL-pgvector_HNSW-336791?logo=postgresql&logoColor=white)](https://github.com/pgvector/pgvector)
[![React 18](https://img.shields.io/badge/React-18.3-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.4-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)
[![NVIDIA Nemotron 3 Ultra](https://img.shields.io/badge/NVIDIA-Nemotron_3_Ultra_550B-76B900?logo=nvidia&logoColor=white)](https://openrouter.ai/)
[![Docker](https://img.shields.io/badge/Docker-Postgres_16-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)

A production-grade Retrieval-Augmented Generation (RAG) platform purpose-built for source code repositories and technical documentation. Powered by **NVIDIA Nemotron 3 Ultra 550B**, **PostgreSQL (`pgvector`) with HNSW indexing**, **Hybrid Dense & BM25 Search with Reciprocal Rank Fusion (RRF)**, **Zero-Disk In-Memory GitHub Streaming**, and a responsive **React 18 + TypeScript dual-resizable workbench**.

---

## 🌟 Architecture & Data Pipeline

```
                    ┌──────────────────────────────────────────────┐
                    │      GitHub Repo URL  /  Local Directory     │
                    └──────────────────────┬───────────────────────┘
                                           │
                       In-Memory HTTP Zipball Streaming
                         (io.BytesIO — Zero Disk I/O)
                                           │
                              Gitignore-Aware Filter
                                           │
                             Language-Aware AST Chunker
                         (Functions, Classes, Scopes, Docs)
                                           │
                             SHA-256 Incremental Hasher
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
             Dense Embeddings                            Lexical BM25
      (OpenRouter 1536-dim Small)                         (Token FTS)
                     │                                           │
                     ▼                                           ▼
       PostgreSQL (pgvector HNSW)                     In-Memory / Inverted Index
                     │                                           │
                     └─────────────────────┬─────────────────────┘
                                           │
                              Reciprocal Rank Fusion (RRF)
                                           │
                              Line-Attributed Context
                                           │
                              NVIDIA Nemotron 3 Ultra 550B
                                           │
                     ┌─────────────────────┴─────────────────────┐
                     ▼                                           ▼
            FastAPI SSE Stream                          React 18 Workbench
         `/api/chat/stream`                   (Dual Resizable/Collapsible Sidebars,
                                               Source Inspector & Dynamic Prompts)
```

---

## 🚀 Key Features

### 1. Zero-Disk In-Memory GitHub Streaming
- Ingests public and authenticated GitHub repositories directly into RAM using HTTP zipball streaming (`io.BytesIO` + `zipfile`).
- Eliminates filesystem disk writes, temporary folders, and `git clone` overhead, making it safe and compliant for cloud containers and serverless runtimes.

### 2. Language-Aware AST Chunking & Incremental Hashing
- Splits source code along syntax-aware boundaries (classes, functions, interface definitions) rather than blind character counters.
- Computes SHA-256 content hashes per file. When re-indexing, unchanged files are automatically skipped, cutting embedding costs and latency by over 70%.

### 3. Hybrid Search: Dense Vector + BM25 with Reciprocal Rank Fusion (RRF)
- Code contains both **abstract intent** (*"how is database session managed?"*) and **exact syntax** (`def get_db():`).
- Combines 1536-dimensional dense embeddings with sparse BM25 token matching using **Reciprocal Rank Fusion ($k=60$)**:
  $$RRF\_Score(d) = \sum_{m \in \{Dense, BM25\}} \frac{1}{60 + rank_m(d)}$$
  Ensures exact function names, class definitions, and error codes never get lost in semantic space.

### 4. Global High-Throughput Batch Embedding
- Crawls codebases and unifies chunks into parallelized batches of 50 via OpenRouter embeddings with automatic exponential backoff retry.
- Indexes 100+ files and 600+ chunks in ~20 seconds.

### 5. Multi-Query Expansion with NVIDIA Nemotron 3 Ultra 550B
- Expands user queries into domain-specific code variations to catch alternative variable and method naming conventions before retrieval.
- Streams real-time tokens over FastAPI Server-Sent Events (SSE) alongside precise line-number citations (`file_path:L#–L#`).

### 6. Interactive Dual-Panel Workbench (React 18 + TypeScript)
- **Resizable & Collapsible File Explorer**: Draggable border (200px–620px), search filter (`⌘K`), and `Ctrl+B` toggle.
- **Resizable & Collapsible Source Inspector**: Click any citation chip to open a side-by-side split screen (300px–920px) displaying the exact code snippet, AST symbol, and match telemetry (Dense vs. BM25 rank).
- **Workspace Switcher**: Seamlessly switch between active local and GitHub repositories.
- **Dynamic File-Aware Prompts**: Automatically analyzes the active repository's file structure to generate contextual exploration queries.

---

## 🛠️ Quickstart

### 1. Prerequisites
- **Docker** & **Docker Compose**
- **Python 3.10+**
- **Node.js 18+** & **npm**

### 2. Launch PostgreSQL with pgvector
```bash
docker compose up -d
```
Verify the container is running:
```bash
docker ps
# coderag_postgres running on 127.0.0.1:5432
```

### 3. Configure Environment (`.env`)
Create or edit `.env` in the root directory:
```env
# Database Configuration
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/coderag

# LLM & Embedding Provider
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key_here
OPENROUTER_MODEL=nvidia/nemotron-3-ultra-550b-a55b
OPENROUTER_EMBEDDING_MODEL=text-embedding-3-small

# Vector Dimensions & Retrieval Tuning
EMBEDDING_DIMENSION=1536
TOP_K=5
RRF_K=60
```

### 4. Set Up Python Virtual Environment
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# Linux / macOS
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt
```

### 5. Build Frontend
```bash
cd frontend
npm install
npm run build
cd ..
```

### 6. Start the Backend Server
```bash
# Run server with static frontend serving enabled
python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
```
Open **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser.

---

## 📡 Core API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Service health, pgvector status, and active provider info |
| `GET` | `/api/stats` | Global metrics (total repositories, indexed chunks, dimensions) |
| `GET` | `/api/repositories` | List all indexed repositories |
| `GET` | `/api/repository/{id}/files` | List file tree, languages, and chunk counts for a repository |
| `POST` | `/api/ingest` | Ingest a local repository path (`{"repo_path": ".", "repo_name": "MyLocal"}`) |
| `POST` | `/api/ingest/github` | Stream & index GitHub repository directly in RAM (`{"repo_url": "https://github.com/user/repo"}`) |
| `POST` | `/api/chat/stream` | Stream SSE response with retrieval metrics, citations, and LLM tokens |

### Example Chat Request:
```bash
curl -X POST http://127.0.0.1:8000/api/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "How does AST chunking work in this project?", "repo_id": 1}'
```

---

## 📂 Project Structure

```
Production Rag/
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── routes_chat.py       # SSE streaming chat endpoint
│   │   │   ├── routes_config.py     # Health, configuration & settings
│   │   │   └── routes_ingest.py     # Local & GitHub repository ingestion
│   │   ├── core/
│   │   │   └── config.py            # Pydantic v2 application settings
│   │   ├── db/
│   │   │   ├── database.py          # SQLAlchemy async engine & pgvector init
│   │   │   └── models.py            # Repository & CodeChunk ORM tables (1536-dim)
│   │   ├── services/
│   │   │   ├── chunker.py           # Language-aware AST code chunker
│   │   │   ├── embedder.py          # OpenRouter 1536-dim batched embedder
│   │   │   ├── github_ingest.py     # In-memory zero-disk zipball streaming
│   │   │   ├── ingest.py            # Local directory crawler & indexer
│   │   │   ├── llm.py               # NVIDIA Nemotron 3 Ultra 550B streaming
│   │   │   ├── query_expander.py    # Multi-query variation generator
│   │   │   └── retriever.py         # Dense + BM25 Hybrid Search with RRF
│   │   └── main.py                  # FastAPI entrypoint & frontend static mount
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ChatStudio.tsx       # Dynamic prompts, message bubbles & citation pills
│   │   │   ├── IngestModal.tsx      # Modal for local and GitHub URL ingestion
│   │   │   ├── Navbar.tsx           # Telemetry status, workspace dropdown & toggles
│   │   │   ├── Sidebar.tsx          # Resizable & collapsible file explorer (Ctrl+B)
│   │   │   └── SourceDrawer.tsx     # Resizable & collapsible code inspector drawer
│   │   ├── services/
│   │   │   └── api.ts               # Fetch wrappers & SSE streaming reader
│   │   ├── types/
│   │   │   └── index.ts             # TypeScript interface contracts
│   │   ├── App.tsx                  # Main workbench state orchestration
│   │   └── main.tsx
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── docker-compose.yml               # PostgreSQL 16 with pgvector extension
├── RESUME_AND_INTERVIEW_GUIDE.md    # Resume bullet points & technical interview prep
└── README.md
```

---

## 🛡️ License
Licensed under the [MIT License](LICENSE).
