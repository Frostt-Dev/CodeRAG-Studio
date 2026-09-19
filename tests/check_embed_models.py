import httpx
resp = httpx.get("https://openrouter.ai/api/v1/models")
models = resp.json().get("data", [])
embed_models = [m["id"] for m in models if "embed" in m["id"].lower()]
print("Embedding models on OpenRouter:", embed_models)
