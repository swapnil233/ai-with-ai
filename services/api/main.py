import logging

import socketio
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse

from config import settings
from middleware.csrf import CSRFMiddleware
from middleware.security import (
    RateLimitMiddleware,
    RequestIdMiddleware,
    SecurityHeadersMiddleware,
)
from routes.chat import router as chat_router
from routes.health import router as health_router
from routes.projects import router as projects_router
from routes.sandbox import router as sandbox_router
from routes.security import router as security_router
from routes.user import router as user_router
from ws.server import sio

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

# ---------------------------------------------------------------------------
# FastAPI app
# ---------------------------------------------------------------------------

app = FastAPI(title="AI App Builder API", docs_url=None, redoc_url=None)


# ---------------------------------------------------------------------------
# Exception handlers — match Express's {"error": "..."} format
# ---------------------------------------------------------------------------


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.detail},
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc):
    msg = exc.errors()[0].get("msg", "Invalid request body")
    if msg.startswith("Value error, "):
        msg = msg[len("Value error, "):]
    return JSONResponse(status_code=400, content={"error": msg})


# ---------------------------------------------------------------------------
# Middleware (outermost → innermost in add_middleware order)
#
# Starlette applies middleware in reverse add_middleware order, so:
#   add_middleware(A); add_middleware(B) → request passes B then A
#
# We want: Request → RequestId → SecurityHeaders → RateLimit → CSRF → CORS → app
# So we add in reverse: CORS, CSRF, RateLimit, SecurityHeaders, RequestId
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.trusted_origins_list,
    allow_credentials=True,
    allow_headers=["Content-Type", "Authorization", "X-CSRF-Token", "X-Request-Id"],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RequestIdMiddleware)


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

app.include_router(health_router)
app.include_router(security_router)
app.include_router(user_router)
app.include_router(projects_router)
app.include_router(chat_router)
app.include_router(sandbox_router)


# ---------------------------------------------------------------------------
# Socket.io ASGI mount
# ---------------------------------------------------------------------------

socket_app = socketio.ASGIApp(sio, other_asgi_app=app)


# ---------------------------------------------------------------------------
# Uvicorn entrypoint: `uvicorn main:socket_app --port 4000`
# ---------------------------------------------------------------------------
