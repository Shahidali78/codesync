# ai-service — Python + FastAPI + Ollama

## Dev
```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
```

## Endpoints
| Method | Path | Model | Description |
|---|---|---|---|
| POST | `/review` | 7b | Review code and list issues |
| POST | `/explain` | 7b | Explain selected code |
| POST | `/fix` | 7b | Suggest a fix for a bug |
| POST | `/autocomplete` | 1.5b | Token-level autocomplete |

All AI endpoints stream Server-Sent Events (SSE).

## Env vars
| Variable | Default | Purpose |
|---|---|---|
| `OLLAMA_URL` | `http://localhost:11434` | Ollama HTTP endpoint |
| `AI_MODEL_HEAVY` | `qwen2.5-coder:7b` | Model for review/explain/fix |
| `AI_MODEL_LIGHT` | `qwen2.5-coder:1.5b` | Model for autocomplete |
