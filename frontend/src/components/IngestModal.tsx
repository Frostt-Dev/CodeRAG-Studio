import React, { useState } from 'react';
import { X, CloudSync, Zap, Loader2 } from 'lucide-react';
import { ingestGithubRepo, ingestLocalRepo } from '../services/api';

interface IngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const IngestModal: React.FC<IngestModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [tab, setTab] = useState<'github' | 'local'>('github');
  const [githubUrl, setGithubUrl] = useState('');
  const [githubBranch, setGithubBranch] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [localPath, setLocalPath] = useState('.');
  const [localName, setLocalName] = useState('Production Rag');

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (tab === 'github') {
        if (!githubUrl.trim()) {
          setErrorMsg('Please provide a valid GitHub repository URL.');
          setIsLoading(false);
          return;
        }
        setStatusMsg('Streaming GitHub zipball directly into memory (zero disk writes)...');
        const res = await ingestGithubRepo(githubUrl.trim(), githubBranch.trim() || undefined, githubToken.trim() || undefined);
        setStatusMsg(`Ingestion complete! ${res.data.new_chunks} chunks indexed across ${res.data.indexed_files} files in ${res.data.duration_seconds}s.`);
      } else {
        if (!localPath.trim()) {
          setErrorMsg('Please specify a local folder path.');
          setIsLoading(false);
          return;
        }
        setStatusMsg('Scanning directory and building language AST chunks...');
        const res = await ingestLocalRepo(localPath.trim(), localName.trim());
        setStatusMsg(`Ingestion complete! ${res.data.new_chunks} chunks indexed across ${res.data.indexed_files} files in ${res.data.duration_seconds}s.`);
      }

      setTimeout(() => {
        setIsLoading(false);
        setStatusMsg(null);
        onSuccess();
        onClose();
      }, 1500);
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err.message || 'Ingestion failed');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-md">
      <div className="w-full max-w-md bg-white border border-stone-200 rounded-3xl shadow-2xl p-6 space-y-5 relative overflow-hidden">
        <div className="sunset-accent-strip absolute top-0 left-0 right-0"></div>

        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3.5">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center">
              <CloudSync className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-[14.5px] font-semibold text-stone-900">Ingest Code Repository</h3>
              <p className="text-[11px] text-stone-500">AST chunking & PostgreSQL pgvector embedding</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-stone-100 text-stone-400 hover:text-stone-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Segmented Tabs */}
        <div className="flex p-1 rounded-xl bg-stone-100 border border-stone-200 text-[12px] font-mono">
          <button
            type="button"
            onClick={() => setTab('github')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all font-medium ${
              tab === 'github' ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            GitHub URL (In-Memory)
          </button>
          <button
            type="button"
            onClick={() => setTab('local')}
            className={`flex-1 py-1.5 px-3 rounded-lg transition-all font-medium ${
              tab === 'local' ? 'bg-white text-stone-900 font-semibold shadow-xs' : 'text-stone-500 hover:text-stone-900'
            }`}
          >
            Local Folder
          </button>
        </div>

        {/* Ingest Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {tab === 'github' ? (
            <div className="space-y-3.5">
              <div>
                <label className="block font-mono text-[11px] font-semibold text-stone-600 mb-1">
                  GitHub Repository URL
                </label>
                <input
                  type="text"
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo"
                  className="w-full bg-[#faf8f5] focus:bg-white text-[12px] font-mono text-stone-900 rounded-xl px-3 py-2 border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                />
                <p className="text-[10.5px] text-amber-700 mt-1.5 font-mono flex items-center gap-1">
                  <Zap className="w-3 h-3 text-amber-600" />
                  Streams zipball directly into memory with zero disk writes.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-mono text-[11px] font-semibold text-stone-600 mb-1">
                    Branch (Optional)
                  </label>
                  <input
                    type="text"
                    value={githubBranch}
                    onChange={(e) => setGithubBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-[#faf8f5] focus:bg-white text-[12px] font-mono text-stone-900 rounded-xl px-3 py-2 border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[11px] font-semibold text-stone-600 mb-1">
                    Token (Optional)
                  </label>
                  <input
                    type="password"
                    value={githubToken}
                    onChange={(e) => setGithubToken(e.target.value)}
                    placeholder="ghp_..."
                    className="w-full bg-[#faf8f5] focus:bg-white text-[12px] font-mono text-stone-900 rounded-xl px-3 py-2 border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div>
                <label className="block font-mono text-[11px] font-semibold text-stone-600 mb-1">
                  Local Directory Path
                </label>
                <input
                  type="text"
                  value={localPath}
                  onChange={(e) => setLocalPath(e.target.value)}
                  placeholder="."
                  className="w-full bg-[#faf8f5] focus:bg-white text-[12px] font-mono text-stone-900 rounded-xl px-3 py-2 border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                />
              </div>
              <div>
                <label className="block font-mono text-[11px] font-semibold text-stone-600 mb-1">
                  Repository Identifier
                </label>
                <input
                  type="text"
                  value={localName}
                  onChange={(e) => setLocalName(e.target.value)}
                  placeholder="Production Rag"
                  className="w-full bg-[#faf8f5] focus:bg-white text-[12px] text-stone-900 rounded-xl px-3 py-2 border border-stone-300 focus:outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/10 transition-all"
                />
              </div>
            </div>
          )}

          {/* Status & Error Feedback */}
          {statusMsg && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11.5px] font-mono space-y-1 text-amber-900 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-amber-600 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-[11.5px] font-mono text-rose-700">
              {errorMsg}
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex justify-end space-x-2.5 pt-3 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl hover:bg-stone-100 text-stone-600 text-[12.5px] font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="btn-sunset px-5 py-2 rounded-xl text-white text-[12.5px] font-medium flex items-center gap-1.5 disabled:opacity-50"
            >
              {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{isLoading ? 'Ingesting...' : 'Start Ingestion'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
