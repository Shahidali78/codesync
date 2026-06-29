# frontend — React + TypeScript + Vite + Monaco

## Dev
```bash
npm install
npm run dev        # http://localhost:5173
```

## Build
```bash
npm run build      # output: dist/
```

## Env vars (prefix `VITE_` — baked in at build time)
| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8080` | Spring Boot API base URL |
| `VITE_WS_URL` | `ws://localhost:1234` | Yjs collaboration WebSocket |
| `VITE_AI_URL` | `http://localhost:8001` | FastAPI AI service base URL |
