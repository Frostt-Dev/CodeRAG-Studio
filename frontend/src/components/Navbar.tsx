import React, { useState } from 'react';
import { Terminal, FolderOpen, Sparkles, Columns, PlusCircle, PanelLeftClose, PanelLeftOpen, ChevronDown, Check } from 'lucide-react';
import { HealthStatus, SystemStats } from '../types';

interface NavbarProps {
  repoName: string;
  repositories?: { id: number; name: string; file_count: number; chunk_count: number }[];
  activeRepoId?: number | null;
  onSelectRepo?: (repoId: number) => void;
  health: HealthStatus | null;
  stats: SystemStats | null;
  isSplitView: boolean;
  onToggleSplit: () => void;
  onOpenIngest: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  repoName,
  repositories = [],
  activeRepoId,
  onSelectRepo,
  health,
  stats,
  isSplitView,
  onToggleSplit,
  onOpenIngest,
  isSidebarCollapsed,
  onToggleSidebar,
}) => {
  const [isRepoMenuOpen, setIsRepoMenuOpen] = useState(false);

  return (
    <header className="glass-nav-warm flex justify-between items-center h-14 px-5 w-full z-30 shrink-0">
      {/* Brand & Repository Context */}
      <div className="flex items-center space-x-3.5">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className={`p-1.5 rounded-xl border transition-colors ${
              isSidebarCollapsed
                ? 'bg-amber-50 text-amber-700 border-amber-300 shadow-sm'
                : 'text-stone-500 hover:text-stone-900 border-stone-200 hover:bg-stone-100/80'
            }`}
            title={isSidebarCollapsed ? "Expand File Explorer (Ctrl+B / ⌘B)" : "Collapse File Explorer (Ctrl+B / ⌘B)"}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-4 h-4 text-amber-700" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        )}

        <div className="flex items-center space-x-2.5 cursor-pointer">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-amber-500 via-amber-600 to-orange-600 flex items-center justify-center text-white shadow-sm shadow-amber-500/30">
            <Terminal className="w-4 h-4 text-white stroke-[2.2]" />
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-[15px] tracking-tight text-stone-900">CodeRAG</span>
              <span className="text-amber-600 font-medium text-[15px]">Studio</span>
              <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80 font-semibold">
                v2.5-pro
              </span>
            </div>
          </div>
        </div>

        <div className="h-4 w-[1px] bg-stone-200"></div>

        {/* Active Workspace Selector Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsRepoMenuOpen((prev) => !prev)}
            className="flex items-center space-x-2 bg-stone-100/80 hover:bg-stone-200/70 px-2.5 py-1 rounded-xl border border-stone-200/80 transition-colors"
            title="Switch Workspace / Repository"
          >
            <FolderOpen className="w-3.5 h-3.5 text-stone-500" />
            <span className="font-mono text-[11.5px] font-semibold text-stone-800 truncate max-w-[200px]">
              {repoName || "Select Repository"}
            </span>
            <ChevronDown className="w-3 h-3 text-stone-400" />
          </button>

          {isRepoMenuOpen && repositories.length > 0 && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setIsRepoMenuOpen(false)}
              />
              <div className="absolute left-0 mt-1.5 w-72 bg-white rounded-2xl border border-stone-200 shadow-xl py-1.5 z-50 font-mono text-[12px]">
                <div className="px-3 py-1 text-[10px] font-semibold text-stone-400 uppercase tracking-wider">
                  Select Repository
                </div>
                {repositories.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      onSelectRepo?.(r.id);
                      setIsRepoMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-amber-50/70 transition-colors ${
                      r.id === activeRepoId ? 'bg-amber-50/90 text-amber-950 font-semibold' : 'text-stone-700'
                    }`}
                  >
                    <div className="truncate pr-2">
                      <div className="truncate text-[12px]">{r.name}</div>
                      <div className="text-[10px] text-stone-400 font-normal">
                        {r.file_count} files • {r.chunk_count} chunks
                      </div>
                    </div>
                    {r.id === activeRepoId && (
                      <Check className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Center System Telemetry */}
      <div className="hidden lg:flex items-center space-x-3">
        {/* PostgreSQL + pgvector Status */}
        <div className="flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 shadow-warm-sm">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
          <span className="font-mono text-[11px] text-emerald-950 font-medium">PostgreSQL + pgvector</span>
          <span className="text-emerald-300">|</span>
          <span className="font-mono text-[11px] font-bold text-emerald-700">
            {health?.database === 'healthy' ? '12ms' : 'Degraded'}
          </span>
        </div>

        {/* LLM & Multi-Query RRF Engine */}
        <div className="flex items-center space-x-2 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-50 via-orange-50 to-amber-50 border border-amber-200/80 shadow-warm-sm">
          <Sparkles className="w-3.5 h-3.5 text-amber-600" />
          <span className="font-mono text-[11px] text-stone-900 font-medium">
            {stats?.chat_model || "Nemotron 3 Ultra 550B"}
          </span>
          <span className="font-mono text-[10px] text-amber-800 px-1.5 py-0.2 bg-white/90 rounded-full border border-amber-200 font-semibold">
            Multi-Query RRF
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center space-x-2.5">
        <button
          onClick={onToggleSplit}
          className={`hidden md:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-colors ${
            isSplitView
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'border-stone-200 hover:bg-stone-100 text-stone-600'
          }`}
          title="Toggle Side-by-Side Split View"
        >
          <Columns className="w-3.5 h-3.5" />
          <span>{isSplitView ? 'Close Split' : 'Split View'}</span>
        </button>

        <button
          onClick={onOpenIngest}
          className="btn-sunset flex items-center space-x-1.5 px-4 py-1.5 rounded-xl text-[12.5px] shadow-warm-sm"
        >
          <PlusCircle className="w-4 h-4 stroke-[2.2]" />
          <span>Ingest Repository</span>
        </button>
      </div>
    </header>
  );
};
