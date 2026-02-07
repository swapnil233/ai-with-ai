from datetime import datetime, timezone

from cuid2 import cuid_wrapper
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from dependencies.auth import get_current_user
from dependencies.database import get_db
from middleware.security import _get_request_ip
from models.project import Project
from models.user import User
from services.audit import log_audit_event

router = APIRouter(prefix="/api/projects")

cuid = cuid_wrapper()


class CreateProjectInput(BaseModel):
    name: str
    description: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 1:
            raise ValueError("Project name is required")
        if len(v) > 100:
            raise ValueError("String must contain at most 100 character(s)")
        return v

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        if len(v) > 1000:
            raise ValueError("String must contain at most 1000 character(s)")
        if len(v) == 0:
            return None
        return v


def _project_to_dict(p: Project) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "description": p.description,
        "userId": p.userId,
        "createdAt": p.createdAt.isoformat(),
        "updatedAt": p.updatedAt.isoformat(),
    }


@router.get("/")
async def list_projects(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List projects for the authenticated user."""
    stmt = (
        select(Project)
        .where(Project.userId == user.id)
        .order_by(Project.updatedAt.desc())
    )
    result = await db.execute(stmt)
    projects = result.scalars().all()
    return [_project_to_dict(p) for p in projects]


@router.post("/", status_code=201)
async def create_project(
    body: CreateProjectInput,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new project for the authenticated user."""
    now = datetime.now(timezone.utc)
    project = Project(
        id=cuid(),
        name=body.name,
        description=body.description,
        userId=user.id,
        createdAt=now,
        updatedAt=now,
    )
    db.add(project)
    await db.commit()
    await db.refresh(project)

    log_audit_event(
        action="project.create",
        status="success",
        request_id=getattr(request.state, "request_id", None),
        source_ip=_get_request_ip(request),
        user_id=user.id,
        metadata={
            "projectId": project.id,
            "projectName": project.name,
        },
    )

    return _project_to_dict(project)


@router.get("/{project_id}")
async def get_project(
    project_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch one project by ID, scoped to authenticated user ownership."""
    if not project_id or not project_id.strip():
        raise HTTPException(status_code=400, detail="Invalid project id")

    stmt = select(Project).where(Project.id == project_id, Project.userId == user.id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return _project_to_dict(project)
