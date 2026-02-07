from fastapi import APIRouter, Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies.auth import get_current_user, get_optional_user
from dependencies.database import get_db
from models.user import User

router = APIRouter(prefix="/api/user")


@router.get("/me")
async def get_me(
    request: Request,
    user: User | None = Depends(get_optional_user),
):
    """Get current session — returns session+user or null."""
    if not user:
        return None

    session = request.state.session
    return {
        "session": {
            "id": session.id,
            "userId": session.userId,
            "token": session.token,
            "expiresAt": session.expiresAt.isoformat(),
            "ipAddress": session.ipAddress,
            "userAgent": session.userAgent,
            "createdAt": session.createdAt.isoformat(),
            "updatedAt": session.updatedAt.isoformat(),
        },
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "emailVerified": user.emailVerified,
            "image": user.image,
            "createdAt": user.createdAt.isoformat(),
            "updatedAt": user.updatedAt.isoformat(),
        },
    }


@router.get("/profile")
async def get_profile(
    request: Request,
    user: User = Depends(get_current_user),
):
    """Get user profile (protected)."""
    session = request.state.session
    return {
        "user": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "emailVerified": user.emailVerified,
            "image": user.image,
            "createdAt": user.createdAt.isoformat(),
            "updatedAt": user.updatedAt.isoformat(),
        },
        "session": {
            "id": session.id,
            "userId": session.userId,
            "token": session.token,
            "expiresAt": session.expiresAt.isoformat(),
            "ipAddress": session.ipAddress,
            "userAgent": session.userAgent,
            "createdAt": session.createdAt.isoformat(),
            "updatedAt": session.updatedAt.isoformat(),
        },
    }
