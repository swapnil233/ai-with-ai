import secrets
from urllib.parse import urlparse

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from config import settings

CSRF_COOKIE_NAME = "aiapp.csrf-token"
CSRF_HEADER_NAME = "x-csrf-token"
CSRF_TOKEN_TTL_SECONDS = 60 * 60 * 2  # 2 hours

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def create_csrf_token() -> str:
    return secrets.token_hex(32)


def _parse_cookies(cookie_header: str | None) -> dict[str, str]:
    if not cookie_header:
        return {}
    cookies: dict[str, str] = {}
    for pair in cookie_header.split(";"):
        pair = pair.strip()
        if not pair:
            continue
        parts = pair.split("=", 1)
        if len(parts) == 2:
            cookies[parts[0].strip()] = parts[1].strip()
    return cookies


def _get_origin(request: Request) -> str | None:
    origin = request.headers.get("origin")
    if origin:
        return origin
    referer = request.headers.get("referer")
    if not referer:
        return None
    try:
        parsed = urlparse(referer)
        return f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return None


def _is_trusted_origin(origin: str | None) -> bool:
    if not origin:
        return False
    try:
        parsed = urlparse(origin)
        normalized = f"{parsed.scheme}://{parsed.netloc}"
    except Exception:
        return False
    return normalized in settings.trusted_origins_list


class CSRFMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Skip safe methods and auth paths
        if request.method.upper() in SAFE_METHODS:
            return await call_next(request)

        if request.url.path.startswith("/api/auth/"):
            return await call_next(request)

        # Sandbox routes are called server-to-server (Next.js → FastAPI)
        if request.url.path.startswith("/sandbox/"):
            return await call_next(request)

        # Chat message saving is server-to-server (Next.js chat route → FastAPI)
        if "/chat/messages" in request.url.path:
            return await call_next(request)

        # Origin check
        origin = _get_origin(request)
        if not _is_trusted_origin(origin):
            return JSONResponse(
                status_code=403,
                content={"error": "Forbidden origin"},
            )

        # Token check
        cookie_header = request.headers.get("cookie")
        cookies = _parse_cookies(cookie_header)
        csrf_cookie = cookies.get(CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(CSRF_HEADER_NAME)

        if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
            return JSONResponse(
                status_code=403,
                content={"error": "Invalid CSRF token"},
            )

        response: Response = await call_next(request)
        return response


def set_csrf_cookie(response: Response, token: str) -> None:
    """Set the CSRF cookie on a response."""
    secure_flag = "; Secure" if settings.is_production else ""
    response.headers.append(
        "set-cookie",
        f"{CSRF_COOKIE_NAME}={token}; "
        f"Max-Age={CSRF_TOKEN_TTL_SECONDS}; "
        f"Path=/; "
        f"SameSite=Lax"
        f"{secure_flag}",
    )
