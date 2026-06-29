#!/usr/bin/env bash
# Run this once on the host after installing Ollama.
# It pulls both models used by the AI service.
set -euo pipefail

OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"

echo "Pulling qwen2.5-coder:7b  (heavy model — review/explain/fix)…"
curl -fsSL -X POST "${OLLAMA_URL}/api/pull" \
  -H "Content-Type: application/json" \
  -d '{"name":"qwen2.5-coder:7b"}' | tail -1

echo ""
echo "Pulling qwen2.5-coder:1.5b (light model — autocomplete)…"
curl -fsSL -X POST "${OLLAMA_URL}/api/pull" \
  -H "Content-Type: application/json" \
  -d '{"name":"qwen2.5-coder:1.5b"}' | tail -1

echo ""
echo "Done. Verify with: curl ${OLLAMA_URL}/api/tags"
