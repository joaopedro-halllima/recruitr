from __future__ import annotations

import json
import os
import re
import uuid
from pathlib import Path
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.core.config import REPO_ROOT_DIR, settings
from app.db.deps import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/uploads", tags=["uploads"])

MAX_UPLOAD_BYTES = settings.MAX_UPLOAD_BYTES
DEV_SAMPLE_MEDIA_DIR = REPO_ROOT_DIR / "data" / "sample_media"

ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}
ALLOWED_VIDEO_MIME_TYPES = {"video/mp4", "video/quicktime", "video/webm"}
ALLOWED_DOCUMENT_MIME_TYPES = {"application/pdf"}
ALLOWED_EXTENSIONS = {
    "image": {".jpg", ".jpeg", ".png", ".webp", ".gif"},
    "video": {".mp4", ".mov", ".webm"},
    "document": {".pdf"},
}


class DmPresignRequest(BaseModel):
    filename: str = Field(min_length=1, max_length=255)
    mime_type: str = Field(min_length=1, max_length=120)
    byte_size: int = Field(ge=1, le=MAX_UPLOAD_BYTES)
    kind: Literal["image", "video", "document"]


def _safe_filename(name: str) -> str:
    base = Path(name).name.strip()
    if not base:
        return "upload.bin"
    cleaned = re.sub(r"[^a-zA-Z0-9._-]", "_", base)
    return cleaned[:120]


def _allowed_mime_types(kind: str) -> set[str]:
    if kind == "image":
        return ALLOWED_IMAGE_MIME_TYPES
    if kind == "video":
        return ALLOWED_VIDEO_MIME_TYPES
    if kind == "document":
        return ALLOWED_DOCUMENT_MIME_TYPES
    return set()


def _validate_declared_upload(payload: DmPresignRequest) -> None:
    mime_type = payload.mime_type.strip().lower()
    ext = Path(payload.filename).suffix.lower()

    if mime_type not in _allowed_mime_types(payload.kind):
        raise HTTPException(status_code=400, detail="File type is not supported")
    if ext not in ALLOWED_EXTENSIONS[payload.kind]:
        raise HTTPException(status_code=400, detail="File extension is not supported")


async def _read_validated_body(request: Request, expected_size: int) -> bytes:
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared_size = int(content_length)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid Content-Length")
        if declared_size > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="Uploaded file too large")

    data = await request.body()
    byte_size = len(data)
    if byte_size == 0:
        raise HTTPException(status_code=400, detail="Empty upload body")
    if byte_size > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Uploaded file too large")
    if expected_size and byte_size != expected_size:
        raise HTTPException(
            status_code=400,
            detail=f"Uploaded byte size mismatch (expected {expected_size}, got {byte_size})",
        )
    return data


def _resolve_media_file(storage_key: str | None) -> Path | None:
    if storage_key:
        candidate = Path(storage_key).expanduser()
        if candidate.exists():
            return candidate

        basename = candidate.name
        if basename:
            direct_fallback = DEV_SAMPLE_MEDIA_DIR / basename
            if direct_fallback.exists():
                return direct_fallback

            match = re.match(r"^import_[0-9a-f]+_(.+)$", basename)
            if match:
                original_name = match.group(1)
                derived_fallback = DEV_SAMPLE_MEDIA_DIR / original_name
                if derived_fallback.exists():
                    return derived_fallback

    return None


