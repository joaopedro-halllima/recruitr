from __future__ import annotations

import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.posts import CreatePostRequest

router = APIRouter(prefix="/api/v1/posts", tags=["posts"])


def _normalize_media_url(url: str | None, request: Request) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    if url.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + url

    if parsed.path.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + parsed.path

    return url


def _user_has_role(db: Session, user_id: int, role_key: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM public.user_roles ur
                  JOIN public.roles r ON r.id = ur.role_id
                  WHERE ur.user_id = :user_id
                    AND r.key = :role_key
                )
                """
            ),
            {"user_id": user_id, "role_key": role_key},
        ).scalar()
    )


def _normalize_tags(tags: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for raw in tags:
        cleaned = raw.strip().lower().lstrip("#")
        cleaned = re.sub(r"[^a-z0-9_]+", "-", cleaned).strip("-")
        if not cleaned or cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned[:50])
    return out[:12]


def _normalize_asset_ids(media_asset_ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for mid in media_asset_ids:
        if mid <= 0 or mid in seen:
            continue
        seen.add(mid)
        out.append(mid)
    return out[:4]


def _list_posts_for_user(
    request: Request,
    db: Session,
    *,
    user_id: int,
    limit: int,
) -> dict:
    rows = db.execute(
        text(
            """
            WITH media AS (
              SELECT DISTINCT ON (m.post_id)
                m.post_id,
                m.kind,
                COALESCE(
                  m.public_url,
                  '/api/v1/uploads/media/' || m.public_id::text
                ) AS public_url
              FROM public.media_assets m
              WHERE m.status = 'ready'
                AND m.kind IN ('image', 'video')
              ORDER BY m.post_id, (CASE WHEN m.kind = 'video' THEN 0 ELSE 1 END), m.created_at DESC
            ),
            tag_agg AS (
              SELECT pt.post_id, array_agg('#' || t.slug ORDER BY t.slug) AS tags
              FROM public.post_tags pt
              JOIN public.tags t ON t.id = pt.tag_id
              GROUP BY pt.post_id
            )
            SELECT
              p.id,
              p.public_id::text AS public_id,
              p.caption,
              p.sport,
              p.created_at,
              m.kind AS media_kind,
              m.public_url AS media_url,
              COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags
            FROM public.posts p
            JOIN media m ON m.post_id = p.id
            LEFT JOIN tag_agg ON tag_agg.post_id = p.id
            WHERE p.author_user_id = :uid
            ORDER BY p.created_at DESC
            LIMIT :limit
            """
        ),
        {"uid": user_id, "limit": limit},
    ).mappings().all()

    return {
        "items": [
            {
                "id": int(r["id"]),
                "publicId": r["public_id"],
                "caption": r["caption"] or "",
                "sport": r["sport"] or "",
                "createdAt": r["created_at"].isoformat(),
                "media": {
                    "kind": r["media_kind"],
                    "src": _normalize_media_url(r["media_url"], request),
                }
                if r["media_url"]
                else None,
                "tags": list(r["tags"] or []),
            }
            for r in rows
        ]
    }


@router.post("")
def create_post(
    payload: CreatePostRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_athlete = _user_has_role(db, current_user.id, "athlete")
    is_coach = _user_has_role(db, current_user.id, "coach")
    if not is_athlete and not is_coach:
        raise HTTPException(status_code=403, detail="Only athlete or coach users can create posts")

    media_ids = _normalize_asset_ids(payload.media_asset_ids)
    if not media_ids:
        raise HTTPException(status_code=400, detail="media_asset_ids must include at least one item")

    valid_rows = db.execute(
        text(
            """
            SELECT id
            FROM public.media_assets
            WHERE id = ANY(:media_ids)
              AND owner_user_id = :uid
              AND status = 'ready'
              AND kind IN ('image', 'video')
              AND post_id IS NULL
            """
        ),
        {"media_ids": media_ids, "uid": current_user.id},
    ).all()
    valid_ids = {int(r[0]) for r in valid_rows}
    missing = [mid for mid in media_ids if mid not in valid_ids]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid post media_asset_ids for current user: {missing}",
        )

    post_row = db.execute(
        text(
            """
            INSERT INTO public.posts (author_user_id, sport, caption, visibility)
            VALUES (:author_user_id, :sport, :caption, 'public')
            RETURNING id, public_id::text AS public_id, created_at
            """
        ),
        {
            "author_user_id": current_user.id,
            "sport": payload.sport.strip().lower(),
            "caption": payload.caption.strip(),
        },
    ).mappings().one()
    post_id = int(post_row["id"])

    db.execute(
        text(
            """
            UPDATE public.media_assets
            SET post_id = :post_id,
                updated_at = now()
            WHERE id = ANY(:media_ids)
            """
        ),
        {"post_id": post_id, "media_ids": media_ids},
    )

    tag_ids: list[int] = []
    for tag_slug in _normalize_tags(payload.tags):
        tag_row = db.execute(
            text(
                """
                INSERT INTO public.tags (slug, display_name)
                VALUES (:slug, :display_name)
                ON CONFLICT (slug) DO UPDATE
                SET display_name = EXCLUDED.display_name
                RETURNING id
                """
            ),
            {"slug": tag_slug, "display_name": tag_slug},
        ).first()
        if tag_row:
            tag_ids.append(int(tag_row[0]))

    if tag_ids:
        db.execute(
            text(
                """
                INSERT INTO public.post_tags (post_id, tag_id)
                VALUES (:post_id, :tag_id)
                ON CONFLICT DO NOTHING
                """
            ),
            [{"post_id": post_id, "tag_id": tid} for tid in tag_ids],
        )

    db.commit()

    return {
        "ok": True,
        "postId": post_id,
        "postPublicId": post_row["public_id"],
        "createdAt": post_row["created_at"].isoformat(),
        "postType": ("coach" if is_coach and not is_athlete else "athlete"),
    }


@router.get("/mine")
def list_my_posts(
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _list_posts_for_user(request, db, user_id=current_user.id, limit=limit)


@router.get("/user/{user_id}")
def list_posts_for_user(
    user_id: int,
    request: Request,
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user
    return _list_posts_for_user(request, db, user_id=user_id, limit=limit)
