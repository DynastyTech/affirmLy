import logging
import os
import threading
import time
from collections.abc import Awaitable, Callable
from collections import defaultdict, deque

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, Response
from openai import OpenAI
from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

logger = logging.getLogger("affirmly-api")
logging.basicConfig(level=logging.INFO)

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000").split(",")
RATE_LIMIT_MAX_REQUESTS = int(os.getenv("RATE_LIMIT_MAX_REQUESTS", "10"))
RATE_LIMIT_WINDOW_SECONDS = int(os.getenv("RATE_LIMIT_WINDOW_SECONDS", "60"))

if not OPENAI_API_KEY:
    logger.warning("OPENAI_API_KEY is not set. /api/affirmation will fail until configured.")

openai_client = OpenAI(api_key=OPENAI_API_KEY) if OPENAI_API_KEY else None

app = FastAPI(title="Affirmly API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in ALLOWED_ORIGINS if origin.strip()],
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)

_rate_limit_storage: dict[str, deque[float]] = defaultdict(deque)
_rate_limit_lock = threading.Lock()


def _get_client_identifier(request: Request) -> str:
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        first = forwarded_for.split(",")[0].strip()
        if first:
            return first
    if request.client and request.client.host:
        return request.client.host
    return "unknown-client"


@app.middleware("http")
async def rate_limit_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    if request.method == "POST" and request.url.path == "/api/affirmation":
        now = time.time()
        client_id = _get_client_identifier(request)
        with _rate_limit_lock:
            bucket = _rate_limit_storage[client_id]
            cutoff = now - RATE_LIMIT_WINDOW_SECONDS
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= RATE_LIMIT_MAX_REQUESTS:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": "RateLimitExceeded",
                        "message": "Too many requests. Please try again shortly.",
                    },
                )
            bucket.append(now)
    response = await call_next(request)
    return response


class AffirmationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=60)
    feeling: str = Field(min_length=2, max_length=280)
    details: str | None = Field(default=None, max_length=500)

    @field_validator("name")
    @classmethod
    def name_is_alpha_friendly(cls, value: str) -> str:
        cleaned = "".join(ch for ch in value if ch.isalnum() or ch in " -'")
        if not cleaned.strip():
            raise ValueError("Name must contain valid characters.")
        return cleaned.strip()


class AffirmationResponse(BaseModel):
    affirmation: str


SAFE_SYSTEM_PROMPT = (
    "You are Affirmly, a supportive and emotionally safe therapeutic affirmation assistant. "
    "Return exactly one short affirmation (2-4 sentences) personalized with the user's name "
    "and current feeling. Keep tone warm, grounded, and practical. "
    "Do not provide medical, legal, or crisis instructions. "
    "Do not mention being an AI model. "
    "Do not repeat user input verbatim if it contains unsafe content; instead, reframe gently. "
    "Never output harmful, abusive, sexual, or self-harm encouraging language."
)


def _build_user_prompt(payload: AffirmationRequest) -> str:
    details = payload.details.strip() if payload.details else "No additional details provided."
    return (
        f"Name: {payload.name}\n"
        f"Feeling: {payload.feeling}\n"
        f"Details: {details}\n\n"
        "Create one personalized affirmation."
    )


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/affirmation", response_model=AffirmationResponse)
async def create_affirmation(payload: AffirmationRequest) -> dict[str, str]:
    if not openai_client:
        raise HTTPException(status_code=500, detail="Server is missing OPENAI_API_KEY.")

    try:
        response = openai_client.responses.create(
            model=OPENAI_MODEL,
            temperature=0.7,
            max_output_tokens=180,
            input=[
                {"role": "system", "content": SAFE_SYSTEM_PROMPT},
                {"role": "user", "content": _build_user_prompt(payload)},
            ],
        )
        text = (response.output_text or "").strip()
        if not text:
            raise HTTPException(status_code=502, detail="Empty response from language model.")

        safe_text = text.replace("\x00", "").strip()
        return {"affirmation": safe_text}
    except HTTPException:
        raise
    except ValidationError as exc:
        logger.exception("Validation error: %s", exc)
        raise HTTPException(status_code=400, detail="Invalid input payload.") from exc
    except Exception as exc:  # noqa: BLE001
        logger.exception("OpenAI request failed: %s", exc)
        raise HTTPException(status_code=502, detail="Failed to generate affirmation.") from exc


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.info("Validation issue on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=422,
        content={
            "error": "ValidationError",
            "message": "Invalid request payload.",
            "details": exc.errors(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    logger.info("HTTP issue on %s: %s", request.url.path, exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": "HttpError", "message": str(exc.detail)},
    )


@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Unhandled error on %s: %s", request.url.path, exc)
    return JSONResponse(
        status_code=500,
        content={"error": "InternalServerError", "message": "Unexpected server error."},
    )
