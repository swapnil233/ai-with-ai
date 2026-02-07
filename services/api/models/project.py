from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base


class Project(Base):
    __tablename__ = "Project"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    userId: Mapped[str] = mapped_column(String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    user: Mapped["User"] = relationship(back_populates="projects")  # noqa: F821
    chats: Mapped[list["Chat"]] = relationship(back_populates="project")  # noqa: F821
    sandbox: Mapped["Sandbox | None"] = relationship(back_populates="project", uselist=False)


class Sandbox(Base):
    __tablename__ = "Sandbox"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    projectId: Mapped[str] = mapped_column(String, ForeignKey("Project.id", ondelete="CASCADE"), unique=True, nullable=False)
    modalId: Mapped[str | None] = mapped_column(String, nullable=True)
    tunnelUrl: Mapped[str | None] = mapped_column(String, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", nullable=False)
    createdAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    updatedAt: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)

    project: Mapped["Project"] = relationship(back_populates="sandbox")
