from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.dm import CreateDmMediaAssetRequest, CreateThreadRequest, SendMessageRequest
from app.services.realtime import publish_user_event

router = APIRouter(prefix="/api/v1/dm", tags=["dm"])


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


def _ensure_verified_coach(db: Session, user_id: int) -> None:
    is_coach = _user_has_role(db, user_id, "coach")
    if not is_coach:
        raise HTTPException(status_code=403, detail="Only coaches can initiate coach outreach")

    is_verified = bool(
        db.execute(
            text(
                """
                SELECT COALESCE(cp.is_verified_coach, false)
                FROM public.coach_profiles cp
                WHERE cp.user_id = :user_id
                """
            ),
            {"user_id": user_id},
        ).scalar()
    )
    if not is_verified:
        raise HTTPException(status_code=403, detail="Only verified coaches can DM athletes")


def _insert_message_notification(
    db: Session,
    *,
    recipient_user_id: int,
    sender_user_id: int,
    thread_public_id: str,
    message_id: int,
    body_preview: str,
) -> None:
    db.execute(
        text(
            """
            INSERT INTO public.notifications (user_id, notif_type, title, body, data)
            VALUES (
              :user_id,
              'dm_message',
              'New message',
              :body,
              CAST(:data_json AS jsonb)
            )
            """
        ),
        {
            "user_id": recipient_user_id,
            "body": f"New message from user {sender_user_id}: {body_preview}",
            "data_json": json.dumps(
                {
                    "threadId": thread_public_id,
                    "messageId": message_id,
                    "senderUserId": sender_user_id,
                }
            ),
        },
    )


def _normalize_asset_ids(asset_ids: list[int]) -> list[int]:
    seen: set[int] = set()
    out: list[int] = []
    for aid in asset_ids:
        if aid <= 0:
            continue
        if aid in seen:
            continue
        seen.add(aid)
        out.append(aid)
    return out[:5]


def _validate_attachable_assets(db: Session, owner_user_id: int, asset_ids: list[int]) -> list[int]:
    normalized = _normalize_asset_ids(asset_ids)
    if not normalized:
        return []
    rows = db.execute(
        text(
            """
            SELECT id
            FROM public.media_assets
            WHERE id = ANY(:asset_ids)
              AND owner_user_id = :owner_user_id
              AND status = 'ready'
              AND kind IN ('image', 'video', 'document')
            """
        ),
        {"asset_ids": normalized, "owner_user_id": owner_user_id},
    ).all()
    found = {int(r[0]) for r in rows}
    missing = [aid for aid in normalized if aid not in found]
    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid attachment media_asset_ids for current user: {missing}",
        )
    return normalized


def _attach_media_to_message(db: Session, message_id: int, asset_ids: list[int]) -> None:
    if not asset_ids:
        return
    db.execute(
        text(
            """
            INSERT INTO public.dm_message_attachments (message_id, media_asset_id)
            VALUES (:message_id, :media_asset_id)
            ON CONFLICT DO NOTHING
            """
        ),
        [{"message_id": message_id, "media_asset_id": aid} for aid in asset_ids],
    )


