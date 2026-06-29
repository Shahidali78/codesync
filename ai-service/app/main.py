"""
CodeSync AI service — FastAPI + Ollama

Endpoints
---------
POST /review        — stream code review (heavy model)
POST /explain       — stream code explanation (heavy model)
POST /fix           — stream bug fix suggestions (heavy model)
POST /autocomplete  — single-shot completion (light model)
GET  /health        — liveness probe
"""

import logging
from typing import AsyncIterator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sse_starlette.sse import EventSourceResponse

from .config import settings
from .ollama import complete, stream_generate

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

app = FastAPI(title="CodeSync AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


# ── Request / response models ────────────────────────────────────────────────

class CodeRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=65_536)
    language: str = Field(default="unknown", max_length=50)


class AutocompleteRequest(BaseModel):
    prefix: str = Field(..., max_length=8_192)
    language: str = Field(default="unknown", max_length=50)


class AutocompleteResponse(BaseModel):
    completion: str


# ── Prompt builders ──────────────────────────────────────────────────────────

def _code_block(code: str, language: str) -> str:
    return f"```{language}\n{code}\n```"


def _review_prompt(code: str, language: str) -> str:
    return (
        f"Review the following {language} code.\n\n"
        "Find and explain:\n"
        "1. Bugs and potential runtime errors\n"
        "2. Security vulnerabilities\n"
        "3. Performance problems\n"
        "4. Code style and maintainability issues\n\n"
        "For each issue: state what it is, where it occurs, and how to fix it. "
        "Be direct and specific.\n\n"
        f"{_code_block(code, language)}"
    )


def _explain_prompt(code: str, language: str) -> str:
    return (
        f"Explain the following {language} code to a developer.\n\n"
        "Cover:\n"
        "- What the code does overall\n"
        "- How it works step by step\n"
        "- Any notable patterns, algorithms, or design decisions\n\n"
        "Be clear and concise.\n\n"
        f"{_code_block(code, language)}"
    )


def _fix_prompt(code: str, language: str) -> str:
    return (
        f"Analyse the following {language} code and fix any issues.\n\n"
        "Structure your response as:\n"
        "1. What is wrong (and where)\n"
        "2. The corrected code (in a code block)\n"
        "3. A brief explanation of each change\n\n"
        f"{_code_block(code, language)}"
    )


def _autocomplete_prompt(prefix: str, language: str) -> str:
    # qwen2.5-coder supports FIM (fill-in-middle) tokens natively.
    # Using raw completion with explicit instruction works more reliably across
    # different model sizes and avoids token-leakage artefacts in the output.
    return (
        f"Continue this {language} code. "
        "Output only the completion — no explanations, no markdown, no preamble.\n\n"
        f"{prefix}"
    )


# ── SSE wrapper ──────────────────────────────────────────────────────────────

async def _sse_stream(model: str, prompt: str, system: str = "") -> AsyncIterator[dict]:
    """Wraps stream_generate() into the dict format EventSourceResponse expects."""
    async for token in stream_generate(model, prompt, system=system):
        yield {"data": token}


# ── Routes ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health() -> dict:
    return {"status": "ok", "heavy_model": settings.ai_model_heavy, "light_model": settings.ai_model_light}


@app.post("/review")
async def review(req: CodeRequest) -> EventSourceResponse:
    log.info("review  lang=%s  code_len=%d", req.language, len(req.code))
    prompt = _review_prompt(req.code, req.language)
    return EventSourceResponse(
        _sse_stream(settings.ai_model_heavy, prompt),
        media_type="text/event-stream",
    )


@app.post("/explain")
async def explain(req: CodeRequest) -> EventSourceResponse:
    log.info("explain lang=%s  code_len=%d", req.language, len(req.code))
    prompt = _explain_prompt(req.code, req.language)
    return EventSourceResponse(
        _sse_stream(settings.ai_model_heavy, prompt),
        media_type="text/event-stream",
    )


@app.post("/fix")
async def fix(req: CodeRequest) -> EventSourceResponse:
    log.info("fix     lang=%s  code_len=%d", req.language, len(req.code))
    prompt = _fix_prompt(req.code, req.language)
    return EventSourceResponse(
        _sse_stream(settings.ai_model_heavy, prompt),
        media_type="text/event-stream",
    )


@app.post("/autocomplete", response_model=AutocompleteResponse)
async def autocomplete(req: AutocompleteRequest) -> AutocompleteResponse:
    log.info("autocomplete lang=%s  prefix_len=%d", req.language, len(req.prefix))
    prompt = _autocomplete_prompt(req.prefix, req.language)
    text = await complete(
        settings.ai_model_light,
        prompt,
        temperature=0.1,
        num_predict=128,
    )
    # Strip any FIM residual tokens the model may leak
    for tok in ("<|fim_prefix|>", "<|fim_suffix|>", "<|fim_middle|>", "<|endoftext|>"):
        text = text.replace(tok, "")
    return AutocompleteResponse(completion=text.strip())
