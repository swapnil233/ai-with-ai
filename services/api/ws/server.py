import logging
from datetime import datetime, timezone
from urllib.parse import unquote

import socketio
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from config import settings
from models.base import async_session
from models.user import Session, User

logger = logging.getLogger("socketio")


def _extract_token(signed_cookie: str) -> str | None:
    """Extract the plain token from a better-auth signed cookie (TOKEN.SIGNATURE)."""
    value = unquote(signed_cookie)
    last_dot = value.rfind(".")
    if last_dot < 1:
        return value
    return value[:last_dot]

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.trusted_origins_list,
    cors_credentials=True,
)


def _parse_cookies(cookie_header: str) -> dict[str, str]:
    cookies: dict[str, str] = {}
    for pair in cookie_header.split(";"):
        pair = pair.strip()
        if not pair:
            continue
        parts = pair.split("=", 1)
        if len(parts) == 2:
            cookies[parts[0].strip()] = parts[1].strip()
    return cookies


@sio.event
async def connect(sid, environ, auth_data):
    """Authenticate WebSocket connections using the session cookie."""
    cookie_header = environ.get("HTTP_COOKIE", "")
    if not cookie_header:
        raise socketio.exceptions.ConnectionRefusedError("Authentication required")

    cookies = _parse_cookies(cookie_header)
    token = cookies.get(settings.better_auth_session_cookie)
    if not token:
        raise socketio.exceptions.ConnectionRefusedError("Authentication required")

    async with async_session() as db:
        stmt = (
            select(Session)
            .options(joinedload(Session.user))
            .where(Session.token == _extract_token(token))
        )
        result = await db.execute(stmt)
        session = result.unique().scalar_one_or_none()

    if not session:
        raise socketio.exceptions.ConnectionRefusedError("Invalid session")

    if session.expiresAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise socketio.exceptions.ConnectionRefusedError("Session expired")

    # Store user info on the session for later use
    await sio.save_session(sid, {
        "user_id": session.user.id,
        "user_email": session.user.email,
    })

    logger.info("Client connected: %s (user: %s)", sid, session.user.email)


@sio.event
async def disconnect(sid):
    logger.info("Client disconnected: %s", sid)
