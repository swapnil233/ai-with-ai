from datetime import datetime, timezone
from http.cookies import SimpleCookie

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from config import settings
from dependencies.database import get_db
from models.user import Session, User


def _parse_cookie(cookie_header: str | None) -> dict[str, str]:
    """Parse a raw cookie header string into a dict."""
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


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Require a valid session. Returns the User or raises 401."""
    cookie_header = request.headers.get("cookie")
    cookies = _parse_cookie(cookie_header)
    token = cookies.get(settings.better_auth_session_cookie)

    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    stmt = (
        select(Session)
        .options(joinedload(Session.user))
        .where(Session.token == token)
    )
    result = await db.execute(stmt)
    session = result.unique().scalar_one_or_none()

    if not session:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if session.expiresAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Unauthorized")

    # Stash session on request.state for downstream use
    request.state.session = session
    request.state.user = session.user
    return session.user


async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    """Attach user if session exists, otherwise return None (no 401)."""
    cookie_header = request.headers.get("cookie")
    cookies = _parse_cookie(cookie_header)
    token = cookies.get(settings.better_auth_session_cookie)

    if not token:
        return None

    stmt = (
        select(Session)
        .options(joinedload(Session.user))
        .where(Session.token == token)
    )
    result = await db.execute(stmt)
    session = result.unique().scalar_one_or_none()

    if not session:
        return None

    if session.expiresAt.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        return None

    request.state.session = session
    request.state.user = session.user
    return session.user
