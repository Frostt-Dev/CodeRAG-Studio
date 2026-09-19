import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Search, FileCode, FileText, Code2, Layers, Binary, PanelLeftClose } from 'lucide-react';
import { FileItem } from '../types';

interface SidebarProps {
  files: FileItem[];
  totalChunks: number;
  onSelectFile: (filePath: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  files,
  totalChunks,
  onSelectFile,
  isCollapsed,
  onToggleCollapse,
  width,
  onWidthChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter files based on user search query
  const filteredFiles = useMemo(() => {
    if (!searchQuery.trim()) return files;
    const q = searchQuery.toLowerCase();
    return files.filter((f) => f.file_path.toLowerCase().includes(q));
  }, [files, searchQuery]);

  // Global ⌘K / Ctrl+K shortcut to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Resize drag handler
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Clamp sidebar width between 200px and 620px
      const newWidth = Math.min(Math.max(moveEvent.clientX, 200), 620);
      onWidthChange(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const getFileIcon = (filePath: string) => {
    const ext = filePath.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'py':
        return <Code2 className="w-3.5 h-3.5 text-amber-600 group-hover:text-amber-700 shrink-0" />;
      case 'md':
        return <FileText className="w-3.5 h-3.5 text-stone-500 group-hover:text-stone-700 shrink-0" />;
      case 'json':
        return <Binary className="w-3.5 h-3.5 text-orange-500 group-hover:text-orange-700 shrink-0" />;
      default:
        return <FileCode className="w-3.5 h-3.5 text-stone-400 group-hover:text-amber-600 shrink-0" />;
    }
  };

  if (isCollapsed) {
    return null;
  }

  return (
    <aside
      style={{ width: `${width}px` }}
      className="relative flex flex-col justify-between h-full bg-white border-r border-stone-200 shrink-0 z-20 shadow-xs transition-[width] duration-75 select-none"
    >
      <div className="flex flex-col flex-1 overflow-hidden p-3.5 space-y-3">
        {/* Explorer Header with Collapse Button */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center space-x-1.5">
            <span className="text-[11px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
              Repository Explorer
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
            title="Collapse Sidebar (Ctrl+B / ⌘B)"
          >
            <PanelLeftClose className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search Input with Keyboard Shortcut Indicator */}
        <div className="relative">
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter indexed files..."
            className="w-full bg-[#faf8f5] text-[12px] text-stone-800 placeholder-stone-400 rounded-xl px-3 py-2 pl-8.5 border border-stone-200 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 font-mono transition-all"
          />
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-stone-400 pointer-events-none" />
          <span className="absolute right-2.5 top-2.5 font-mono text-[9px] text-stone-400 px-1 py-0.2 rounded bg-stone-200/60 border border-stone-300 pointer-events-none">
            ⌘K
          </span>
        </div>

        {/* Files Section Header */}
        <div className="flex items-center justify-between px-1 text-[11px] font-mono text-stone-500 font-semibold">
          <span className="uppercase tracking-wider">Repository Files</span>
          <span className="px-2 py-0.2 rounded-full bg-stone-100 text-stone-700 border border-stone-200 font-bold">
            {filteredFiles.length}
          </span>
        </div>

        {/* File Tree List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 font-mono text-[12px]">
          {filteredFiles.length === 0 ? (
            <div className="p-6 text-center text-stone-400 text-[12px]">
              {files.length === 0 ? 'No files indexed yet.' : 'No matching files.'}
            </div>
          ) : (
            filteredFiles.map((f) => (
              <div
                key={f.file_path}
                onClick={() => onSelectFile(f.file_path)}
                className="file-item-row flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-amber-50/80 cursor-pointer text-stone-600 hover:text-amber-950 transition-all group"
              >
                <div className="flex items-center space-x-2 truncate pr-1">
                  {getFileIcon(f.file_path)}
                  <span className="truncate text-[12px] font-mono">{f.file_path}</span>
                </div>
                <span className="text-[10px] text-stone-400 group-hover:text-amber-800 shrink-0 font-mono bg-stone-100 group-hover:bg-amber-100/70 px-1.5 py-0.5 rounded-md font-semibold">
                  {f.chunk_count}c
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Left Sidebar Bottom Telemetry Card */}
      <div className="p-3.5 border-t border-stone-200 bg-[#faf8f5]">
        <div className="p-3 rounded-xl bg-white border border-stone-200 space-y-2 font-mono text-[11px] shadow-warm-sm">
          <div className="flex justify-between items-center text-stone-500">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-amber-600" />
              <span>Total AST Chunks:</span>
            </span>
            <span className="text-amber-700 font-bold text-[12px]">
              {totalChunks.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-center text-stone-500 pt-1.5 border-t border-stone-100">
            <span>Retriever Ranker:</span>
            <span className="text-stone-800 font-medium">Dense + BM25 RRF</span>
          </div>
        </div>
      </div>

      {/* Resizing Edge Handle */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 -right-1 bottom-0 w-2 cursor-col-resize z-30 transition-colors group flex items-center justify-center ${
          isResizing ? 'bg-amber-500/80' : 'hover:bg-amber-400/50'
        }`}
        title="Drag left or right to resize sidebar"
      >
        <div className="w-[1px] h-8 rounded-full bg-stone-300 group-hover:bg-amber-600" />
      </div>
    </aside>
  );
};
