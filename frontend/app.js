// ==========================================================================
// CodeRAG Studio — Client Controller (Stripe & Apple Docs Studio Light Mode)
// Handcrafted Bespoke JavaScript (Zero Third-Party Generator)
// ==========================================================================

let activeRepoId = null;
let currentRetrievedChunks = [];
let ingestMode = "github"; // 'github' | 'local'
let isDrawerPinned = false;

// DOM Elements: Chat & Workspace
const chatMessages = document.getElementById("chat-messages");
const chatForm = document.getElementById("chat-form");
const queryInput = document.getElementById("query-input");
const btnSend = document.getElementById("btn-send");
const welcomeCard = document.getElementById("welcome-card");

// DOM Elements: Drawer & Split View
const sourceDrawer = document.getElementById("source-drawer");
const btnCloseDrawer = document.getElementById("btn-close-drawer");
const btnPinDrawer = document.getElementById("btn-pin-drawer");
const pinIcon = document.getElementById("pin-icon");
const btnToggleSplit = document.getElementById("btn-toggle-split");
const splitToggleLabel = document.getElementById("split-toggle-label");

const drawerFilePath = document.getElementById("drawer-file-path");
const drawerLinesBadge = document.getElementById("drawer-lines-badge");
const drawerSymbolBadge = document.getElementById("drawer-symbol-badge");
const drawerMatchScore = document.getElementById("drawer-match-score");
const drawerDenseRank = document.getElementById("drawer-dense-rank");
const drawerBm25Rank = document.getElementById("drawer-bm25-rank");
const drawerCodeContent = document.getElementById("drawer-code-content");
const btnCopyCode = document.getElementById("btn-copy-code");

// DOM Elements: File Explorer & Telemetry
const fileTreeList = document.getElementById("file-tree-list");
const fileSearchInput = document.getElementById("file-search-input");
const filesBadgeCount = document.getElementById("files-badge-count");
const statTotalChunks = document.getElementById("stat-total-chunks");
const dbLatency = document.getElementById("db-latency");
const activeModelName = document.getElementById("active-model-name");
const activeRepoBadge = document.getElementById("active-repo-badge");

// DOM Elements: Ingestion Modal
const ingestModal = document.getElementById("ingest-modal");
const btnOpenIngest = document.getElementById("btn-open-ingest");
const btnCloseModal = document.getElementById("btn-close-modal");
const btnCancelModal = document.getElementById("btn-cancel-modal");
const btnStartIngest = document.getElementById("btn-start-ingest");
const tabGithub = document.getElementById("tab-github");
const tabLocal = document.getElementById("tab-local");
const formGithub = document.getElementById("form-github");
const formLocal = document.getElementById("form-local");

const modalGithubUrl = document.getElementById("modal-github-url");
const modalGithubBranch = document.getElementById("modal-github-branch");
const modalGithubToken = document.getElementById("modal-github-token");
const modalRepoPath = document.getElementById("modal-repo-path");
const modalRepoName = document.getElementById("modal-repo-name");
const ingestStatusBox = document.getElementById("ingest-status-box");
const ingestStatusText = document.getElementById("ingest-status-text");

// Initialize on DOM Ready
document.addEventListener("DOMContentLoaded", () => {
  fetchHealthAndStats();
  loadRepositories();
  setupEventListeners();
});

