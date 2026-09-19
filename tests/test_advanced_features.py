import sys
import os
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

import asyncio
from app.services.query_expander import query_expander
from app.services.github_ingest import github_ingest_service

async def test_query_expansion():
    print("--- 1. Testing Multi-Query Expansion ---")
    question = "How does the AST chunker handle python functions and classes?"
    queries = await query_expander.expand_query(question)
    print(f"Original: {question}")
    print(f"Expanded Queries ({len(queries)}):")
    for idx, q in enumerate(queries, 1):
        print(f"  [{idx}] {q}")
    assert len(queries) >= 2, "Expected at least 2 expanded queries"
    print("Multi-Query Expansion: PASSED\n")

def test_github_url_parsing():
    print("--- 2. Testing GitHub URL Parsing ---")
    urls = [
        "https://github.com/fastapi/fastapi",
        "https://github.com/psf/requests.git",
        "github.com/pallets/flask"
    ]
    for u in urls:
        owner, repo = github_ingest_service.parse_repo_url(u)
        print(f"URL: {u} -> owner: {owner}, repo: {repo}")
        assert owner and repo
    print("GitHub URL Parsing: PASSED\n")

async def main():
    test_github_url_parsing()
    await test_query_expansion()

if __name__ == "__main__":
    asyncio.run(main())
