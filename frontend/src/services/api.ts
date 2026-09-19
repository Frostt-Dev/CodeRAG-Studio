import { HealthStatus, SystemStats, Repository, FileItem, CodeChunk } from '../types';

export async function fetchHealth(): Promise<HealthStatus> {
  const res = await fetch('/api/health');
  if (!res.ok) throw new Error('Health check failed');
  return res.json();
}

export async function fetchStats(): Promise<SystemStats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Stats fetch failed');
  return res.json();
}

export async function fetchRepositories(): Promise<Repository[]> {
  const res = await fetch('/api/repositories');
  if (!res.ok) throw new Error('Failed to load repositories');
  return res.json();
}

export async function fetchRepoFiles(repoId: number): Promise<FileItem[]> {
  const res = await fetch(`/api/repository/${repoId}/files`);
  if (!res.ok) throw new Error('Failed to load repository files');
  return res.json();
}

export async function ingestLocalRepo(repoPath: string, repoName: string) {
  const res = await fetch('/api/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_path: repoPath, repo_name: repoName })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Ingestion failed');
  return data;
}

export async function ingestGithubRepo(repoUrl: string, branch?: string, token?: string) {
  const res = await fetch('/api/ingest/github', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl, branch: branch || null, token: token || null })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'GitHub Ingestion failed');
  return data;
}

export interface StreamChatOptions {
  query: string;
  repoId: number | null;
  onRetrieval?: (event: { count: number; retrieval_latency_ms: number; expanded_queries?: string[]; chunks: CodeChunk[] }) => void;
  onToken?: (token: string) => void;
  onDone?: () => void;
  onError?: (err: Error) => void;
}

export async function streamChatQuery({ query, repoId, onRetrieval, onToken, onDone, onError }: StreamChatOptions) {
  try {
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, repo_id: repoId, top_k: 5 })
    });

    if (!response.ok) {
      throw new Error(`Streaming failed: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Readable stream not supported in this browser');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.replace('data: ', '').trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'retrieval' && onRetrieval) {
              onRetrieval(event);
            } else if (event.type === 'token' && onToken) {
              onToken(event.content);
            } else if (event.type === 'done' && onDone) {
              onDone();
            }
          } catch (e) {
            console.error('SSE JSON parse error:', e);
          }
        }
      }
    }
  } catch (err: any) {
    if (onError) onError(err);
  }
}
