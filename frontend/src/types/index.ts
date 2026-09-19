export interface Repository {
  id: number;
  name: string;
  path: string;
  file_count: number;
  chunk_count: number;
  indexed_at: string;
}

export interface FileItem {
  file_path: string;
  chunk_count: number;
}

export interface CodeChunk {
  file_path: string;
  start_line: number;
  end_line: number;
  content: string;
  symbol_name?: string;
  symbol_type?: string;
  match_percent?: number;
  dense_rank?: number;
  bm25_rank?: number;
}

export interface HealthStatus {
  status: string;
  database: string;
  pgvector: string;
  provider: string;
  gemini_configured: boolean;
  openai_configured: boolean;
}

export interface SystemStats {
  total_repositories: number;
  total_chunks: number;
  database: string;
  vector_extension: string;
  vector_dimensions: number;
  hybrid_search: string;
  chat_model: string;
  embedding_model: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  retrievalEvent?: {
    count: number;
    retrieval_latency_ms: number;
    expanded_queries?: string[];
    chunks: CodeChunk[];
  };
}
