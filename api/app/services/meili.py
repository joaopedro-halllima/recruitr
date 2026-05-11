from __future__ import annotations

import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from app.core.config import settings


class MeiliError(RuntimeError):
    pass


def _base_url() -> str:
    if not settings.MEILI_URL:
        raise MeiliError("MEILI_URL is not configured")
    return settings.MEILI_URL.rstrip("/")


def _request(
    method: str,
    path: str,
    payload: dict | list | None = None,
    timeout: float = 4.0,
    include_auth: bool = True,
    allow_unauth_retry: bool = True,
) -> dict:
    url = f"{_base_url()}{path}"
    req = Request(url, method=method.upper())
    req.add_header("Content-Type", "application/json")
    if include_auth and settings.MEILI_MASTER_KEY:
        req.add_header("Authorization", f"Bearer {settings.MEILI_MASTER_KEY}")

    data = None
    if payload is not None:
        data = json.dumps(payload).encode("utf-8")

    try:
        with urlopen(req, data=data, timeout=timeout) as resp:
            body = resp.read().decode("utf-8")
            if not body:
                return {}
            parsed = json.loads(body)
            if isinstance(parsed, dict):
                return parsed
            return {"data": parsed}
    except HTTPError as exc:
        if (
            allow_unauth_retry
            and include_auth
            and settings.MEILI_MASTER_KEY
            and exc.code in (401, 403)
        ):
            # Some local Meili setups run without auth and reject bearer headers.
            return _request(
                method=method,
                path=path,
                payload=payload,
                timeout=timeout,
                include_auth=False,
                allow_unauth_retry=False,
            )
        raise MeiliError(str(exc)) from exc
    except (URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise MeiliError(str(exc)) from exc


def search_index(
    *,
    index_uid: str,
    query: str,
    limit: int,
    offset: int = 0,
    filters: str | None = None,
) -> list[dict] | None:
    try:
        payload: dict = {"q": query, "limit": limit, "offset": offset}
        if filters:
            payload["filter"] = filters
        data = _request("POST", f"/indexes/{index_uid}/search", payload=payload, timeout=1.8)
        hits = data.get("hits")
        return hits if isinstance(hits, list) else []
    except MeiliError:
        return None


def ensure_index(index_uid: str, primary_key: str = "id") -> dict:
    try:
        return _request("POST", "/indexes", {"uid": index_uid, "primaryKey": primary_key})
    except MeiliError:
        # index might already exist; keep flow resilient
        return {"status": "exists_or_error"}


def update_index_settings(index_uid: str, settings_payload: dict) -> dict:
    return _request(
        "PATCH",
        f"/indexes/{index_uid}/settings",
        payload=settings_payload,
    )


def replace_documents(index_uid: str, docs: list[dict]) -> dict:
    return _request(
        "PUT",
        f"/indexes/{index_uid}/documents",
        payload=docs,
        timeout=15.0,
    )