def _create_upload_session(
    *,
    payload: DmPresignRequest,
    request: Request,
    current_user: User,
    db: Session,
    scope: Literal["dm", "post", "profile"],
):
    _validate_declared_upload(payload)
    scope_path = "posts" if scope == "post" else scope
    row = db.execute(
        text(
            """
            INSERT INTO public.upload_sessions
              (user_id, provider, status, expires_at, meta)
            VALUES
              (:user_id, 'local-direct', 'issued', now() + interval '30 minutes', CAST(:meta_json AS jsonb))
            RETURNING public_id::text AS public_id, expires_at
            """
        ),
        {
            "user_id": current_user.id,
            "meta_json": json.dumps(
                {
                    "filename": _safe_filename(payload.filename),
                    "mime_type": payload.mime_type,
                    "byte_size": payload.byte_size,
                    "kind": payload.kind,
                    "scope": scope,
                }
            ),
        },
    ).mappings().one()
    db.commit()

    upload_url = str(request.base_url).rstrip("/") + f"/api/v1/uploads/{scope_path}/{row['public_id']}"
    return {
        "uploadId": row["public_id"],
        "uploadUrl": upload_url,
        "method": "PUT",
        "expiresAt": row["expires_at"].isoformat(),
        "maxBytes": MAX_UPLOAD_BYTES,
    }


def _upload_file_common(
    *,
    upload_id: str,
    request: Request,
    current_user: User,
    db: Session,
    expected_scope: Literal["dm", "post", "profile"],
):
    if expected_scope == "dm":
        allowed_kinds = {"image", "video", "document"}
    elif expected_scope == "profile":
        allowed_kinds = {"image"}
    else:
        allowed_kinds = {"image", "video"}
    session_row = db.execute(
        text(
            """
            SELECT id, user_id, status, expires_at, meta
            FROM public.upload_sessions
            WHERE public_id = CAST(:upload_id AS uuid)
            """
        ),
        {"upload_id": upload_id},
    ).mappings().first()

    if not session_row:
        raise HTTPException(status_code=404, detail="Upload session not found")
    if int(session_row["user_id"]) != current_user.id:
        raise HTTPException(status_code=403, detail="Upload session does not belong to current user")
    if session_row["status"] not in ("issued", "created"):
        raise HTTPException(status_code=400, detail="Upload session is not active")
    if session_row["expires_at"] and session_row["expires_at"] <= db.execute(text("SELECT now()")).scalar_one():
        raise HTTPException(status_code=400, detail="Upload session expired")

    meta = dict(session_row["meta"] or {})
    scope = str(meta.get("scope") or "dm")
    if scope != expected_scope:
        raise HTTPException(status_code=400, detail=f"Upload session is not for {expected_scope} uploads")
    expected_size = int(meta.get("byte_size") or 0)
    mime_type = str(meta.get("mime_type") or request.headers.get("content-type") or "application/octet-stream")
    filename = _safe_filename(str(meta.get("filename") or f"{upload_id}.bin"))
    kind = str(meta.get("kind") or "document")
    if kind not in allowed_kinds:
        raise HTTPException(status_code=400, detail="Invalid upload kind")
    if mime_type.strip().lower() not in _allowed_mime_types(kind):
        raise HTTPException(status_code=400, detail="File type is not supported")

    return session_row, expected_size, mime_type, filename, kind


