from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.moderation import ReportCreateRequest

router = APIRouter(prefix="/api/v1/moderation", tags=["moderation"])


@router.get("/blocks")
def list_blocks(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
              ub.blocked_user_id AS user_id,
              u.email,
              ub.created_at,
              ap.first_name AS athlete_first_name,
              ap.last_name AS athlete_last_name,
              cp.first_name AS coach_first_name,
              cp.last_name AS coach_last_name
            FROM public.user_blocks ub
            JOIN public.users u ON u.id = ub.blocked_user_id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
            WHERE ub.blocker_user_id = :uid
            ORDER BY ub.created_at DESC
            """
        ),
        {"uid": current_user.id},
    ).mappings().all()
    return {
        "items": [
            {
                "userId": int(r["user_id"]),
                "email": r["email"],
                "name": (
                    " ".join(
                        [
                            p
                            for p in [
                                r["athlete_first_name"] or r["coach_first_name"],
                                r["athlete_last_name"] or r["coach_last_name"],
                            ]
                            if p
                        ]
                    ).strip()
                    or r["email"]
                ),
                "createdAt": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/hidden-users")
def list_hidden_users(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
              uh.hidden_user_id AS user_id,
              u.email,
              uh.created_at,
              ap.first_name AS athlete_first_name,
              ap.last_name AS athlete_last_name,
              cp.first_name AS coach_first_name,
              cp.last_name AS coach_last_name
            FROM public.user_hides uh
            JOIN public.users u ON u.id = uh.hidden_user_id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
            WHERE uh.hider_user_id = :uid
            ORDER BY uh.created_at DESC
            """
        ),
        {"uid": current_user.id},
    ).mappings().all()
    return {
        "items": [
            {
                "userId": int(r["user_id"]),
                "email": r["email"],
                "name": (
                    " ".join(
                        [
                            p
                            for p in [
                                r["athlete_first_name"] or r["coach_first_name"],
                                r["athlete_last_name"] or r["coach_last_name"],
                            ]
                            if p
                        ]
                    ).strip()
                    or r["email"]
                ),
                "createdAt": r["created_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.get("/hidden-posts")
def list_hidden_posts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (fe.post_id)
              fe.post_id,
              fe.created_at AS hidden_at,
              p.caption
            FROM public.feed_events fe
            JOIN public.posts p ON p.id = fe.post_id
            WHERE fe.viewer_user_id = :uid
              AND fe.event_type = 'hide'
            ORDER BY fe.post_id, fe.created_at DESC
            """
        ),
        {"uid": current_user.id},
    ).mappings().all()
    return {
        "items": [
            {
                "postId": int(r["post_id"]),
                "caption": r["caption"] or "",
                "hiddenAt": r["hidden_at"].isoformat(),
            }
            for r in rows
        ]
    }


@router.post("/report")
def create_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.target_user_id and payload.target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot report yourself")

    target_user_id = payload.target_user_id
    if payload.target_post_id:
        post_row = db.execute(
            text("SELECT id, author_user_id FROM public.posts WHERE id = :post_id"),
            {"post_id": payload.target_post_id},
        ).mappings().first()
        if not post_row:
            raise HTTPException(status_code=404, detail="Post not found")
        if target_user_id is None:
            target_user_id = int(post_row["author_user_id"])

    row = db.execute(
        text(
            """
            INSERT INTO public.reports
              (reporter_user_id, target_user_id, target_post_id, reason, details, status)
            VALUES
              (:reporter_user_id, :target_user_id, :target_post_id, :reason, :details, 'open')
            RETURNING id, created_at
            """
        ),
        {
            "reporter_user_id": current_user.id,
            "target_user_id": target_user_id,
            "target_post_id": payload.target_post_id,
            "reason": payload.reason.strip().lower(),
            "details": payload.details.strip() if payload.details else None,
        },
    ).mappings().one()

    if payload.target_post_id:
        db.execute(
            text(
                """
                INSERT INTO public.feed_events
                  (viewer_user_id, subject_user_id, post_id, event_type, algorithm_version, metadata)
                SELECT
                  :viewer_user_id,
                  p.author_user_id,
                  p.id,
                  'report',
                  'post_feed_v2',
                  CAST(:metadata_json AS jsonb)
                FROM public.posts p
                WHERE p.id = :post_id
                """
            ),
            {
                "viewer_user_id": current_user.id,
                "post_id": payload.target_post_id,
                "metadata_json": json.dumps({"source": "moderation", "reason": payload.reason}),
            },
        )

    db.commit()
    return {"ok": True, "reportId": int(row["id"]), "createdAt": row["created_at"].isoformat()}


@router.post("/block/{target_user_id}")
def block_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")
    exists = db.execute(
        text("SELECT 1 FROM public.users WHERE id = :target_user_id"),
        {"target_user_id": target_user_id},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="User not found")
    db.execute(
        text(
            """
            INSERT INTO public.user_blocks (blocker_user_id, blocked_user_id)
            VALUES (:blocker_user_id, :blocked_user_id)
            ON CONFLICT DO NOTHING
            """
        ),
        {"blocker_user_id": current_user.id, "blocked_user_id": target_user_id},
    )
    db.commit()
    return {"ok": True, "blockedUserId": target_user_id}


@router.delete("/block/{target_user_id}")
def unblock_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.user_blocks
            WHERE blocker_user_id = :blocker_user_id
              AND blocked_user_id = :blocked_user_id
            """
        ),
        {"blocker_user_id": current_user.id, "blocked_user_id": target_user_id},
    )
    db.commit()
    return {"ok": True, "blockedUserId": target_user_id}


@router.post("/hide-user/{target_user_id}")
def hide_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if target_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot hide yourself")
    exists = db.execute(
        text("SELECT 1 FROM public.users WHERE id = :target_user_id"),
        {"target_user_id": target_user_id},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="User not found")
    db.execute(
        text(
            """
            INSERT INTO public.user_hides (hider_user_id, hidden_user_id)
            VALUES (:hider_user_id, :hidden_user_id)
            ON CONFLICT DO NOTHING
            """
        ),
        {"hider_user_id": current_user.id, "hidden_user_id": target_user_id},
    )
    db.commit()
    return {"ok": True, "hiddenUserId": target_user_id}


@router.delete("/hide-user/{target_user_id}")
def unhide_user(
    target_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.user_hides
            WHERE hider_user_id = :hider_user_id
              AND hidden_user_id = :hidden_user_id
            """
        ),
        {"hider_user_id": current_user.id, "hidden_user_id": target_user_id},
    )
    db.commit()
    return {"ok": True, "hiddenUserId": target_user_id}


@router.post("/hide-post/{post_id}")
def hide_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            INSERT INTO public.feed_events
              (viewer_user_id, subject_user_id, post_id, event_type, algorithm_version, metadata)
            SELECT
              :viewer_user_id,
              p.author_user_id,
              p.id,
              'hide',
              'post_feed_v2',
              CAST(:metadata_json AS jsonb)
            FROM public.posts p
            WHERE p.id = :post_id
            RETURNING id
            """
        ),
        {
            "viewer_user_id": current_user.id,
            "post_id": post_id,
            "metadata_json": json.dumps({"source": "moderation"}),
        },
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    db.commit()
    return {"ok": True, "postId": post_id}


@router.delete("/hide-post/{post_id}")
def unhide_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.feed_events
            WHERE viewer_user_id = :viewer_user_id
              AND post_id = :post_id
              AND event_type = 'hide'
            """
        ),
        {"viewer_user_id": current_user.id, "post_id": post_id},
    )
    db.commit()
    return {"ok": True, "postId": post_id}
