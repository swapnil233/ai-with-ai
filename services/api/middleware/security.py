import math
import threading
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import settings


# ---------------------------------------------------------------------------
# Request ID
# ---------------------------------------------------------------------------

class RequestIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        incoming = request.headers.get("x-request-id", "").strip()
        request_id = incoming if incoming else str(uuid.uuid4())
        request.state.request_id = request_id
        response: Response = await call_next(request)
        response.headers["x-request-id"] = request_id
        return response


# ---------------------------------------------------------------------------
# Security headers
# ---------------------------------------------------------------------------

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["x-content-type-options"] = "nosniff"
        response.headers["x-frame-options"] = "DENY"
        response.headers["referrer-policy"] = "no-referrer"
        response.headers["x-dns-prefetch-control"] = "off"
        response.headers["x-xss-protection"] = "0"
        response.headers["permissions-policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["content-security-policy"] = (
            "default-src 'none'; frame-ancestors 'none'; base-uri 'none'"
        )
        if settings.is_production:
            response.headers["strict-transport-security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


# ---------------------------------------------------------------------------
# Rate limiting (in-memory, per IP:METHOD)
# ---------------------------------------------------------------------------

_rate_limit_store: dict[str, dict] = {}
_rate_limit_lock = threading.Lock()


def _get_request_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        first_ip = forwarded.split(",")[0].strip()
        if first_ip:
            return first_ip
    if request.client:
        return request.client.host
    return "unknown"


def _cleanup_rate_limit_store() -> None:
    now = time.time() * 1000
    expired = [k for k, v in _rate_limit_store.items() if v["resetAt"] <= now]
    for k in expired:
        _rate_limit_store.pop(k, None)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ip = _get_request_ip(request)
        key = f"{ip}:{request.method}"
        now = time.time() * 1000
        max_requests = settings.rate_limit_max
        window_ms = settings.rate_limit_window_ms

        with _rate_limit_lock:
            _cleanup_rate_limit_store()
            entry = _rate_limit_store.get(key)
            if not entry or entry["resetAt"] <= now:
                entry = {"count": 1, "resetAt": now + window_ms}
                _rate_limit_store[key] = entry
            else:
                entry["count"] += 1

            count = entry["count"]
            reset_at = entry["resetAt"]

        remaining = max(max_requests - count, 0)

        if count > max_requests:
            retry_after = max(math.ceil((reset_at - now) / 1000), 1)
            resp = JSONResponse(
                status_code=429,
                content={"error": "Too many requests"},
            )
            resp.headers["x-ratelimit-limit"] = str(max_requests)
            resp.headers["x-ratelimit-remaining"] = "0"
            resp.headers["x-ratelimit-reset"] = str(math.ceil(reset_at / 1000))
            resp.headers["retry-after"] = str(retry_after)
            return resp

        response: Response = await call_next(request)
        response.headers["x-ratelimit-limit"] = str(max_requests)
        response.headers["x-ratelimit-remaining"] = str(remaining)
        response.headers["x-ratelimit-reset"] = str(math.ceil(reset_at / 1000))
        return response
