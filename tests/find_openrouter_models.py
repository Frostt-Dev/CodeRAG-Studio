import httpx
import json

resp = httpx.get("https://openrouter.ai/api/v1/models")
data = resp.json()
models = data.get("data", [])

print(f"Total models on OpenRouter: {len(models)}")
nemotron_models = [m["id"] for m in models if "nemotron" in m["id"].lower()]
print("Nemotron models found:", nemotron_models)

nvidia_models = [m["id"] for m in models if "nvidia" in m["id"].lower()]
print("NVIDIA models found:", nvidia_models)
