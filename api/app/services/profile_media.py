from __future__ import annotations

from urllib.parse import urlparse

from fastapi import HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

_profile_media_schema_ready = False


def ensure_profile_media_schema(db: Session) -> None:
    global _profile_media_schema_ready
    if _profile_media_schema_ready:
        return

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.profile_media (
              user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
              avatar_media_asset_id BIGINT REFERENCES public.media_assets(id) ON DELETE SET NULL,
              banner_media_asset_id BIGINT REFERENCES public.media_assets(id) ON DELETE SET NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_profile_media_avatar_media_asset_id
            ON public.profile_media (avatar_media_asset_id)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_profile_media_banner_media_asset_id
            ON public.profile_media (banner_media_asset_id)
            """
        )
    )
    db.commit()
    _profile_media_schema_ready = True


def _normalize_media_url(
    url: str | None,
    public_id: str | None,
    request: Request | None,
) -> str | None:
    candidate = (url or "").strip()
    if not candidate and public_id:
        candidate = f"/api/v1/uploads/media/{public_id}"
    if not candidate:
        return None
    if request is None:
        return candidate

    parsed = urlparse(candidate)
    if candidate.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + candidate
    if parsed.path.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + parsed.path
    return candidate


def get_profile_media(
    db: Session,
    user_id: int,
    request: Request | None = None,
) -> dict[str, int | str | None]:
    ensure_profile_media_schema(db)

    row = db.execute(
        text(
            """
            SELECT
              pm.avatar_media_asset_id,
              pm.banner_media_asset_id,
              avatar.public_id::text AS avatar_public_id,
              avatar.public_url AS avatar_public_url,
              banner.public_id::text AS banner_public_id,
              banner.public_url AS banner_public_url
            FROM public.profile_media pm
            LEFT JOIN public.media_assets avatar
              ON avatar.id = pm.avatar_media_asset_id
            LEFT JOIN public.media_assets banner
              ON banner.id = pm.banner_media_asset_id
            WHERE pm.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    if not row:
        return {
            "avatar_media_asset_id": None,
            "banner_media_asset_id": None,
            "avatar_url": None,
            "banner_url": None,
        }

    return {
        "avatar_media_asset_id": (
            int(row["avatar_media_asset_id"]) if row["avatar_media_asset_id"] is not None else None
        ),
        "banner_media_asset_id": (
            int(row["banner_media_asset_id"]) if row["banner_media_asset_id"] is not None else None
        ),
        "avatar_url": _normalize_media_url(row["avatar_public_url"], row["avatar_public_id"], request),
        "banner_url": _normalize_media_url(row["banner_public_url"], row["banner_public_id"], request),
    }


def assert_profile_media_asset_ownership(
    db: Session,
    *,
    user_id: int,
    media_asset_id: int | None,
    field_name: str,
) -> None:
    ensure_profile_media_schema(db)

    if media_asset_id is None:
        return

    row = db.execute(
        text(
            """
            SELECT id
            FROM public.media_assets
            WHERE id = :media_asset_id
              AND owner_user_id = :user_id
              AND status = 'ready'
              AND kind = 'image'
            """
        ),
        {
            "media_asset_id": media_asset_id,
            "user_id": user_id,
        },
    ).first()

    if not row:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid {field_name}; image must belong to current user and be ready.",
        )


def upsert_profile_media(
    db: Session,
    *,
    user_id: int,
    avatar_media_asset_id: int | None,
    banner_media_asset_id: int | None,
) -> None:
    ensure_profile_media_schema(db)
    db.execute(
        text(
            """
            INSERT INTO public.profile_media
              (user_id, avatar_media_asset_id, banner_media_asset_id)
            VALUES
              (:user_id, :avatar_media_asset_id, :banner_media_asset_id)
            ON CONFLICT (user_id)
            DO UPDATE SET
              avatar_media_asset_id = COALESCE(EXCLUDED.avatar_media_asset_id, profile_media.avatar_media_asset_id),
              banner_media_asset_id = COALESCE(EXCLUDED.banner_media_asset_id, profile_media.banner_media_asset_id),
              updated_at = now()
            """
        ),
        {
            "user_id": user_id,
            "avatar_media_asset_id": avatar_media_asset_id,
            "banner_media_asset_id": banner_media_asset_id,
        },
    )
