from __future__ import annotations

from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.shortlists import (
    AddShortlistItemRequest,
    CreateShortlistRequest,
    UpdateShortlistItemNoteRequest,
)

router = APIRouter(prefix="/api/v1/shortlists", tags=["shortlists"])


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


def _ensure_coach(db: Session, user_id: int) -> None:
    if not _user_has_role(db, user_id, "coach"):
        raise HTTPException(status_code=403, detail="Only coaches can manage shortlists")


def _ensure_athlete_user(db: Session, user_id: int) -> None:
    if not _user_has_role(db, user_id, "athlete"):
        raise HTTPException(status_code=400, detail="Target user is not an athlete")


@router.get("")
def list_shortlists(
    include_items: bool = Query(default=True),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    list_rows = db.execute(
        text(
            """
            SELECT id, name, created_at, NULL::timestamptz AS updated_at
            FROM public.shortlist_lists
            WHERE coach_user_id = :coach_user_id
            ORDER BY created_at DESC, id DESC
            """
        ),
        {"coach_user_id": current_user.id},
    ).mappings().all()

    list_ids = [int(r["id"]) for r in list_rows]
    items_by_list: dict[int, list[dict]] = {lid: [] for lid in list_ids}

    if include_items and list_ids:
        item_rows = db.execute(
            text(
                """
                SELECT
                  si.list_id,
                  si.athlete_user_id,
                  si.note,
                  si.created_at,
                  ap.first_name,
                  ap.last_name,
                  ap.grad_year,
                  ap.sport,
                  ap.state
                FROM public.shortlist_items si
                LEFT JOIN public.athlete_profiles ap ON ap.user_id = si.athlete_user_id
                WHERE si.list_id = ANY(:list_ids)
                ORDER BY si.created_at DESC
                """
            ),
            {"list_ids": list_ids},
        ).mappings().all()
        for row in item_rows:
            lid = int(row["list_id"])
            items_by_list[lid].append(
                {
                    "athleteUserId": int(row["athlete_user_id"]),
                    "name": (
                        " ".join([p for p in [row["first_name"], row["last_name"]] if p]).strip()
                        or f"Athlete {row['athlete_user_id']}"
                    ),
                    "meta": " • ".join(
                        [
                            part
                            for part in [
                                (f"Class of {row['grad_year']}" if row["grad_year"] else None),
                                (str(row["sport"]).capitalize() if row["sport"] else None),
                                (row["state"] if row["state"] else None),
                            ]
                            if part
                        ]
                    ),
                    "note": row["note"],
                    "createdAt": row["created_at"].isoformat(),
                }
            )

    return {
        "items": [
            {
                "id": int(r["id"]),
                "name": r["name"],
                "createdAt": r["created_at"].isoformat(),
                "updatedAt": r["updated_at"].isoformat() if r["updated_at"] else None,
                "items": items_by_list.get(int(r["id"]), []),
            }
            for r in list_rows
        ]
    }


@router.get("/saved-posts")
def list_saved_posts(
    request: Request,
    limit: int = Query(default=40, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    rows = db.execute(
        text(
            """
            WITH latest_media AS (
              SELECT DISTINCT ON (m.post_id)
                m.post_id,
                m.kind,
                COALESCE(
                  m.public_url,
                  '/api/v1/uploads/media/' || m.public_id::text
                ) AS media_url
              FROM public.media_assets m
              WHERE m.status = 'ready'
                AND m.kind IN ('image', 'video')
              ORDER BY
                m.post_id,
                (CASE WHEN m.kind = 'video' THEN 0 ELSE 1 END),
                m.created_at DESC
            ),
            tag_agg AS (
              SELECT
                pt.post_id,
                array_agg('#' || t.slug ORDER BY t.slug) AS tags
              FROM public.post_tags pt
              JOIN public.tags t ON t.id = pt.tag_id
              GROUP BY pt.post_id
            )
            SELECT
              ps.post_id,
              ps.created_at AS saved_at,
              p.author_user_id,
              p.caption,
              p.created_at AS post_created_at,
              ap.first_name,
              ap.last_name,
              ap.grad_year,
              ap.sport,
              ap.state,
              lm.kind AS media_kind,
              lm.media_url,
              COALESCE(tag_agg.tags, ARRAY[]::text[]) AS tags
            FROM public.post_saves ps
            JOIN public.posts p ON p.id = ps.post_id
            JOIN latest_media lm ON lm.post_id = p.id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = p.author_user_id
            LEFT JOIN tag_agg ON tag_agg.post_id = p.id
            WHERE ps.user_id = :coach_user_id
            ORDER BY ps.created_at DESC, p.created_at DESC, p.id DESC
            LIMIT :limit
            """
        ),
        {"coach_user_id": current_user.id, "limit": limit},
    ).mappings().all()

    return {
        "items": [
            {
                "postId": int(row["post_id"]),
                "athleteUserId": int(row["author_user_id"]),
                "athleteName": (
                    " ".join([p for p in [row["first_name"], row["last_name"]] if p]).strip()
                    or f"Athlete {row['author_user_id']}"
                ),
                "athleteMeta": " • ".join(
                    [
                        part
                        for part in [
                            (f"Class of {row['grad_year']}" if row["grad_year"] else None),
                            (str(row["sport"]).capitalize() if row["sport"] else None),
                            (row["state"] if row["state"] else None),
                        ]
                        if part
                    ]
                ),
                "caption": row["caption"] or "",
                "createdAt": row["post_created_at"].isoformat(),
                "savedAt": row["saved_at"].isoformat(),
                "tags": list(row["tags"] or []),
                "media": {
                    "kind": row["media_kind"],
                    "src": _normalize_media_url(row["media_url"], request),
                }
                if row["media_kind"] and row["media_url"]
                else None,
            }
            for row in rows
        ]
    }


@router.post("")
def create_shortlist(
    payload: CreateShortlistRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    row = db.execute(
        text(
            """
            INSERT INTO public.shortlist_lists (coach_user_id, name)
            VALUES (:coach_user_id, :name)
            RETURNING id, name, created_at, NULL::timestamptz AS updated_at
            """
        ),
        {"coach_user_id": current_user.id, "name": payload.name.strip()},
    ).mappings().one()
    db.commit()
    return {
        "id": int(row["id"]),
        "name": row["name"],
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat() if row["updated_at"] else None,
    }


@router.post("/{list_id}/items")
def add_shortlist_item(
    list_id: int,
    payload: AddShortlistItemRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)
    _ensure_athlete_user(db, payload.athlete_user_id)

    owns_list = db.execute(
        text(
            """
            SELECT 1
            FROM public.shortlist_lists
            WHERE id = :list_id
              AND coach_user_id = :coach_user_id
            """
        ),
        {"list_id": list_id, "coach_user_id": current_user.id},
    ).first()
    if not owns_list:
        raise HTTPException(status_code=404, detail="Shortlist not found")

    row = db.execute(
        text(
            """
            INSERT INTO public.shortlist_items (list_id, athlete_user_id, note)
            VALUES (:list_id, :athlete_user_id, :note)
            ON CONFLICT (list_id, athlete_user_id)
            DO UPDATE SET note = COALESCE(EXCLUDED.note, public.shortlist_items.note)
            RETURNING list_id, athlete_user_id, note, created_at
            """
        ),
        {
            "list_id": list_id,
            "athlete_user_id": payload.athlete_user_id,
            "note": payload.note.strip() if payload.note else None,
        },
    ).mappings().one()
    db.commit()
    return {
        "ok": True,
        "listId": int(row["list_id"]),
        "athleteUserId": int(row["athlete_user_id"]),
        "note": row["note"],
        "createdAt": row["created_at"].isoformat(),
    }


@router.patch("/{list_id}/items/{athlete_user_id}")
def update_shortlist_item_note(
    list_id: int,
    athlete_user_id: int,
    payload: UpdateShortlistItemNoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    row = db.execute(
        text(
            """
            UPDATE public.shortlist_items si
            SET note = :note
            FROM public.shortlist_lists sl
            WHERE si.list_id = :list_id
              AND si.athlete_user_id = :athlete_user_id
              AND sl.id = si.list_id
              AND sl.coach_user_id = :coach_user_id
            RETURNING si.list_id, si.athlete_user_id, si.note
            """
        ),
        {
            "list_id": list_id,
            "athlete_user_id": athlete_user_id,
            "note": payload.note.strip() if payload.note else None,
            "coach_user_id": current_user.id,
        },
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Shortlist item not found")
    db.commit()
    return {
        "ok": True,
        "listId": int(row["list_id"]),
        "athleteUserId": int(row["athlete_user_id"]),
        "note": row["note"],
    }


@router.delete("/{list_id}/items/{athlete_user_id}")
def remove_shortlist_item(
    list_id: int,
    athlete_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    row = db.execute(
        text(
            """
            DELETE FROM public.shortlist_items si
            USING public.shortlist_lists sl
            WHERE si.list_id = :list_id
              AND si.athlete_user_id = :athlete_user_id
              AND sl.id = si.list_id
              AND sl.coach_user_id = :coach_user_id
            RETURNING si.list_id
            """
        ),
        {
            "list_id": list_id,
            "athlete_user_id": athlete_user_id,
            "coach_user_id": current_user.id,
        },
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Shortlist item not found")
    db.commit()
    return {"ok": True}
