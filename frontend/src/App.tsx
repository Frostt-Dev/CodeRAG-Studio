import { useState, useEffect, useCallback } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { ChatStudio } from './components/ChatStudio';
import { SourceDrawer } from './components/SourceDrawer';
import { IngestModal } from './components/IngestModal';
import { HealthStatus, SystemStats, FileItem, ChatMessage, CodeChunk, Repository } from './types';
import { fetchHealth, fetchStats, fetchRepositories, fetchRepoFiles, streamChatQuery } from './services/api';
import { PanelLeftOpen } from 'lucide-react';

export function App() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoName, setRepoName] = useState('Production Rag');
  const [activeRepoId, setActiveRepoId] = useState<number | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [totalChunks, setTotalChunks] = useState(0);

  // Left Sidebar Resizing & Collapse States
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('coderag_sidebar_collapsed') === 'true';
  });
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('coderag_sidebar_width');
    return saved ? Math.min(Math.max(parseInt(saved, 10), 200), 620) : 300;
  });

  // Right Source Inspector Resizing State
  const [inspectorWidth, setInspectorWidth] = useState<number>(() => {
    const saved = localStorage.getItem('coderag_inspector_width');
    return saved ? Math.min(Math.max(parseInt(saved, 10), 300), 920) : 440;
  });

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Drawer / Split View State
  const [isSplitView, setIsSplitView] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [activeChunk, setActiveChunk] = useState<Partial<CodeChunk> | null>(null);

  // Modal State
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // Toggle Sidebar Collapse
  const handleToggleSidebar = useCallback(() => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('coderag_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  // Update Left Sidebar Width
  const handleSidebarWidthChange = useCallback((newWidth: number) => {
    setSidebarWidth(newWidth);
    localStorage.setItem('coderag_sidebar_width', String(newWidth));
  }, []);

  // Update Right Source Inspector Width
  const handleInspectorWidthChange = useCallback((newWidth: number) => {
    setInspectorWidth(newWidth);
    localStorage.setItem('coderag_inspector_width', String(newWidth));
  }, []);

  // Select Active Repository (dynamically adapts file list, suggestions, and chunk counts)
  const handleSelectRepo = async (repoId: number) => {
    const target = repositories.find((r) => r.id === repoId);
    if (!target) return;
    setActiveRepoId(target.id);
    setRepoName(target.name);
    setTotalChunks(target.chunk_count);
    const fList = await fetchRepoFiles(target.id).catch(() => []);
    setFiles(fList);
    setMessages([]); // Reset thread so the new repository's tailored explorations display
  };

  // Initial Data Fetch
  const loadSystemData = async () => {
    try {
      const [h, s, repos] = await Promise.all([
        fetchHealth().catch(() => null),
        fetchStats().catch(() => null),
        fetchRepositories().catch(() => []),
      ]);
      if (h) setHealth(h);
      if (s) setStats(s);

      if (repos && repos.length > 0) {
        setRepositories(repos);
        const r = repos[0];
        setRepoName(r.name);
        setActiveRepoId(r.id);
        setTotalChunks(r.chunk_count);
        const fList = await fetchRepoFiles(r.id).catch(() => []);
        setFiles(fList);
      }
    } catch (e) {
      console.error('Initialization error:', e);
    }
  };

  useEffect(() => {
    loadSystemData();
  }, []);

  // Keyboard shortcuts: ⌘K to search, Ctrl+B / ⌘B to toggle sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const input = document.querySelector('input[placeholder*="Filter indexed files"]') as HTMLInputElement;
        input?.focus();
        input?.select();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleToggleSidebar();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleToggleSidebar]);

  // Query Execution with Multi-Query Expansion & SSE Streaming
  const handleQuerySubmit = (userText: string) => {
    setQuery('');
    const userMsgId = `user-${Date.now()}`;
    const assistantMsgId = `ai-${Date.now()}`;

    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: 'user', text: userText },
      { id: assistantMsgId, sender: 'assistant', text: '' },
    ]);

    setIsLoading(true);

    streamChatQuery({
      query: userText,
      repoId: activeRepoId,
      onRetrieval: (event) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, retrievalEvent: event } : m))
        );
      },
      onToken: (token) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantMsgId ? { ...m, text: m.text + token } : m))
        );
      },
      onDone: () => {
        setIsLoading(false);
      },
      onError: (err) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? { ...m, text: m.text + `\n\n[Error streaming response: ${err.message}]` }
              : m
          )
        );
        setIsLoading(false);
      },
    });
  };

  // Open Citation in Source Drawer
  const handleOpenCitation = (chunk: Partial<CodeChunk>) => {
    setActiveChunk(chunk);
    setIsDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#faf8f5] text-[#1c1917] select-none font-sans">
      {/* Top Frosted Navbar */}
      <Navbar
        repoName={repoName}
        repositories={repositories}
        activeRepoId={activeRepoId}
        onSelectRepo={handleSelectRepo}
        health={health}
        stats={stats}
        isSplitView={isSplitView}
        onToggleSplit={() => {
          setIsSplitView((prev) => !prev);
          if (!isSplitView) setIsDrawerOpen(true);
        }}
        onOpenIngest={() => setIsIngestOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={handleToggleSidebar}
      />

      {/* Main 3-Pane Workbench */}
      <div className="flex-1 flex overflow-hidden w-full relative">
        {/* Floating Expand Sidebar Button (Visible when sidebar is collapsed) */}
        {isSidebarCollapsed && (
          <button
            onClick={handleToggleSidebar}
            className="absolute left-3.5 top-3.5 z-30 flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white/95 backdrop-blur-md border border-stone-200/90 shadow-md text-stone-700 hover:text-amber-800 hover:border-amber-300 transition-all font-mono text-[11.5px] group"
            title="Expand File Explorer (Ctrl+B / ⌘B)"
          >
            <PanelLeftOpen className="w-4 h-4 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="font-semibold">Files ({files.length})</span>
          </button>
        )}

        {/* Left Repository Explorer */}
        <Sidebar
          files={files}
          totalChunks={totalChunks}
          onSelectFile={(path) => {
            setQuery(`Explain ${path}`);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={handleToggleSidebar}
          width={sidebarWidth}
          onWidthChange={handleSidebarWidthChange}
        />

        {/* Center Chat Studio with Dynamic Context & Prompts */}
        <ChatStudio
          messages={messages}
          query={query}
          setQuery={setQuery}
          onSubmit={handleQuerySubmit}
          isLoading={isLoading}
          onOpenCitation={handleOpenCitation}
          repoName={repoName}
          files={files}
          stats={stats}
        />

        {/* Right Source Inspector Drawer (Resizable & Collapsible) */}
        <SourceDrawer
          chunk={activeChunk}
          isOpen={isDrawerOpen}
          isPinned={isSplitView}
          onClose={() => {
            setIsDrawerOpen(false);
            if (isSplitView) setIsSplitView(false);
          }}
          onTogglePin={() => setIsSplitView((prev) => !prev)}
          width={inspectorWidth}
          onWidthChange={handleInspectorWidthChange}
        />
      </div>

      {/* Ingestion Modal Dialog */}
      <IngestModal
        isOpen={isIngestOpen}
        onClose={() => setIsIngestOpen(false)}
        onSuccess={() => {
          loadSystemData();
        }}
      />
    </div>
  );
}
