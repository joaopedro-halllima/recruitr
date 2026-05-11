from __future__ import annotations

import json
from urllib import request

from app.core.config import settings


def publish_user_event(user_id: int, event: str, payload: dict) -> None:
    """
    Publish a realtime user event (Centrifugo HTTP API compatible).
    Safe no-op when realtime is disabled or not configured.
    """
    if not settings.REALTIME_ENABLED:
        return
    if not settings.CENTRIFUGO_URL or not settings.CENTRIFUGO_API_KEY:
        return

    body = json.dumps(
        {
            "method": "publish",
            "params": {
                "channel": f"user:{user_id}",
                "data": {"event": event, **payload},
            },
        }
    ).encode("utf-8")

    req = request.Request(
        settings.CENTRIFUGO_URL,
        data=body,
        method="POST",
        headers={
            "Content-Type": "application/json",
            "Authorization": f"apikey {settings.CENTRIFUGO_API_KEY}",
        },
    )

    # Non-blocking behavior: calling code should swallow exceptions for now.
    with request.urlopen(req, timeout=2.0):
        pass

