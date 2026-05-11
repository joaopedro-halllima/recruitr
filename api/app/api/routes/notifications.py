from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/notifications", tags=["notifications"])


@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0, le=10000),
    unread_only: bool = Query(False),
    type: str | None = Query(None, description="Optional notification type filter"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
              n.id,
              n.notif_type,
              n.title,
              n.body,
              n.data,
              n.is_read,
              n.created_at
            FROM public.notifications n
            WHERE n.user_id = :uid
              AND (:unread_only = false OR n.is_read = false)
              AND (CAST(:notif_type AS text) IS NULL OR n.notif_type = CAST(:notif_type AS text))
            ORDER BY n.created_at DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "uid": current_user.id,
            "unread_only": unread_only,
            "notif_type": type,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()

    unread_count = db.execute(
        text(
            """
            SELECT COUNT(*)::int
            FROM public.notifications n
            WHERE n.user_id = :uid
              AND n.is_read = false
            """
        ),
        {"uid": current_user.id},
    ).scalar_one()

    total_count = db.execute(
        text(
            """
            SELECT COUNT(*)::int
            FROM public.notifications n
            WHERE n.user_id = :uid
              AND (:unread_only = false OR n.is_read = false)
              AND (CAST(:notif_type AS text) IS NULL OR n.notif_type = CAST(:notif_type AS text))
            """
        ),
        {
            "uid": current_user.id,
            "unread_only": unread_only,
            "notif_type": type,
        },
    ).scalar_one()

    return {
        "unreadCount": int(unread_count or 0),
        "total": int(total_count or 0),
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + len(rows)) < int(total_count or 0),
        "items": [
            {
                "id": int(r["id"]),
                "type": r["notif_type"],
                "title": r["title"],
                "body": r["body"],
                "data": r["data"] or {},
                "isRead": bool(r["is_read"]),
                "createdAt": r["created_at"].isoformat(),
            }
            for r in rows
        ],
    }


@router.post("/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = true
            WHERE id = :notification_id
              AND user_id = :uid
            RETURNING id
            """
        ),
        {"notification_id": notification_id, "uid": current_user.id},
    ).first()

    if not row:
        raise HTTPException(status_code=404, detail="Notification not found")

    db.commit()
    return {"ok": True}


@router.post("/read-all")
def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    updated = db.execute(
        text(
            """
            UPDATE public.notifications
            SET is_read = true
            WHERE user_id = :uid
              AND is_read = false
            """
        ),
        {"uid": current_user.id},
    )
    db.commit()
    return {"ok": True, "updated": int(updated.rowcount or 0)}
