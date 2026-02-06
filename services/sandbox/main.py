"""FastAPI sidecar that exposes Modal sandbox operations over HTTP."""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from sandbox_manager import SandboxManager

app = FastAPI(title="Sandbox Service")
manager = SandboxManager()


# --- Request / Response models ---


class CreateRequest(BaseModel):
    sandbox_id: str


class WriteFilesRequest(BaseModel):
    sandbox_id: str
    files: dict[str, str]


class RunCommandRequest(BaseModel):
    sandbox_id: str
    command: str
    background: bool = False


class SandboxIdRequest(BaseModel):
    sandbox_id: str


# --- Endpoints ---


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}


@app.post("/sandbox/create")
async def create_sandbox(req: CreateRequest) -> dict:
    try:
        return await manager.create(req.sandbox_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/sandbox/write-files")
async def write_files(req: WriteFilesRequest) -> dict:
    try:
        return await manager.write_files(req.sandbox_id, req.files)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/sandbox/run-command")
async def run_command(req: RunCommandRequest) -> dict:
    try:
        return await manager.run_command(
            req.sandbox_id, req.command, req.background
        )
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/sandbox/tunnel-url")
async def tunnel_url(req: SandboxIdRequest) -> dict:
    try:
        return await manager.get_tunnel_url(req.sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/sandbox/terminate")
async def terminate(req: SandboxIdRequest) -> dict:
    try:
        return await manager.terminate(req.sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