@router.post("/dm/presign")
def create_dm_upload_session(
    payload: DmPresignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _create_upload_session(
        payload=payload,
        request=request,
        current_user=current_user,
        db=db,
        scope="dm",
    )


@router.post("/posts/presign")
def create_post_upload_session(
    payload: DmPresignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.kind not in ("image", "video"):
        raise HTTPException(status_code=400, detail="Post uploads must be image or video")
    return _create_upload_session(
        payload=payload,
        request=request,
        current_user=current_user,
        db=db,
        scope="post",
    )


@router.post("/profile/presign")
def create_profile_upload_session(
    payload: DmPresignRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.kind != "image":
        raise HTTPException(status_code=400, detail="Profile uploads must be image files")
    return _create_upload_session(
        payload=payload,
        request=request,
        current_user=current_user,
        db=db,
        scope="profile",
    )


@router.put("/dm/{upload_id}")
async def upload_dm_file(
    upload_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_row, expected_size, mime_type, filename, kind = _upload_file_common(
        upload_id=upload_id,
        request=request,
        current_user=current_user,
        db=db,
        expected_scope="dm",
    )

    data = await _read_validated_body(request, expected_size)
    byte_size = len(data)

    upload_dir = Path(settings.LOCAL_UPLOAD_DIR).expanduser().resolve() / str(current_user.id)
    os.makedirs(upload_dir, exist_ok=True)
    storage_path = upload_dir / f"{upload_id}_{filename}"
    storage_path.write_bytes(data)

    media_row = db.execute(
        text(
            """
            INSERT INTO public.media_assets
              (owner_user_id, kind, provider, status, storage_key, mime_type, byte_size, meta)
            VALUES
              (:owner_user_id, :kind, 'local', 'ready', :storage_key, :mime_type, :byte_size, '{}'::jsonb)
            RETURNING id, public_id::text AS public_id
            """
        ),
        {
            "owner_user_id": current_user.id,
            "kind": kind,
            "storage_key": str(storage_path),
            "mime_type": mime_type,
            "byte_size": byte_size,
        },
    ).mappings().one()

    public_url = str(request.base_url).rstrip("/") + f"/api/v1/uploads/media/{media_row['public_id']}"
    db.execute(
        text(
            """
            UPDATE public.media_assets
            SET public_url = :public_url
            WHERE id = :media_asset_id
            """
        ),
        {"public_url": public_url, "media_asset_id": int(media_row["id"])},
    )

    db.execute(
        text(
            """
            UPDATE public.upload_sessions
            SET status = 'completed',
                meta = meta || CAST(:meta_json AS jsonb),
                updated_at = now()
            WHERE id = :session_id
            """
        ),
        {
            "session_id": int(session_row["id"]),
            "meta_json": json.dumps(
                {
                    "media_asset_id": int(media_row["id"]),
                    "public_url": public_url,
                }
            ),
        },
    )
    db.commit()

    return {
        "ok": True,
        "mediaAssetId": int(media_row["id"]),
        "publicUrl": public_url,
        "kind": kind,
        "byteSize": byte_size,
    }


@router.put("/posts/{upload_id}")
async def upload_post_file(
    upload_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_row, expected_size, mime_type, filename, kind = _upload_file_common(
        upload_id=upload_id,
        request=request,
        current_user=current_user,
        db=db,
        expected_scope="post",
    )

    data = await _read_validated_body(request, expected_size)
    byte_size = len(data)

    upload_dir = Path(settings.LOCAL_UPLOAD_DIR).expanduser().resolve() / str(current_user.id)
    os.makedirs(upload_dir, exist_ok=True)
    storage_path = upload_dir / f"{upload_id}_{filename}"
    storage_path.write_bytes(data)

    media_row = db.execute(
        text(
            """
            INSERT INTO public.media_assets
              (owner_user_id, kind, provider, status, storage_key, mime_type, byte_size, meta)
            VALUES
              (:owner_user_id, :kind, 'local', 'ready', :storage_key, :mime_type, :byte_size, '{}'::jsonb)
            RETURNING id, public_id::text AS public_id
            """
        ),
        {
            "owner_user_id": current_user.id,
            "kind": kind,
            "storage_key": str(storage_path),
            "mime_type": mime_type,
            "byte_size": byte_size,
        },
    ).mappings().one()

    public_url = str(request.base_url).rstrip("/") + f"/api/v1/uploads/media/{media_row['public_id']}"
    db.execute(
        text(
            """
            UPDATE public.media_assets
            SET public_url = :public_url
            WHERE id = :media_asset_id
            """
        ),
        {"public_url": public_url, "media_asset_id": int(media_row["id"])},
    )

    db.execute(
        text(
            """
            UPDATE public.upload_sessions
            SET status = 'completed',
                meta = meta || CAST(:meta_json AS jsonb),
                updated_at = now()
            WHERE id = :session_id
            """
        ),
        {
            "session_id": int(session_row["id"]),
            "meta_json": json.dumps(
                {
                    "media_asset_id": int(media_row["id"]),
                    "public_url": public_url,
                }
            ),
        },
    )
    db.commit()

    return {
        "ok": True,
        "mediaAssetId": int(media_row["id"]),
        "publicUrl": public_url,
        "kind": kind,
        "byteSize": byte_size,
    }


@router.put("/profile/{upload_id}")
async def upload_profile_file(
    upload_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    session_row, expected_size, mime_type, filename, kind = _upload_file_common(
        upload_id=upload_id,
        request=request,
        current_user=current_user,
        db=db,
        expected_scope="profile",
    )

    data = await _read_validated_body(request, expected_size)
    byte_size = len(data)

    upload_dir = Path(settings.LOCAL_UPLOAD_DIR).expanduser().resolve() / str(current_user.id)
    os.makedirs(upload_dir, exist_ok=True)
    storage_path = upload_dir / f"{upload_id}_{filename}"
    storage_path.write_bytes(data)

    media_row = db.execute(
        text(
            """
            INSERT INTO public.media_assets
              (owner_user_id, kind, provider, status, storage_key, mime_type, byte_size, meta)
            VALUES
              (:owner_user_id, :kind, 'local', 'ready', :storage_key, :mime_type, :byte_size, CAST(:meta_json AS jsonb))
            RETURNING id, public_id::text AS public_id
            """
        ),
        {
            "owner_user_id": current_user.id,
            "kind": kind,
            "storage_key": str(storage_path),
            "mime_type": mime_type,
            "byte_size": byte_size,
            "meta_json": json.dumps({"scope": "profile"}),
        },
    ).mappings().one()

    public_url = str(request.base_url).rstrip("/") + f"/api/v1/uploads/media/{media_row['public_id']}"
    db.execute(
        text(
            """
            UPDATE public.media_assets
            SET public_url = :public_url
            WHERE id = :media_asset_id
            """
        ),
        {"public_url": public_url, "media_asset_id": int(media_row["id"])},
    )

    db.execute(
        text(
            """
            UPDATE public.upload_sessions
            SET status = 'completed',
                meta = meta || CAST(:meta_json AS jsonb),
                updated_at = now()
            WHERE id = :session_id
            """
        ),
        {
            "session_id": int(session_row["id"]),
            "meta_json": json.dumps(
                {
                    "media_asset_id": int(media_row["id"]),
                    "public_url": public_url,
                }
            ),
        },
    )
    db.commit()

    return {
        "ok": True,
        "mediaAssetId": int(media_row["id"]),
        "publicUrl": public_url,
        "kind": kind,
        "byteSize": byte_size,
    }


@router.get("/media/{media_public_id}")
def serve_uploaded_media(
    media_public_id: str,
    db: Session = Depends(get_db),
):
    try:
        parsed_media_public_id = str(uuid.UUID(media_public_id))
    except ValueError:
        raise HTTPException(status_code=404, detail="Media not found")

    row = db.execute(
        text(
            """
            SELECT id, storage_key, mime_type
            FROM public.media_assets
            WHERE public_id = CAST(:media_public_id AS uuid)
              AND status = 'ready'
            """
        ),
        {"media_public_id": parsed_media_public_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Media not found")

    resolved_path = _resolve_media_file(row["storage_key"])
    if not resolved_path:
        raise HTTPException(status_code=404, detail="Media file missing")

    if row["storage_key"] != str(resolved_path):
        db.execute(
            text(
                """
                UPDATE public.media_assets
                SET storage_key = :storage_key,
                    updated_at = now()
                WHERE id = :media_asset_id
                """
            ),
            {
                "storage_key": str(resolved_path),
                "media_asset_id": int(row["id"]),
            },
        )
        db.commit()

    return FileResponse(str(resolved_path), media_type=row["mime_type"] or "application/octet-stream")