@router.post("/media-assets")
def create_dm_media_asset(
    payload: CreateDmMediaAssetRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            INSERT INTO public.media_assets
              (owner_user_id, kind, provider, status, public_url, thumb_public_url, mime_type, byte_size, meta)
            VALUES
              (:owner_user_id, :kind, 'external', 'ready', :public_url, :thumb_public_url, :mime_type, :byte_size, '{}'::jsonb)
            RETURNING id, public_id::text AS public_id, kind, public_url, thumb_public_url
            """
        ),
        {
            "owner_user_id": current_user.id,
            "kind": payload.kind,
            "public_url": payload.public_url.strip(),
            "thumb_public_url": payload.thumb_public_url.strip() if payload.thumb_public_url else None,
            "mime_type": payload.mime_type,
            "byte_size": payload.byte_size,
        },
    ).mappings().one()
    db.commit()
    return {
        "mediaAssetId": int(row["id"]),
        "publicId": row["public_id"],
        "kind": row["kind"],
        "publicUrl": row["public_url"],
        "thumbPublicUrl": row["thumb_public_url"],
    }


@router.get("/threads")
def list_threads(
    limit: int = Query(30, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
              t.public_id::text AS thread_id,
              t.coach_user_id,
              t.athlete_user_id,
              CONCAT_WS(' ', cp.first_name, cp.last_name) AS coach_name,
              CONCAT_WS(' ', ap.first_name, ap.last_name) AS athlete_name,
              t.created_at,
              t.last_message_at,
              lm.body AS last_message_body,
              lm.sender_user_id AS last_message_sender_user_id,
              COALESCE(uc.unread_count, 0) AS unread_count
            FROM public.dm_threads t
            LEFT JOIN LATERAL (
              SELECT m.body, m.sender_user_id, m.created_at
              FROM public.dm_messages m
              WHERE m.thread_id = t.id
              ORDER BY m.created_at DESC, m.id DESC
              LIMIT 1
            ) lm ON true
            LEFT JOIN LATERAL (
              SELECT COUNT(*)::int AS unread_count
              FROM public.dm_messages m2
              LEFT JOIN public.dm_message_reads mr
                ON mr.message_id = m2.id
               AND mr.user_id = :uid
              WHERE m2.thread_id = t.id
                AND m2.sender_user_id <> :uid
                AND mr.message_id IS NULL
            ) uc ON true
            LEFT JOIN public.coach_profiles cp ON cp.user_id = t.coach_user_id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = t.athlete_user_id
            WHERE t.coach_user_id = :uid OR t.athlete_user_id = :uid
            ORDER BY COALESCE(t.last_message_at, t.created_at) DESC
            LIMIT :limit
            """
        ),
        {"uid": current_user.id, "limit": limit},
    ).mappings().all()

    return {
        "items": [
            {
                "threadId": r["thread_id"],
                "coachUserId": int(r["coach_user_id"]),
                "athleteUserId": int(r["athlete_user_id"]),
                "coachName": r["coach_name"],
                "athleteName": r["athlete_name"],
                "createdAt": r["created_at"].isoformat(),
                "lastMessageAt": r["last_message_at"].isoformat() if r["last_message_at"] else None,
                "lastMessageBody": r["last_message_body"],
                "lastMessageSenderUserId": (
                    int(r["last_message_sender_user_id"]) if r["last_message_sender_user_id"] else None
                ),
                "unreadCount": int(r["unread_count"] or 0),
            }
            for r in rows
        ]
    }


