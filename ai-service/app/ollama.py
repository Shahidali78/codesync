"""
Async Ollama HTTP client.

stream_generate()  — yields text tokens one-by-one from /api/generate (SSE-friendly).
complete()         — collects the full response in one shot (for autocomplete).
"""

import json
import logging
from typing import AsyncIterator

import httpx

from .config import settings

log = logging.getLogger(__name__)

# Separate connect vs. read timeout so a slow model doesn't look like a
# connection failure, but a cold Ollama start fails fast.
_TIMEOUT = httpx.Timeout(connect=5.0, read=120.0, write=10.0, pool=5.0)


def _generate_url() -> str:
    return f"{settings.ollama_url}/api/generate"


async def stream_generate(
    model: str,
    prompt: str,
    system: str = "",
    temperature: float = 0.3,
    num_predict: int = 2048,
) -> AsyncIterator[str]:
    """
    Async generator that yields text tokens from Ollama.
    Handles connection errors gracefully so callers can stream an error
    message back to the browser instead of raising an HTTP 500.
    """
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": num_predict,
        },
    }
    if system:
        payload["system"] = system

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            async with client.stream("POST", _generate_url(), json=payload) as resp:
                resp.raise_for_status()
                async for raw_line in resp.aiter_lines():
                    if not raw_line:
                        continue
                    try:
                        data = json.loads(raw_line)
                    except json.JSONDecodeError:
                        log.warning("Unparseable Ollama line: %s", raw_line)
                        continue

                    token: str = data.get("response", "")
                    if token:
                        yield token
                    if data.get("done"):
                        break

    except httpx.ConnectError:
        yield (
            "\n\n[AI service error: cannot reach Ollama at "
            f"{settings.ollama_url}. "
            "Make sure Ollama is running on the host machine.]"
        )
    except httpx.HTTPStatusError as exc:
        yield f"\n\n[AI service error: Ollama returned HTTP {exc.response.status_code}]"
    except httpx.TimeoutException:
        yield "\n\n[AI service error: Ollama request timed out. The model may still be loading.]"
    except Exception as exc:  # noqa: BLE001
        log.exception("Unexpected error streaming from Ollama")
        yield f"\n\n[AI service error: {exc}]"


async def complete(
    model: str,
    prompt: str,
    temperature: float = 0.1,
    num_predict: int = 256,
) -> str:
    """Non-streaming completion — used for autocomplete."""
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "top_p": 0.9,
            "num_predict": num_predict,
        },
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.post(_generate_url(), json=payload)
            resp.raise_for_status()
            return resp.json().get("response", "")
    except Exception as exc:  # noqa: BLE001
        log.error("Autocomplete error: %s", exc)
        return ""
