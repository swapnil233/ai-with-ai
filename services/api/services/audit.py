import json
import logging
from datetime import datetime, timezone

logger = logging.getLogger("audit")


def log_audit_event(
    *,
    action: str,
    status: str,
    request_id: str | None = None,
    source_ip: str | None = None,
    user_id: str | None = None,
    metadata: dict | None = None,
) -> None:
    payload = {
        "action": action,
        "status": status,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    if request_id:
        payload["requestId"] = request_id
    if source_ip:
        payload["sourceIp"] = source_ip
    if user_id:
        payload["userId"] = user_id
    if metadata:
        payload["metadata"] = metadata

    logger.info("[AUDIT] %s", json.dumps(payload))