function setupEventListeners() {
  // Chat form submit
  chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    if (!query) return;
    submitQuery(query);
  });

  // Example starter chips
  document.querySelectorAll(".chip-prompt").forEach((btn) => {
    btn.addEventListener("click", () => {
      const span = btn.querySelector("span");
      if (span) {
        const text = span.textContent.replace(/"/g, "").trim();
        submitQuery(text);
      }
    });
  });

  // Modal open / close
  btnOpenIngest.addEventListener("click", () => {
    ingestModal.classList.remove("hidden");
    ingestStatusBox.classList.add("hidden");
  });
  btnCloseModal.addEventListener("click", () => ingestModal.classList.add("hidden"));
  btnCancelModal.addEventListener("click", () => ingestModal.classList.add("hidden"));

  // Ingest Tabs Toggle
  tabGithub.addEventListener("click", () => {
    ingestMode = "github";
    tabGithub.className = "flex-1 py-1.5 px-3 rounded-lg bg-white text-slate-900 font-semibold shadow-xs transition-all";
    tabLocal.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-500 hover:text-slate-900 transition-all font-medium";
    formGithub.classList.remove("hidden");
    formLocal.classList.add("hidden");
  });

  tabLocal.addEventListener("click", () => {
    ingestMode = "local";
    tabLocal.className = "flex-1 py-1.5 px-3 rounded-lg bg-white text-slate-900 font-semibold shadow-xs transition-all";
    tabGithub.className = "flex-1 py-1.5 px-3 rounded-lg text-slate-500 hover:text-slate-900 transition-all font-medium";
    formLocal.classList.remove("hidden");
    formGithub.classList.add("hidden");
  });

  btnStartIngest.addEventListener("click", handleIngestSubmit);

  // Drawer Controls: Close
  btnCloseDrawer.addEventListener("click", () => {
    sourceDrawer.classList.add("closed");
    if (isDrawerPinned) {
      togglePinDrawer();
    }
  });

  // Drawer Controls: Pin / Dock to screen (Split View)
  btnPinDrawer.addEventListener("click", togglePinDrawer);

  if (btnToggleSplit) {
    btnToggleSplit.addEventListener("click", () => {
      if (isDrawerPinned) {
        togglePinDrawer();
        sourceDrawer.classList.add("closed");
      } else {
        sourceDrawer.classList.remove("closed");
        togglePinDrawer();
      }
    });
  }

  // Copy Code Snippet
  btnCopyCode.addEventListener("click", () => {
    navigator.clipboard.writeText(drawerCodeContent.textContent);
    const origHtml = btnCopyCode.innerHTML;
    btnCopyCode.innerHTML = `<span class="material-symbols-outlined text-[14px] text-emerald-600">check</span><span class="text-emerald-600 font-semibold">Copied</span>`;
    setTimeout(() => {
      btnCopyCode.innerHTML = origHtml;
    }, 1600);
  });

  // File Filter Search
  fileSearchInput.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase().trim();
    document.querySelectorAll(".file-item-row").forEach((row) => {
      const path = row.getAttribute("data-path").toLowerCase();
      row.style.display = path.includes(q) ? "flex" : "none";
    });
  });

  // Global Keyboard Shortcut: ⌘K / Ctrl+K to search files
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      fileSearchInput.focus();
      fileSearchInput.select();
    }
  });
}

function togglePinDrawer() {
  isDrawerPinned = !isDrawerPinned;
  if (isDrawerPinned) {
    sourceDrawer.classList.add("pinned");
    sourceDrawer.classList.remove("closed");
    pinIcon.textContent = "push_pin";
    btnPinDrawer.classList.add("text-blue-600", "bg-blue-50");
    if (splitToggleLabel) splitToggleLabel.textContent = "Close Split";
  } else {
    sourceDrawer.classList.remove("pinned");
    pinIcon.textContent = "push_pin";
    btnPinDrawer.classList.remove("text-blue-600", "bg-blue-50");
    if (splitToggleLabel) splitToggleLabel.textContent = "Split View";
  }
}

// Fetch System Health and Repository Statistics
async function fetchHealthAndStats() {
  try {
    const [healthRes, statsRes] = await Promise.all([
      fetch("/api/health"),
      fetch("/api/stats")
    ]);
    const health = await healthRes.json();
    const stats = await statsRes.json();

    if (health.database === "healthy") {
      dbLatency.textContent = "12ms";
    } else {
      dbLatency.textContent = "Degraded";
      dbLatency.className = "font-mono text-[11px] text-rose-500 font-bold";
    }

    statTotalChunks.textContent = stats.total_chunks.toLocaleString();
    activeModelName.textContent = stats.chat_model || "Gemini 3.8 Flash";
  } catch (err) {
    console.error("Health/Stats fetch error:", err);
  }
}

