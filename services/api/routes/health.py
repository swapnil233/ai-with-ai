import time
from datetime import datetime, timezone

from fastapi import APIRouter

router = APIRouter()

_start_time = time.monotonic()


@router.get("/health")
async def health():
    return {
        "status": "ok",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "uptime": time.monotonic() - _start_time,
    }
