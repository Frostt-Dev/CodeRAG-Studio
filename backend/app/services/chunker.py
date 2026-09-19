import ast
import re
from typing import List, Dict, Any, Optional

class CodeChunkResult:
    def __init__(
        self,
        file_path: str,
        language: str,
        content: str,
        start_line: int,
        end_line: int,
        symbol_type: str = "code_block",
        symbol_name: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.file_path = file_path
        self.language = language
        self.content = content
        self.start_line = start_line
        self.end_line = end_line
        self.symbol_type = symbol_type
        self.symbol_name = symbol_name
        self.metadata = metadata or {}
        self.token_count = len(content.split()) # Approx fallback


def detect_language(file_path: str) -> str:
    ext = file_path.lower().split(".")[-1]
    mapping = {
        "py": "python",
        "js": "javascript",
        "jsx": "javascript",
        "ts": "typescript",
        "tsx": "typescript",
        "go": "go",
        "rs": "rust",
        "java": "java",
        "sql": "sql",
        "md": "markdown",
        "json": "json",
        "yaml": "yaml",
        "yml": "yaml",
        "html": "html",
        "css": "css",
        "sh": "bash"
    }
    return mapping.get(ext, "text")


class CodeChunker:
    def __init__(self, max_chunk_lines: int = 50, overlap_lines: int = 10):
        self.max_chunk_lines = max_chunk_lines
        self.overlap_lines = overlap_lines

    def chunk_file(self, file_path: str, content: str) -> List[CodeChunkResult]:
        language = detect_language(file_path)

        if not content.strip():
            return []

        if language == "python":
            chunks = self._chunk_python(file_path, content)
            if chunks:
                return chunks

        if language == "markdown":
            chunks = self._chunk_markdown(file_path, content)
            if chunks:
                return chunks

        # Generic structural / sliding line chunking for other languages
        return self._chunk_line_window(file_path, content, language)

    def _chunk_python(self, file_path: str, content: str) -> List[CodeChunkResult]:
        lines = content.splitlines()
        chunks = []

        try:
            tree = ast.parse(content)
        except Exception:
            return self._chunk_line_window(file_path, content, "python")

        # Top-level functions, classes, and comments
        for node in tree.body:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                start = node.lineno
                end = getattr(node, "end_lineno", min(start + 30, len(lines)))
                chunk_code = "\n".join(lines[start - 1 : end])
                chunks.append(CodeChunkResult(
                    file_path=file_path,
                    language="python",
                    content=chunk_code,
                    start_line=start,
                    end_line=end,
                    symbol_type="function",
                    symbol_name=node.name
                ))
            elif isinstance(node, ast.ClassDef):
                start = node.lineno
                end = getattr(node, "end_lineno", min(start + 50, len(lines)))
                # If class is very large, chunk methods inside it
                if end - start > self.max_chunk_lines:
                    # Capture class header docstring
                    header_end = min(start + 10, end)
                    chunks.append(CodeChunkResult(
                        file_path=file_path,
                        language="python",
                        content="\n".join(lines[start - 1 : header_end]),
                        start_line=start,
                        end_line=header_end,
                        symbol_type="class_header",
                        symbol_name=node.name
                    ))
                    # Methods
                    for item in node.body:
                        if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)):
                            m_start = item.lineno
                            m_end = getattr(item, "end_lineno", min(m_start + 30, len(lines)))
                            chunks.append(CodeChunkResult(
                                file_path=file_path,
                                language="python",
                                content="\n".join(lines[m_start - 1 : m_end]),
                                start_line=m_start,
                                end_line=m_end,
                                symbol_type="method",
                                symbol_name=f"{node.name}.{item.name}"
                            ))
                else:
                    chunk_code = "\n".join(lines[start - 1 : end])
                    chunks.append(CodeChunkResult(
                        file_path=file_path,
                        language="python",
                        content=chunk_code,
                        start_line=start,
                        end_line=end,
                        symbol_type="class",
                        symbol_name=node.name
                    ))

        # If AST captured nothing (e.g. script without functions), fallback
        if not chunks:
            return self._chunk_line_window(file_path, content, "python")

        return chunks

    def _chunk_markdown(self, file_path: str, content: str) -> List[CodeChunkResult]:
        lines = content.splitlines()
        chunks = []
        current_section = []
        section_title = None
        start_line = 1

        for idx, line in enumerate(lines, start=1):
            if re.match(r"^#{1,3}\s+", line):
                if current_section and "\n".join(current_section).strip():
                    chunks.append(CodeChunkResult(
                        file_path=file_path,
                        language="markdown",
                        content="\n".join(current_section),
                        start_line=start_line,
                        end_line=idx - 1,
                        symbol_type="markdown_section",
                        symbol_name=section_title
                    ))
                    current_section = []
                section_title = line.lstrip("#").strip()
                start_line = idx
            current_section.append(line)

        if current_section and "\n".join(current_section).strip():
            chunks.append(CodeChunkResult(
                file_path=file_path,
                language="markdown",
                content="\n".join(current_section),
                start_line=start_line,
                end_line=len(lines),
                symbol_type="markdown_section",
                symbol_name=section_title
            ))

        return chunks

    def _chunk_line_window(self, file_path: str, content: str, language: str) -> List[CodeChunkResult]:
        lines = content.splitlines()
        chunks = []
        total_lines = len(lines)
        step = max(1, self.max_chunk_lines - self.overlap_lines)

        for i in range(0, total_lines, step):
            chunk_lines = lines[i : i + self.max_chunk_lines]
            start_line = i + 1
            end_line = min(i + len(chunk_lines), total_lines)
            
            # Simple symbol inference (e.g. function/class regex)
            first_few = "\n".join(chunk_lines[:5])
            match = re.search(r"(?:function|class|interface|type|const|def|func)\s+([A-Za-z0-9_]+)", first_few)
            symbol_name = match.group(1) if match else None

            chunks.append(CodeChunkResult(
                file_path=file_path,
                language=language,
                content="\n".join(chunk_lines),
                start_line=start_line,
                end_line=end_line,
                symbol_type="code_block",
                symbol_name=symbol_name
            ))

            if i + self.max_chunk_lines >= total_lines:
                break

        return chunks