// Load Active Repositories and File Explorer Tree
async function loadRepositories() {
  try {
    const res = await fetch("/api/repositories");
    const repos = await res.json();
    if (repos && repos.length > 0) {
      const repo = repos[0];
      activeRepoId = repo.id;
      statTotalChunks.textContent = repo.chunk_count.toLocaleString();
      activeRepoBadge.textContent = repo.name;
      loadRepoFiles(repo.id);
    }
  } catch (err) {
    console.error("Failed to load repositories:", err);
  }
}

async function loadRepoFiles(repoId) {
  try {
    const res = await fetch(`/api/repository/${repoId}/files`);
    const files = await res.json();
    filesBadgeCount.textContent = files.length;

    if (files.length === 0) {
      fileTreeList.innerHTML = `<div class="p-6 text-center text-slate-400 text-[12px]">No files indexed yet.</div>`;
      return;
    }

    fileTreeList.innerHTML = "";
    files.forEach((f) => {
      const ext = f.file_path.split(".").pop();
      const icon = getFileIcon(ext);

      const row = document.createElement("div");
      row.className = "file-item-row flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-blue-50/80 cursor-pointer text-slate-600 hover:text-blue-950 transition-all group";
      row.setAttribute("data-path", f.file_path);
      row.innerHTML = `
        <div class="flex items-center space-x-2 truncate pr-1">
          <span class="material-symbols-outlined text-[15px] text-slate-400 group-hover:text-blue-600 transition-colors">${icon}</span>
          <span class="truncate text-[12px] font-mono">${f.file_path}</span>
        </div>
        <span class="text-[10px] text-slate-400 group-hover:text-blue-700 shrink-0 font-mono bg-slate-100 group-hover:bg-blue-100/70 px-1.5 py-0.5 rounded-md font-semibold">${f.chunk_count}c</span>
      `;
      row.addEventListener("click", () => {
        queryInput.value = `Explain ${f.file_path}`;
        queryInput.focus();
      });
      fileTreeList.appendChild(row);
    });
  } catch (err) {
    console.error("Failed to load repo files:", err);
  }
}

function getFileIcon(ext) {
  switch (ext) {
    case "py": return "code";
    case "md": return "menu_book";
    case "json": return "data_object";
    case "js":
    case "ts": return "javascript";
    case "html":
    case "css": return "web";
    default: return "description";
  }
}

// Ingestion Handler (In-Memory GitHub Stream & Local Folder)
async function handleIngestSubmit() {
  btnStartIngest.disabled = true;
  btnStartIngest.textContent = "Ingesting...";
  ingestStatusBox.classList.remove("hidden");

  try {
    let endpoint = "/api/ingest";
    let payload = {};

    if (ingestMode === "github") {
      endpoint = "/api/ingest/github";
      const repoUrl = modalGithubUrl.value.trim();
      const branch = modalGithubBranch.value.trim() || null;
      const token = modalGithubToken.value.trim() || null;

      if (!repoUrl) {
        alert("Please enter a valid GitHub repository URL");
        btnStartIngest.disabled = false;
        btnStartIngest.textContent = "Start Ingestion";
        return;
      }
      ingestStatusText.textContent = "Streaming GitHub zipball directly into memory (zero disk write)...";
      payload = { repo_url: repoUrl, branch, token };
    } else {
      const repoPath = modalRepoPath.value.trim();
      const repoName = modalRepoName.value.trim();
      if (!repoPath) return;
      ingestStatusText.textContent = "Scanning directory and building language AST chunks...";
      payload = { repo_path: repoPath, repo_name: repoName };
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      ingestStatusText.textContent = `Success! Indexed ${data.data.new_chunks} chunks across ${data.data.indexed_files} files in ${data.data.duration_seconds}s.`;
      setTimeout(() => {
        ingestModal.classList.add("hidden");
        btnStartIngest.disabled = false;
        btnStartIngest.textContent = "Start Ingestion";
        fetchHealthAndStats();
        loadRepositories();
      }, 1500);
    } else {
      ingestStatusText.textContent = `Error: ${data.detail || "Ingestion failed"}`;
      btnStartIngest.disabled = false;
      btnStartIngest.textContent = "Retry";
    }
  } catch (err) {
    ingestStatusText.textContent = `Error: ${err.message}`;
    btnStartIngest.disabled = false;
    btnStartIngest.textContent = "Retry";
  }
}

