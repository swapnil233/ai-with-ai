"""Modal sandbox manager - wraps the Modal SDK for creating and managing sandboxes."""

import asyncio
import posixpath

import modal

# Node.js 20 image with npm for running Next.js apps
IMAGE = modal.Image.debian_slim(python_version="3.12").apt_install(
    "curl"
).run_commands(
    "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
    "apt-get install -y nodejs",
    "npm install -g npm@latest",
)


class SandboxManager:
    """Manages Modal sandboxes for user projects."""

    def __init__(self) -> None:
        self._sandboxes: dict[str, modal.Sandbox] = {}
        # Tracks in-flight creation so concurrent callers can wait
        self._creating: dict[str, asyncio.Event] = {}

    async def create(self, sandbox_id: str) -> dict:
        """Create a new sandbox with Node.js 20 and tunnel on port 3000."""
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
            return {"sandboxId": sandbox_id, "status": "created"}
        finally:
            event.set()
            self._creating.pop(sandbox_id, None)

    async def _get(self, sandbox_id: str) -> modal.Sandbox:
        """Get a sandbox by ID, waiting for in-flight creation if needed."""
        # If creation is in progress, wait for it to finish
        event = self._creating.get(sandbox_id)
        if event:
            await event.wait()

        sb = self._sandboxes.get(sandbox_id)
        if not sb:
            raise KeyError(f"Sandbox '{sandbox_id}' not found")
        return sb

    async def write_files(self, sandbox_id: str, files: dict[str, str]) -> dict:
        """Write multiple files to the sandbox filesystem."""
        sb = await self._get(sandbox_id)

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
        return {"written": list(files.keys())}

    async def run_command(
        self, sandbox_id: str, command: str, background: bool = False
    ) -> dict:
        """Execute a command in the sandbox."""
        sb = await self._get(sandbox_id)
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

    async def get_tunnel_url(self, sandbox_id: str) -> dict:
        """Get the public tunnel URL for port 3000."""
        sb = await self._get(sandbox_id)
        tunnels = await sb.tunnels.aio()
        tunnel = tunnels.get(3000)
        if tunnel:
            return {"previewUrl": tunnel.url, "status": "ready"}
        return {"previewUrl": None, "status": "not_ready"}

    async def terminate(self, sandbox_id: str) -> dict:
        """Terminate and clean up a sandbox."""
        # Wait for creation to finish before terminating
        event = self._creating.get(sandbox_id)
        if event:
            await event.wait()
        sb = self._sandboxes.pop(sandbox_id, None)
        if sb:
            await sb.terminate.aio()
        return {"status": "terminated"}