@router.get("/search-athletes")
def search_athletes(
    q: str = Query(..., min_length=2, max_length=80),
    limit: int = Query(12, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_verified_coach(db, current_user.id)

    pattern = f"%{q.strip()}%"
    rows = db.execute(
        text(
            """
            SELECT
              u.id AS user_id,
              u.email,
              ap.first_name,
              ap.last_name,
              ap.grad_year,
              ap.sport,
              ap.state,
              dt.public_id::text AS existing_thread_id
            FROM public.users u
            JOIN public.user_roles ur ON ur.user_id = u.id
            JOIN public.roles r ON r.id = ur.role_id AND r.key = 'athlete'
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
            LEFT JOIN public.dm_threads dt
              ON dt.coach_user_id = :coach_user_id
             AND dt.athlete_user_id = u.id
            WHERE
              (
                u.email ILIKE :pattern
                OR CONCAT_WS(' ', ap.first_name, ap.last_name) ILIKE :pattern
              )
            ORDER BY
              (dt.id IS NOT NULL) DESC,
              ap.last_name NULLS LAST,
              ap.first_name NULLS LAST,
              u.id DESC
            LIMIT :limit
            """
        ),
        {"coach_user_id": current_user.id, "pattern": pattern, "limit": limit},
    ).mappings().all()

    return {
        "items": [
            {
                "userId": int(r["user_id"]),
                "name": " ".join([p for p in [r["first_name"], r["last_name"]] if p]).strip() or r["email"],
                "email": r["email"],
                "meta": " • ".join(
                    [
                        part
                        for part in [
                            (f"Class of {r['grad_year']}" if r["grad_year"] else None),
                            (str(r["sport"]).capitalize() if r["sport"] else None),
                            (r["state"] if r["state"] else None),
                        ]
                        if part
                    ]
                ),
                "existingThreadId": r["existing_thread_id"],
            }
            for r in rows
        ]
    }


@router.post("/threads")
def create_thread(
    payload: CreateThreadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_verified_coach(db, current_user.id)

    if not _user_has_role(db, payload.athlete_user_id, "athlete"):
        raise HTTPException(status_code=400, detail="Target user is not an athlete")
    media_asset_ids = _validate_attachable_assets(db, current_user.id, payload.media_asset_ids)

    thread = db.execute(
        text(
            """
            INSERT INTO public.dm_threads (coach_user_id, athlete_user_id, last_message_at)
            VALUES (:coach_user_id, :athlete_user_id, now())
            ON CONFLICT (coach_user_id, athlete_user_id)
            DO UPDATE SET last_message_at = now()
            RETURNING id, public_id::text AS public_id
            """
        ),
        {"coach_user_id": current_user.id, "athlete_user_id": payload.athlete_user_id},
    ).mappings().one()

    message = db.execute(
        text(
            """
            INSERT INTO public.dm_messages (thread_id, sender_user_id, body)
            VALUES (:thread_id, :sender_user_id, :body)
            RETURNING id, created_at
            """
        ),
        {"thread_id": thread["id"], "sender_user_id": current_user.id, "body": payload.initial_message.strip()},
    ).mappings().one()
    _attach_media_to_message(db, int(message["id"]), media_asset_ids)

    _insert_message_notification(
        db,
        recipient_user_id=payload.athlete_user_id,
        sender_user_id=current_user.id,
        thread_public_id=thread["public_id"],
        message_id=int(message["id"]),
        body_preview=payload.initial_message.strip()[:140],
    )

    db.commit()
    try:
        publish_user_event(
            payload.athlete_user_id,
            "dm_message",
            {
                "threadId": thread["public_id"],
                "messageId": int(message["id"]),
                "senderUserId": current_user.id,
            },
        )
    except Exception:
        # Realtime delivery should not break core message persistence.
        pass

    return {
        "threadId": thread["public_id"],
        "message": {
            "id": int(message["id"]),
            "createdAt": message["created_at"].isoformat(),
        },
    }


@router.post("/threads/{thread_id}/messages")
def send_message(
    thread_id: str,
    payload: SendMessageRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = db.execute(
        text(
            """
            SELECT id, coach_user_id, athlete_user_id
            FROM public.dm_threads
            WHERE public_id = CAST(:thread_id AS uuid)
            """
        ),
        {"thread_id": thread_id},
    ).mappings().first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user.id not in (int(thread["coach_user_id"]), int(thread["athlete_user_id"])):
        raise HTTPException(status_code=403, detail="You are not a participant in this thread")

    if current_user.id == int(thread["coach_user_id"]):
        _ensure_verified_coach(db, current_user.id)
    media_asset_ids = _validate_attachable_assets(db, current_user.id, payload.media_asset_ids)

    message = db.execute(
        text(
            """
            INSERT INTO public.dm_messages (thread_id, sender_user_id, body)
            VALUES (:thread_id, :sender_user_id, :body)
            RETURNING id, created_at
            """
        ),
        {
            "thread_id": int(thread["id"]),
            "sender_user_id": current_user.id,
            "body": payload.body.strip(),
        },
    ).mappings().one()
    _attach_media_to_message(db, int(message["id"]), media_asset_ids)

    recipient_user_id = (
        int(thread["athlete_user_id"])
        if current_user.id == int(thread["coach_user_id"])
        else int(thread["coach_user_id"])
    )

    _insert_message_notification(
        db,
        recipient_user_id=recipient_user_id,
        sender_user_id=current_user.id,
        thread_public_id=thread_id,
        message_id=int(message["id"]),
        body_preview=payload.body.strip()[:140],
    )

    db.commit()
    try:
        publish_user_event(
            recipient_user_id,
            "dm_message",
            {
                "threadId": thread_id,
                "messageId": int(message["id"]),
                "senderUserId": current_user.id,
            },
        )
    except Exception:
        # Realtime delivery should not break core message persistence.
        pass

    return {
        "ok": True,
        "message": {
            "id": int(message["id"]),
            "createdAt": message["created_at"].isoformat(),
        },
    }


@router.get("/threads/{thread_id}/messages")
def list_thread_messages(
    thread_id: str,
    limit: int = Query(50, ge=1, le=200),
    before_id: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    thread = db.execute(
        text(
            """
            SELECT id, coach_user_id, athlete_user_id
            FROM public.dm_threads
            WHERE public_id = CAST(:thread_id AS uuid)
            """
        ),
        {"thread_id": thread_id},
    ).mappings().first()

    if not thread:
        raise HTTPException(status_code=404, detail="Thread not found")

    if current_user.id not in (int(thread["coach_user_id"]), int(thread["athlete_user_id"])):
        raise HTTPException(status_code=403, detail="You are not a participant in this thread")

    # Mark unread messages from the other participant as read when opening the thread.
    db.execute(
        text(
            """
            INSERT INTO public.dm_message_reads (message_id, user_id, read_at)
            SELECT
              m.id,
              :uid,
              now()
            FROM public.dm_messages m
            LEFT JOIN public.dm_message_reads mr
              ON mr.message_id = m.id
             AND mr.user_id = :uid
            WHERE m.thread_id = :thread_id_int
              AND m.sender_user_id <> :uid
              AND mr.message_id IS NULL
            """
        ),
        {"uid": current_user.id, "thread_id_int": int(thread["id"])},
    )
    db.commit()

    rows = db.execute(
        text(
            """
            SELECT
              m.id,
              m.sender_user_id,
              m.body,
              m.created_at,
              COALESCE(att.items, '[]'::jsonb) AS attachments
            FROM public.dm_messages m
            LEFT JOIN LATERAL (
              SELECT jsonb_agg(
                jsonb_build_object(
                  'mediaAssetId', ma.id,
                  'kind', ma.kind,
                  'publicUrl', ma.public_url,
                  'thumbPublicUrl', ma.thumb_public_url,
                  'mimeType', ma.mime_type
                )
                ORDER BY ma.id
              ) AS items
              FROM public.dm_message_attachments dma
              JOIN public.media_assets ma ON ma.id = dma.media_asset_id
              WHERE dma.message_id = m.id
            ) att ON true
            WHERE m.thread_id = :thread_id_int
              AND (
                CAST(:before_id AS bigint) IS NULL
                OR m.id < CAST(:before_id AS bigint)
              )
            ORDER BY m.id DESC
            LIMIT :limit
            """
        ),
        {"thread_id_int": int(thread["id"]), "before_id": before_id, "limit": limit},
    ).mappings().all()

    ordered = list(reversed(rows))
    has_more = len(rows) >= limit
    next_before_id = int(rows[-1]["id"]) if has_more and rows else None

    return {
        "threadId": thread_id,
        "items": [
            {
                "id": int(r["id"]),
                "senderUserId": int(r["sender_user_id"]),
                "body": r["body"],
                "createdAt": r["created_at"].isoformat(),
                "attachments": list(r["attachments"] or []),
            }
            for r in ordered
        ],
        "hasMore": has_more,
        "nextBeforeId": next_before_id,
    }