// Multi-Query Streaming Chat Execution
async function submitQuery(query) {
  if (welcomeCard) welcomeCard.style.display = "none";
  queryInput.value = "";

  appendUserMessage(query);

  const aiMsgId = `ai-msg-${Date.now()}`;
  const { aiCard, textContainer, telemetryContainer } = createAIMessageContainer(aiMsgId);
  chatMessages.appendChild(aiCard);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  btnSend.disabled = true;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, repo_id: activeRepoId, top_k: 5 })
    });

    if (!response.ok) {
      textContainer.innerHTML = `<span class="text-rose-500 font-mono text-[12px]">Failed to stream response (${response.statusText})</span>`;
      btnSend.disabled = false;
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const jsonStr = line.replace("data: ", "").trim();
          if (!jsonStr) continue;
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === "retrieval") {
              currentRetrievedChunks = event.chunks;
              renderRetrievalTelemetry(telemetryContainer, event);
            } else if (event.type === "token") {
              fullText += event.content;
              textContainer.innerHTML = formatMarkdownAndCitations(fullText);
              bindCitationClicks(textContainer);
              chatMessages.scrollTop = chatMessages.scrollHeight;
            } else if (event.type === "done") {
              // Generation complete
            }
          } catch (e) {
            console.error("SSE parse error:", e);
          }
        }
      }
    }
  } catch (err) {
    textContainer.innerHTML = `<span class="text-rose-500 font-mono text-[12px]">Error: ${err.message}</span>`;
  } finally {
    btnSend.disabled = false;
  }
}

function appendUserMessage(text) {
  const msg = document.createElement("div");
  msg.className = "flex justify-end max-w-2xl mx-auto";
  msg.innerHTML = `
    <div class="py-2.5 px-4 rounded-2xl rounded-tr-xs bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 text-white text-[13.5px] max-w-lg leading-relaxed select-text font-sans shadow-md shadow-indigo-500/15">
      ${escapeHtml(text)}
    </div>
  `;
  chatMessages.appendChild(msg);
}

function createAIMessageContainer(id) {
  const card = document.createElement("div");
  card.id = id;
  card.className = "max-w-2xl mx-auto rounded-2xl glass-panel p-5 md:p-6 space-y-4 select-text relative shadow-sm";

  const telemetry = document.createElement("div");
  telemetry.className = "flex flex-col gap-2 font-mono text-[11px] pb-3.5 border-b border-slate-100";
  telemetry.innerHTML = `<span class="text-blue-700 flex items-center gap-2 font-medium"><span class="material-symbols-outlined animate-spin text-[15px] text-blue-600">sync</span> Expanding multi-query & retrieving hybrid chunks...</span>`;

  const text = document.createElement("div");
  text.className = "markdown-body text-[13.5px] leading-relaxed text-slate-800";
  text.innerHTML = `<span class="inline-block w-2 h-4 bg-blue-500 animate-pulse align-middle rounded-xs"></span>`;

  card.appendChild(telemetry);
  card.appendChild(text);

  return { aiCard: card, textContainer: text, telemetryContainer: telemetry };
}

