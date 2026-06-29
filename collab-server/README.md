# collab-server — Node + TypeScript + Yjs WebSocket

## Dev
```bash
npm install
npm run dev        # ws://localhost:1234
```

## Env vars
| Variable | Default | Purpose |
|---|---|---|
| `REDIS_URL` | `redis://localhost:6379` | Pub/sub for multi-instance scaling |
| `PORT` | `1234` | WebSocket listen port |
