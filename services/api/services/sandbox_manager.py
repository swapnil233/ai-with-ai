"""Modal sandbox manager - wraps the Modal SDK for creating and managing sandboxes."""

import asyncio
import logging
import posixpath

import modal
from cuid2 import cuid_wrapper
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from services.storage import StorageService

logger = logging.getLogger(__name__)

cuid = cuid_wrapper()

# Node.js 20 image with npm for running Next.js apps
IMAGE = modal.Image.debian_slim(python_version="3.12").apt_install(
    "curl"
).run_commands(
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
    "npm install -g npm@latest",
)

# Directories to exclude from snapshots
SNAPSHOT_EXCLUDED_DIRS = {"node_modules", ".next", ".git", "__pycache__"}


class SandboxManager:
    """Manages Modal sandboxes for user projects."""

    def __init__(self) -> None:
        self._sandboxes: dict[str, modal.Sandbox] = {}
        # Tracks in-flight creation so concurrent callers can wait
        self._creating: dict[str, asyncio.Event] = {}
        self._storage = StorageService()
        self._snapshot_tasks: dict[str, asyncio.Task] = {}

    async def create(self, sandbox_id: str, db: AsyncSession | None = None) -> dict:
        """Create a new sandbox with Node.js 20 and tunnel on port 3000.

        If a snapshot exists for this project, files are restored automatically.
        """
        from datetime import datetime, timezone
        from models.project import Sandbox as SandboxModel

        event = asyncio.Event()
        self._creating[sandbox_id] = event
        try:
            app = await modal.App.lookup.aio(
                "ai-app-builder-sandboxes", create_if_missing=True
            )
            sb = await modal.Sandbox.create.aio(
                image=IMAGE,
                app=app,
                encrypted_ports=[3000],
                workdir="/app",
                timeout=60 * 30,  # 30 minute timeout
            )
            self._sandboxes[sandbox_id] = sb

            # Persist sandbox to DB
            files_restored = 0
            if db:
                now = datetime.now(timezone.utc).replace(tzinfo=None)
                modal_id = sb.object_id

                # Upsert sandbox row
                stmt = select(SandboxModel).where(SandboxModel.projectId == sandbox_id)
                result = await db.execute(stmt)
                existing = result.scalar_one_or_none()

                if existing:
                    existing.modalId = modal_id
                    existing.status = "running"
                    existing.tunnelUrl = None
                    existing.updatedAt = now
                else:
                    sandbox_row = SandboxModel(
                        id=cuid(),
                        projectId=sandbox_id,
                        modalId=modal_id,
                        status="running",
                        createdAt=now,
                        updatedAt=now,
                    )
                    db.add(sandbox_row)

                await db.commit()

            # Check for snapshot and restore
            try:
                snapshot = await self._storage.download_snapshot(sandbox_id)
                if snapshot:
                    await self.write_files(sandbox_id, snapshot)
                    files_restored = len(snapshot)
                    logger.info(
                        "[sandbox] Restored %d files from snapshot for %s",
                        files_restored,
                        sandbox_id,
                    )
            except Exception as exc:
                logger.warning(
                    "[sandbox] Failed to restore snapshot for %s: %s",
                    sandbox_id,
                    exc,
                )

            result_dict: dict = {"sandboxId": sandbox_id, "status": "created"}
            if files_restored > 0:
                result_dict["status"] = "restored"
                result_dict["filesRestored"] = files_restored
            return result_dict
        finally:
            event.set()
            self._creating.pop(sandbox_id, None)

    async def _get(self, sandbox_id: str, db: AsyncSession | None = None) -> modal.Sandbox:
        """Get a sandbox by ID, waiting for in-flight creation if needed.

        Falls back to reconnecting via Modal ID from DB if not in memory.
        """
        from models.project import Sandbox as SandboxModel

        # If creation is in progress, wait for it to finish
        event = self._creating.get(sandbox_id)
        if event:
            await event.wait()

        sb = self._sandboxes.get(sandbox_id)
        if sb:
            return sb

        # Try to reconnect from DB
        if db:
            stmt = select(SandboxModel).where(SandboxModel.projectId == sandbox_id)
            result = await db.execute(stmt)
            sandbox_row = result.scalar_one_or_none()

            if sandbox_row and sandbox_row.modalId:
                try:
                    sb = await modal.Sandbox.from_id.aio(sandbox_row.modalId)
                    self._sandboxes[sandbox_id] = sb
                    logger.info(
                        "[sandbox] Reconnected to sandbox %s (modal=%s)",
                        sandbox_id,
                        sandbox_row.modalId,
                    )
                    return sb
                except Exception as exc:
                    # Modal sandbox expired
                    logger.warning(
                        "[sandbox] Cannot reconnect to %s: %s", sandbox_id, exc
                    )
                    from datetime import datetime, timezone

                    sandbox_row.status = "expired"
                    sandbox_row.updatedAt = datetime.now(timezone.utc).replace(
                        tzinfo=None
                    )
                    await db.commit()

        raise KeyError(f"Sandbox '{sandbox_id}' not found")

    async def write_files(self, sandbox_id: str, files: dict[str, str], db: AsyncSession | None = None) -> dict:
        """Write multiple files to the sandbox filesystem."""
        sb = await self._get(sandbox_id, db)

        # Collect unique parent directories and create them in one shot
        dirs = {posixpath.dirname(p) for p in files if posixpath.dirname(p)}
        if dirs:
            mkdir_cmd = "mkdir -p " + " ".join(sorted(dirs))
            proc = await sb.exec.aio("bash", "-c", mkdir_cmd)
            await proc.wait.aio()

        for path, content in files.items():
            f = await sb.open.aio(path, "w")
            await f.write.aio(content)
            await f.close.aio()

        # Schedule debounced snapshot
        self._schedule_snapshot(sandbox_id)

        return {"written": list(files.keys())}

    def _schedule_snapshot(self, sandbox_id: str) -> None:
        """Schedule a debounced snapshot (5-second delay to batch rapid writes)."""
        existing = self._snapshot_tasks.get(sandbox_id)
        if existing and not existing.done():
            existing.cancel()
        self._snapshot_tasks[sandbox_id] = asyncio.create_task(
            self._delayed_snapshot(sandbox_id)
        )

    async def _delayed_snapshot(self, sandbox_id: str) -> None:
        """Wait then collect and upload a snapshot."""
        try:
            await asyncio.sleep(5)
            sb = self._sandboxes.get(sandbox_id)
            if not sb:
                return

            files = await self._collect_files(sb)
            if files:
                await self._storage.upload_snapshot(sandbox_id, files)
                logger.info(
                    "[sandbox] Snapshot uploaded for %s (%d files)",
                    sandbox_id,
                    len(files),
                )
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("[sandbox] Snapshot failed for %s: %s", sandbox_id, exc)

    async def _collect_files(self, sb: modal.Sandbox) -> dict[str, str]:
        """Collect all project files from the sandbox (excluding node_modules, .next, etc.)."""
        proc = await sb.exec.aio(
            "find",
            "/app",
            "-maxdepth",
            "4",
            "-not",
            "-path",
            "*/node_modules/*",
            "-not",
            "-path",
            "*/.next/*",
            "-not",
            "-path",
            "*/.git/*",
            "-not",
            "-path",
            "*/__pycache__/*",
            "-type",
            "f",
        )
        stdout = await proc.stdout.read.aio()
        await proc.wait.aio()

        file_paths = [line for line in stdout.strip().split("\n") if line]
        files: dict[str, str] = {}

        for path in file_paths:
            try:
                f = await sb.open.aio(path, "r")
                content = await f.read.aio()
                await f.close.aio()
                files[path] = content
            except Exception:
                # Skip binary or unreadable files
                continue

        return files

    async def run_command(
        self, sandbox_id: str, command: str, background: bool = False, db: AsyncSession | None = None
    ) -> dict:
        """Execute a command in the sandbox."""
        sb = await self._get(sandbox_id, db)
        process = await sb.exec.aio("bash", "-c", command)

        if background:
            return {"status": "started", "command": command}

        # Read all output then wait for exit
        stdout = await process.stdout.read.aio()
        stderr = await process.stderr.read.aio()
        exit_code = await process.wait.aio()

        return {
            "stdout": stdout,
            "stderr": stderr,
            "exitCode": exit_code,
        }

    async def get_tunnel_url(self, sandbox_id: str, db: AsyncSession | None = None) -> dict:
        """Get the public tunnel URL for port 3000."""
        from datetime import datetime, timezone
        from models.project import Sandbox as SandboxModel

        sb = await self._get(sandbox_id, db)
        tunnels = await sb.tunnels.aio()
        tunnel = tunnels.get(3000)
        if tunnel:
            # Persist tunnel URL to DB
            if db:
                stmt = select(SandboxModel).where(SandboxModel.projectId == sandbox_id)
                result = await db.execute(stmt)
                sandbox_row = result.scalar_one_or_none()
                if sandbox_row:
                    sandbox_row.tunnelUrl = tunnel.url
                    sandbox_row.updatedAt = datetime.now(timezone.utc).replace(
                        tzinfo=None
                    )
                    await db.commit()

            return {"previewUrl": tunnel.url, "status": "ready"}
        return {"previewUrl": None, "status": "not_ready"}

    async def list_files(self, sandbox_id: str, path: str = "/app", db: AsyncSession | None = None) -> dict:
        """List files in the sandbox, excluding node_modules/.next/.git."""
        sb = await self._get(sandbox_id, db)
        proc = await sb.exec.aio(
            "find",
            path,
            "-maxdepth",
            "4",
            "-not",
            "-path",
            "*/node_modules/*",
            "-not",
            "-path",
            "*/.next/*",
            "-not",
            "-path",
            "*/.git/*",
            "-type",
            "f",
        )
        stdout = await proc.stdout.read.aio()
        await proc.wait.aio()
        files = [line for line in stdout.strip().split("\n") if line]
        return {"files": files}

    async def read_file(self, sandbox_id: str, file_path: str, db: AsyncSession | None = None) -> dict:
        """Read a single file from the sandbox filesystem."""
        sb = await self._get(sandbox_id, db)
        try:
            f = await sb.open.aio(file_path, "r")
            content = await f.read.aio()
            await f.close.aio()
            return {"filePath": file_path, "content": content}
        except Exception as exc:
            return {"filePath": file_path, "content": None, "error": str(exc)}

    async def terminate(self, sandbox_id: str, db: AsyncSession | None = None) -> dict:
        """Terminate and clean up a sandbox."""
        from datetime import datetime, timezone
        from models.project import Sandbox as SandboxModel

        # Wait for creation to finish before terminating
        event = self._creating.get(sandbox_id)
        if event:
            await event.wait()

        # Take a final snapshot before terminating
        sb = self._sandboxes.get(sandbox_id)
        if sb:
            try:
                files = await self._collect_files(sb)
                if files:
                    await self._storage.upload_snapshot(sandbox_id, files)
                    logger.info("[sandbox] Final snapshot for %s before terminate", sandbox_id)
            except Exception as exc:
                logger.warning("[sandbox] Final snapshot failed for %s: %s", sandbox_id, exc)

        sb = self._sandboxes.pop(sandbox_id, None)
        if sb:
            await sb.terminate.aio()

        # Update DB status
        if db:
            stmt = select(SandboxModel).where(SandboxModel.projectId == sandbox_id)
            result = await db.execute(stmt)
            sandbox_row = result.scalar_one_or_none()
            if sandbox_row:
                sandbox_row.status = "terminated"
                sandbox_row.updatedAt = datetime.now(timezone.utc).replace(tzinfo=None)
                await db.commit()

        return {"status": "terminated"}