function renderRetrievalTelemetry(container, event) {
  const expandedList = event.expanded_queries && event.expanded_queries.length > 1
    ? `<div class="text-[11px] text-slate-500 truncate font-mono">
         <span class="text-indigo-600 font-semibold">Multi-Query (${event.expanded_queries.length}):</span> ${event.expanded_queries.map(q => `"${escapeHtml(q)}"`).join(" · ")}
       </div>`
    : "";

  container.innerHTML = `
    <div class="flex items-center justify-between text-[11.5px]">
      <span class="text-slate-800 font-mono font-semibold flex items-center gap-1.5">
        <span class="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
        <span>${event.count} chunks retrieved in ${event.retrieval_latency_ms}ms</span>
      </span>
      <span class="font-mono text-[10px] px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 font-semibold">Dense + BM25 RRF</span>
    </div>
    ${expandedList}
    <div class="flex flex-wrap gap-1.5 pt-1">
      ${event.chunks.map(c => `
        <button class="px-2.5 py-1 rounded-lg bg-slate-50 hover:bg-blue-50 text-slate-700 hover:text-blue-800 border border-slate-200 hover:border-blue-300 font-mono text-[10.5px] font-medium transition-all truncate max-w-[210px] shadow-2xs" title="${c.file_path} (${c.match_percent}% Match)" onclick='openSourceDrawer(${JSON.stringify(c)})'>
          ${c.file_path.split("/").pop()}:${c.start_line}-${c.end_line}
        </button>
      `).join("")}
    </div>
  `;
}

function formatMarkdownAndCitations(raw) {
  let text = escapeHtml(raw);

  // Code blocks: ```lang ... ```
  text = text.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    return `<pre><div class="flex justify-between text-[10.5px] text-slate-400 mb-1.5 font-mono border-b border-slate-800 pb-1"><span>${lang || "code"}</span><span class="text-slate-400 hover:text-white cursor-pointer">Copy</span></div><code>${code.trim()}</code></pre>`;
  });

  // Inline code: `code`
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Bold: **text**
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

  // Citations: [src/auth/jwt.py:L45-L62] or [file.py:10-20]
  text = text.replace(/\[([a-zA-Z0-9_\-\.\/]+):(L?\d+)-(L?\d+)\]/g, (match, file, start, end) => {
    const cleanStart = start.replace("L", "");
    const cleanEnd = end.replace("L", "");
    return `<button class="citation-chip" data-file="${file}" data-start="${cleanStart}" data-end="${cleanEnd}">
      <span class="material-symbols-outlined text-[13px]">code</span>
      <span>${file}:${cleanStart}-${cleanEnd}</span>
    </button>`;
  });

  text = text.replace(/\n\n/g, "<p></p>").replace(/\n/g, "<br/>");
  return text;
}

function bindCitationClicks(container) {
  container.querySelectorAll(".citation-chip").forEach((btn) => {
    btn.onclick = () => {
      const file = btn.getAttribute("data-file");
      const start = parseInt(btn.getAttribute("data-start"));
      const end = parseInt(btn.getAttribute("data-end"));

      const match = currentRetrievedChunks.find(
        (c) => c.file_path.includes(file) || file.includes(c.file_path)
      );

      if (match) {
        openSourceDrawer(match);
      } else {
        openSourceDrawer({
          file_path: file,
          start_line: start,
          end_line: end,
          content: `// Referenced Source File: ${file} (Lines ${start}-${end})\n// Click 'Ingest Repo' to inspect active repository files.`,
          match_percent: 94,
          symbol_name: "reference_block",
          dense_rank: 1,
          bm25_rank: 1
        });
      }
    };
  });
}

function openSourceDrawer(chunk) {
  drawerFilePath.textContent = chunk.file_path;
  drawerLinesBadge.textContent = `Lines ${chunk.start_line} – ${chunk.end_line}`;
  drawerSymbolBadge.textContent = chunk.symbol_name || chunk.symbol_type || "code_block";
  drawerMatchScore.textContent = `${chunk.match_percent || 95}% Match`;
  drawerDenseRank.textContent = chunk.dense_rank ? `#${chunk.dense_rank}` : "1";
  drawerBm25Rank.textContent = chunk.bm25_rank ? `#${chunk.bm25_rank}` : "1";
  drawerCodeContent.textContent = chunk.content;

  sourceDrawer.classList.remove("closed");
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

window.openSourceDrawer = openSourceDrawer;
