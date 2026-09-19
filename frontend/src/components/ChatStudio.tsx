import React, { useRef, useEffect, useMemo } from 'react';
import { ArrowUp, Sparkles, CheckCircle2, ArrowRight, Code, Search } from 'lucide-react';
import { ChatMessage, CodeChunk, FileItem, SystemStats } from '../types';

interface ChatStudioProps {
  messages: ChatMessage[];
  query: string;
  setQuery: (q: string) => void;
  onSubmit: (q: string) => void;
  isLoading: boolean;
  onOpenCitation: (chunk: Partial<CodeChunk>) => void;
  repoName: string;
  files: FileItem[];
  stats: SystemStats | null;
}

export const ChatStudio: React.FC<ChatStudioProps> = ({
  messages,
  query,
  setQuery,
  onSubmit,
  isLoading,
  onOpenCitation,
  repoName,
  files,
  stats,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim() || isLoading) return;
    onSubmit(query.trim());
  };

  // Generate dynamic starter prompts specifically tailored to the active repository's files
  const starterPrompts = useMemo(() => {
    if (!files || files.length === 0) {
      return [
        { label: `Deconstruct ${repoName} system architecture`, query: `Explain the high-level architecture and main services in ${repoName}.` },
        { label: "Analyze project dependencies and setup", query: `What are the key dependencies and configuration files in this repository?` },
        { label: "Find core entrypoints and execution flows", query: `Where is the main entry point of this codebase and how does execution start?` },
        { label: "Inspect data models and schemas", query: `Show the primary data models, schemas, or database entities in ${repoName}.` },
      ];
    }

    const filePaths = files.map((f) => f.file_path);

    // 1. Identify key core / entrypoint file
    const coreFile =
      filePaths.find((p) => /^(app|main|index|server|core|src\/index|src\/main|src\/App)\./i.test(p.split('/').pop() || '')) ||
      filePaths.find((p) => p.includes('core') || p.includes('main') || p.includes('app')) ||
      filePaths[0];

    // 2. Identify major service / business logic file
    const logicFile =
      filePaths.find((p) => p !== coreFile && /(evaluat|retriev|service|pipeline|router|model|chunk|api|util|handler)/i.test(p)) ||
      filePaths[1] ||
      coreFile;

    // 3. Identify config / schema / environment file
    const configFile =
      filePaths.find((p) => /(config|setting|schema|docker|database|db|models)/i.test(p)) ||
      filePaths.find((p) => p.endsWith('.toml') || p.endsWith('.json') || p.endsWith('.yaml') || p.endsWith('.yml')) ||
      filePaths[2] ||
      logicFile;

    const shortName = (path?: string) => {
      if (!path) return '';
      const parts = path.split('/');
      return parts.length > 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : path;
    };

    return [
      {
        label: `Deconstruct ${repoName} system architecture & pipeline`,
        query: `Explain the high-level architecture, key components, and data flow of ${repoName}.`,
      },
      {
        label: `Analyze core implementation in ${shortName(coreFile)}`,
        query: `What does ${coreFile} do, and what are its key classes, functions, and responsibilities?`,
      },
      {
        label: `Trace logic & workflow in ${shortName(logicFile)}`,
        query: `Explain how ${logicFile} works and how it integrates with the rest of the system.`,
      },
      {
        label: `Inspect schema & configuration in ${shortName(configFile)}`,
        query: `Explain the configuration, data structures, and schemas defined in ${configFile}.`,
      },
    ];
  }, [files, repoName]);

  // Markdown and citation parser
  const renderFormattedContent = (rawText: string) => {
    // Replace citations like [file.py:L10-L24] or [file.py:10-24]
    const citationRegex = /\[([a-zA-Z0-9_\-\.\/]+):(L?\d+)-(L?\d+)\]/g;
    const parts: (string | JSX.Element)[] = [];
    let lastIdx = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(rawText)) !== null) {
      if (match.index > lastIdx) {
        parts.push(rawText.substring(lastIdx, match.index));
      }
      const file = match[1];
      const start = parseInt(match[2].replace('L', ''), 10);
      const end = parseInt(match[3].replace('L', ''), 10);
      const chipKey = `${file}-${start}-${end}-${match.index}`;

      parts.push(
        <button
          key={chipKey}
          onClick={() => onOpenCitation({ file_path: file, start_line: start, end_line: end })}
          className="citation-chip-warm inline-flex items-center gap-1 mx-0.5 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium"
        >
          <Code className="w-3 h-3 text-amber-600" />
          <span>{file}:{start}-{end}</span>
        </button>
      );
      lastIdx = match.index + match[0].length;
    }
    if (lastIdx < rawText.length) {
      parts.push(rawText.substring(lastIdx));
    }

    return (
      <div className="markdown-body space-y-2 text-[13.5px] leading-relaxed text-stone-800 select-text">
        {parts.map((p, i) => (typeof p === 'string' ? <span key={i} className="whitespace-pre-wrap">{p}</span> : p))}
      </div>
    );
  };

  return (
    <main className="flex-1 flex flex-col h-full canvas-ambient-warm overflow-hidden relative">
      {/* Messages Thread */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6">
        {messages.length === 0 ? (
          /* Dynamic Welcome Hero Card tailored to active repository */
          <div className="max-w-2xl mx-auto rounded-3xl glass-panel-warm shadow-warm-sm space-y-5 relative overflow-hidden p-6 md:p-8 mt-4">
            <div className="sunset-accent-strip absolute top-0 left-0 right-0"></div>

            <div className="flex items-start space-x-4">
              <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-amber-100 to-orange-100 border border-amber-200/80 flex items-center justify-center text-amber-600 shrink-0 shadow-xs">
                <Sparkles className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h2 className="text-[17px] font-semibold text-stone-900 tracking-tight">
                  {repoName ? `${repoName} — Intelligence Studio` : 'Codebase Intelligence & AST RAG Studio'}
                </h2>
                <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                  Query architecture, function signatures, dependencies, or vector chunks. Powered by PostgreSQL + pgvector, {stats?.chat_model || 'Nemotron 3 Ultra 550B'}, and Multi-Query Reciprocal Rank Fusion.
                </p>
              </div>
            </div>

            {/* Dynamic Starter Exploration Chips */}
            <div className="pt-2">
              <div className="text-[10.5px] font-mono font-semibold text-stone-400 uppercase tracking-wider mb-2.5">
                Technical Explorations ({repoName}):
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                {starterPrompts.map((p, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setQuery(p.query);
                      onSubmit(p.query);
                    }}
                    className="flex items-center justify-between p-3.5 rounded-2xl bg-white/90 border border-stone-200 hover:border-amber-400/90 hover:bg-amber-50/40 text-left transition-all shadow-xs group"
                  >
                    <span className="text-[12px] font-mono text-stone-700 group-hover:text-amber-950 font-medium truncate pr-2">
                      {p.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-600 shrink-0 group-hover:translate-x-0.5 transition-transform" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex flex-col space-y-2 max-w-3xl ${
                m.sender === 'user' ? 'ml-auto items-end' : 'mr-auto items-start w-full'
              }`}
            >
              {/* Message Bubble */}
              <div
                className={`p-4 md:p-5 rounded-3xl ${
                  m.sender === 'user'
                    ? 'bg-gradient-to-r from-stone-900 to-stone-800 text-stone-100 rounded-tr-sm shadow-warm-sm max-w-[85%]'
                    : 'glass-panel-warm border border-stone-200/90 text-stone-800 rounded-tl-sm shadow-warm-sm w-full'
                }`}
              >
                {m.sender === 'assistant' && (
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-stone-200/60">
                    <div className="flex items-center space-x-2">
                      <div className="h-6 w-6 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-[10px] font-bold shadow-xs">
                        CR
                      </div>
                      <span className="text-[12px] font-semibold text-stone-900 font-mono">
                        {stats?.chat_model || 'Nemotron 3 Ultra'}
                      </span>
                    </div>

                    {/* Retrieval Telemetry Badge */}
                    {m.retrievalEvent && (
                      <div className="flex items-center space-x-2 text-[10.5px] font-mono text-stone-500">
                        <span className="flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 font-medium">
                          <CheckCircle2 className="w-3 h-3" />
                          {m.retrievalEvent.count} Chunks
                        </span>
                        <span className="text-stone-300">|</span>
                        <span>{m.retrievalEvent.retrieval_latency_ms}ms retrieval</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Message Content */}
                {m.sender === 'user' ? (
                  <div className="text-[13.5px] font-sans leading-relaxed select-text">{m.text}</div>
                ) : (
                  <div>
                    {/* Citation Pills Bar above answer */}
                    {m.retrievalEvent?.chunks && m.retrievalEvent.chunks.length > 0 && (
                      <div className="mb-3.5 flex flex-wrap gap-1.5 pb-2.5 border-b border-stone-100">
                        <span className="text-[10.5px] font-mono text-stone-400 self-center uppercase tracking-wider mr-1">
                          Sources:
                        </span>
                        {m.retrievalEvent.chunks.map((c, idx) => (
                          <button
                            key={idx}
                            onClick={() => onOpenCitation(c)}
                            className="citation-chip-warm inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10.5px] font-mono"
                            title={`Inspect ${c.file_path} (Lines ${c.start_line}-${c.end_line})`}
                          >
                            <Code className="w-3 h-3 text-amber-600" />
                            <span className="truncate max-w-[170px]">{c.file_path.split('/').pop()}</span>
                            <span className="text-stone-400 text-[9.5px]">:{c.start_line}-{c.end_line}</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Streamed or Rendered Answer */}
                    {renderFormattedContent(m.text || (isLoading ? 'Analyzing vector embeddings and reasoning...' : ''))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Persistent Bottom Prompt Input Bar */}
      <div className="p-4 md:p-6 bg-gradient-to-t from-[#faf8f5] via-[#faf8f5]/90 to-transparent">
        <form onSubmit={handleFormSubmit} className="max-w-3xl mx-auto relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask ${repoName || 'codebase'} architecture, methods, schemas...`}
            disabled={isLoading}
            className="w-full bg-white text-[13.5px] text-stone-900 placeholder-stone-400 rounded-2xl px-4 py-3.5 pr-13 border border-stone-200/90 shadow-warm-sm focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-sans transition-all disabled:bg-stone-50"
          />
          <button
            type="submit"
            disabled={!query.trim() || isLoading}
            className="btn-sunset absolute right-2.5 top-2.5 h-9 w-9 rounded-xl flex items-center justify-center disabled:opacity-40 disabled:hover:opacity-40 transition-all"
            title="Send query"
          >
            <ArrowUp className="w-4 h-4 text-white stroke-[2.5]" />
          </button>
        </form>
      </div>
    </main>
  );
};
