"""Chat persistence endpoints — nested under /api/projects/{project_id}/chat."""

import logging
from datetime import datetime, timezone

from cuid2 import cuid_wrapper
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from dependencies.database import get_db
from models.chat import Chat, Message
from models.project import Project

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/projects/{project_id}/chat")

cuid = cuid_wrapper()


class MessageInput(BaseModel):
    id: str
    role: str
    content: str


class SaveMessagesInput(BaseModel):
    userId: str
    messages: list[MessageInput]


@router.get("")
async def get_chat(
    project_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Load the chat and messages for a project."""
    stmt = (
        select(Chat)
        .options(selectinload(Chat.messages))
        .where(Chat.projectId == project_id)
    )
    result = await db.execute(stmt)
    chat = result.scalar_one_or_none()

    if not chat:
        return {"chat": None, "messages": []}

    messages = sorted(chat.messages, key=lambda m: m.createdAt)
    return {
        "chat": {
            "id": chat.id,
            "projectId": chat.projectId,
            "userId": chat.userId,
            "createdAt": chat.createdAt.isoformat(),
            "updatedAt": chat.updatedAt.isoformat(),
        },
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "createdAt": m.createdAt.isoformat(),
            }
            for m in messages
        ],
    }


@router.post("/messages")
async def save_messages(
    project_id: str,
    body: SaveMessagesInput,
    db: AsyncSession = Depends(get_db),
):
    """Save messages (batch upsert). Called server-to-server from chat route."""
    now = datetime.now(timezone.utc).replace(tzinfo=None)

    # Verify project exists
    proj_stmt = select(Project).where(Project.id == project_id)
    proj_result = await db.execute(proj_stmt)
    project = proj_result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Find or create chat
    chat_stmt = select(Chat).where(Chat.projectId == project_id)
    chat_result = await db.execute(chat_stmt)
    chat = chat_result.scalar_one_or_none()

    if not chat:
        chat = Chat(
            id=cuid(),
            projectId=project_id,
            userId=body.userId,
            createdAt=now,
            updatedAt=now,
        )
        db.add(chat)
        await db.flush()

    # Upsert messages
    existing_ids = set()
    if body.messages:
        msg_ids = [m.id for m in body.messages]
        existing_stmt = select(Message.id).where(Message.id.in_(msg_ids))
        existing_result = await db.execute(existing_stmt)
        existing_ids = {row[0] for row in existing_result}

    for msg in body.messages:
        if msg.id in existing_ids:
            # Update content (assistant messages may grow during streaming)
            update_stmt = (
                select(Message).where(Message.id == msg.id)
            )
            update_result = await db.execute(update_stmt)
            existing_msg = update_result.scalar_one_or_none()
            if existing_msg:
                existing_msg.content = msg.content
        else:
            new_msg = Message(
                id=msg.id,
                chatId=chat.id,
                role=msg.role,
                content=msg.content,
                createdAt=now,
            )
            db.add(new_msg)

    chat.updatedAt = now
    await db.commit()

    return {"status": "ok", "chatId": chat.id}
