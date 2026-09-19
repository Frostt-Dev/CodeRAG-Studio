import React, { useState, useRef, useEffect } from 'react';
import { X, Pin, Check, Copy, Code2, PanelRightClose } from 'lucide-react';
import { CodeChunk } from '../types';

interface SourceDrawerProps {
  chunk: Partial<CodeChunk> | null;
  isOpen: boolean;
  isPinned: boolean;
  onClose: () => void;
  onTogglePin: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export const SourceDrawer: React.FC<SourceDrawerProps> = ({
  chunk,
  isOpen,
  isPinned,
  onClose,
  onTogglePin,
  width,
  onWidthChange,
}) => {
  const [copied, setCopied] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  const handleCopy = () => {
    if (chunk?.content) {
      navigator.clipboard.writeText(chunk.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  // Drag-to-resize handler on the left border of the drawer
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      // Drawer is anchored to the right side of the screen
      const calculatedWidth = window.innerWidth - moveEvent.clientX;
      const maxAllowed = Math.min(920, window.innerWidth - 280);
      const newWidth = Math.min(Math.max(calculatedWidth, 300), maxAllowed);
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

  if (!isOpen && !isPinned) return null;

  return (
    <aside
      style={{ width: `${width}px` }}
      className={`${
        isPinned
          ? 'relative border-l border-stone-200 shrink-0 shadow-none'
          : 'fixed md:absolute right-0 top-0 bottom-0 z-30 shadow-2xl border-l border-stone-200'
      } flex flex-col h-full bg-white transition-[width] duration-75 select-none`}
    >
      {/* Resizing Edge Handle on Left Border */}
      <div
        onMouseDown={handleMouseDown}
        className={`absolute top-0 -left-1 bottom-0 w-2 cursor-col-resize z-40 transition-colors group flex items-center justify-center ${
          isResizing ? 'bg-amber-500/80' : 'hover:bg-amber-400/50'
        }`}
        title="Drag left or right to resize Source Inspector"
      >
        <div className="w-[1px] h-8 rounded-full bg-stone-300 group-hover:bg-amber-600" />
      </div>

      {/* Header with Pin & Collapse Actions */}
      <div className="flex items-center justify-between p-3.5 border-b border-stone-200 bg-stone-50/80 shrink-0">
        <div className="flex items-center space-x-2">
          <Code2 className="w-4 h-4 text-amber-600" />
          <span className="text-[13.5px] font-semibold text-stone-900">Source Inspector</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={onTogglePin}
            className={`p-1.5 rounded-lg transition-colors ${
              isPinned ? 'text-amber-600 bg-amber-50 border border-amber-200' : 'text-stone-500 hover:bg-stone-200/70 hover:text-stone-900'
            }`}
            title={isPinned ? "Unpin / Float Drawer" : "Pin / Dock to screen (Split View)"}
          >
            <Pin className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-200/70 text-stone-500 hover:text-stone-900 transition-colors"
            title="Collapse Inspector"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 font-mono text-[12px]">
        {chunk ? (
          <>
            {/* File Header Card */}
            <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 space-y-2 shadow-warm-sm">
              <div className="text-[10px] text-stone-400 uppercase tracking-wider font-semibold">
                Referenced File
              </div>
              <div className="text-[13px] text-stone-900 break-all select-text font-semibold font-mono">
                {chunk.file_path || 'No file selected'}
              </div>
              <div className="flex items-center space-x-2 pt-0.5">
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-semibold">
                  Lines {chunk.start_line ?? 1} – {chunk.end_line ?? 20}
                </span>
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-orange-50 text-orange-800 border border-orange-200 font-semibold">
                  {chunk.symbol_name || chunk.symbol_type || 'code_block'}
                </span>
              </div>
            </div>

            {/* Match Telemetry */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200/90 space-y-2 shadow-warm-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-emerald-800 uppercase tracking-wider font-semibold">
                  Hybrid Match Score
                </span>
                <span className="font-bold text-[12px] text-emerald-700">
                  {chunk.match_percent || 95}% Match
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-emerald-900 pt-1.5 border-t border-emerald-200/70 font-medium">
                <div>
                  Dense Rank: <span className="font-bold text-stone-900">#{chunk.dense_rank || 1}</span>
                </div>
                <div>
                  BM25 Rank: <span className="font-bold text-stone-900">#{chunk.bm25_rank || 1}</span>
                </div>
              </div>
            </div>

            {/* Code Viewer in Warm Obsidian Container */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11.5px] text-stone-500 font-medium">
                <span>AST Code Snippet</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 hover:text-amber-700 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="text-emerald-600 font-semibold">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="bg-[#1c1917] p-3.5 rounded-2xl border border-stone-800 text-[11.5px] text-stone-200 overflow-x-auto leading-relaxed select-text shadow-sm max-h-[460px]">
                <code>
                  {chunk.content || `// Referenced File: ${chunk.file_path}\n// Lines: ${chunk.start_line}-${chunk.end_line}\n// Click 'Ingest Repository' to sync new files.`}
                </code>
              </pre>
            </div>
          </>
        ) : (
          <div className="p-8 text-center text-stone-400 font-sans text-[13px] space-y-2">
            <Code2 className="w-8 h-8 text-stone-300 mx-auto" />
            <div>Select a citation chip or file to inspect source code.</div>
          </div>
        )}
      </div>
    </aside>
  );
};
