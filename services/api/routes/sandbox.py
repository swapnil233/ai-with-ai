from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox_manager import SandboxManager

router = APIRouter(prefix="/sandbox")

manager = SandboxManager()


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


@router.post("/create")
async def create_sandbox(req: CreateRequest):
    try:
        return await manager.create(req.sandbox_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/write-files")
async def write_files(req: WriteFilesRequest):
    try:
        return await manager.write_files(req.sandbox_id, req.files)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run-command")
async def run_command(req: RunCommandRequest):
    try:
        return await manager.run_command(req.sandbox_id, req.command, req.background)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/tunnel-url")
async def tunnel_url(req: SandboxIdRequest):
    try:
        return await manager.get_tunnel_url(req.sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/terminate")
async def terminate(req: SandboxIdRequest):
    try:
        return await manager.terminate(req.sandbox_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
