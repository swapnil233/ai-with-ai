import logging

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.sandbox_manager import SandboxManager

logger = logging.getLogger(__name__)

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


class ListFilesRequest(BaseModel):
    sandbox_id: str
    path: str = "/app"


class ReadFileRequest(BaseModel):
    sandbox_id: str
    file_path: str


class SandboxIdRequest(BaseModel):
    sandbox_id: str


@router.post("/create")
async def create_sandbox(req: CreateRequest):
    logger.info("[sandbox] Creating sandbox %s", req.sandbox_id)
    try:
        result = await manager.create(req.sandbox_id)
        logger.info("[sandbox] Sandbox %s created", req.sandbox_id)
        return result
    except Exception as exc:
        logger.error("[sandbox] Failed to create sandbox %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/write-files")
async def write_files(req: WriteFilesRequest):
    paths = list(req.files.keys())
    logger.info("[sandbox] Writing %d file(s) to %s: %s", len(paths), req.sandbox_id, paths)
    try:
        result = await manager.write_files(req.sandbox_id, req.files)
        logger.info("[sandbox] Wrote %d file(s) to %s", len(paths), req.sandbox_id)
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for write-files: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to write files to %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/list-files")
async def list_files(req: ListFilesRequest):
    logger.info("[sandbox] Listing files in %s (path=%s)", req.sandbox_id, req.path)
    try:
        result = await manager.list_files(req.sandbox_id, req.path)
        logger.info("[sandbox] Listed %d file(s) in %s", len(result.get("files", [])), req.sandbox_id)
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for list-files: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to list files in %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/read-file")
async def read_file(req: ReadFileRequest):
    logger.info("[sandbox] Reading file %s from %s", req.file_path, req.sandbox_id)
    try:
        result = await manager.read_file(req.sandbox_id, req.file_path)
        logger.info("[sandbox] Read file %s from %s", req.file_path, req.sandbox_id)
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for read-file: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to read file from %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/run-command")
async def run_command(req: RunCommandRequest):
    logger.info(
        "[sandbox] Running command on %s (bg=%s): %s", req.sandbox_id, req.background, req.command
    )
    try:
        result = await manager.run_command(req.sandbox_id, req.command, req.background)
        if req.background:
            logger.info("[sandbox] Command started in background on %s", req.sandbox_id)
        else:
            exit_code = result.get("exitCode", "?")
            logger.info("[sandbox] Command finished on %s (exit=%s)", req.sandbox_id, exit_code)
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for run-command: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to run command on %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/tunnel-url")
async def tunnel_url(req: SandboxIdRequest):
    logger.info("[sandbox] Getting tunnel URL for %s", req.sandbox_id)
    try:
        result = await manager.get_tunnel_url(req.sandbox_id)
        logger.info("[sandbox] Tunnel URL for %s: %s", req.sandbox_id, result.get("previewUrl"))
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for tunnel-url: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to get tunnel URL for %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/terminate")
async def terminate(req: SandboxIdRequest):
    logger.info("[sandbox] Terminating sandbox %s", req.sandbox_id)
    try:
        result = await manager.terminate(req.sandbox_id)
        logger.info("[sandbox] Sandbox %s terminated", req.sandbox_id)
        return result
    except KeyError as exc:
        logger.error("[sandbox] Sandbox not found for terminate: %s", exc)
        raise HTTPException(status_code=404, detail=str(exc))
    except Exception as exc:
        logger.error("[sandbox] Failed to terminate %s: %s", req.sandbox_id, exc)
        raise HTTPException(status_code=500, detail=str(exc))
