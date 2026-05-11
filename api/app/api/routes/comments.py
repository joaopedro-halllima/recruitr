from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.comments import CommentCreateRequest
from app.services.feed_comments import ensure_feed_comment_schema

router = APIRouter(prefix="/api/v1/feed", tags=["feed-comments"])


def _comment_row_to_response(row, current_user_id: int) -> dict:
    mentions_raw = row["mentions"] or []
    mentions = []
    if isinstance(mentions_raw, str):
        try:
            mentions_raw = json.loads(mentions_raw)
        except json.JSONDecodeError:
            mentions_raw = []

    if isinstance(mentions_raw, list):
        for item in mentions_raw:
            if not isinstance(item, dict):
                continue
            user_id = item.get("userId")
            handle = item.get("handle")
            label = item.get("label")
            role = item.get("role")
            if not isinstance(user_id, int) or not isinstance(handle, str) or not isinstance(label, str):
                continue
            mentions.append(
                {
                    "userId": user_id,
                    "handle": handle,
                    "label": label,
                    "role": role if role in {"athlete", "coach"} else None,
                }
            )

    return {
        "id": int(row["id"]),
        "postId": int(row["post_id"]),
        "parentCommentId": int(row["parent_comment_id"]) if row["parent_comment_id"] is not None else None,
        "body": row["body"] or "",
        "createdAt": row["created_at"].isoformat(),
        "updatedAt": row["updated_at"].isoformat(),
        "authorUserId": int(row["user_id"]),
        "authorName": row["author_name"] or "Recruitr User",
        "likeCount": int(row["like_count"] or 0),
        "viewerLiked": bool(row["viewer_liked"]),
        "canDelete": int(row["user_id"]) == current_user_id,
        "mentions": mentions,
    }


def _fetch_comment_rows(
    db: Session,
    *,
    post_id: int,
    viewer_user_id: int,
    limit: int,
    offset: int,
    focus_comment_id: int | None = None,
):
    ensure_feed_comment_schema(db)
    total_root_comments = db.execute(
        text(
            """
            SELECT COUNT(*)::int
            FROM public.post_comments pc
            WHERE pc.post_id = :post_id
              AND pc.parent_comment_id IS NULL
            """
        ),
        {"post_id": post_id},
    ).scalar_one()

    rows = db.execute(
        text(
            """
            WITH RECURSIVE page_root_comments AS (
              SELECT
                pc.id,
                pc.created_at
              FROM public.post_comments pc
              WHERE pc.post_id = :post_id
                AND pc.parent_comment_id IS NULL
              ORDER BY pc.created_at DESC, pc.id DESC
              LIMIT :limit
              OFFSET :offset
            ),
            focus_chain AS (
              SELECT
                pc.id,
                pc.parent_comment_id,
                pc.created_at
              FROM public.post_comments pc
              WHERE pc.id = :focus_comment_id
                AND pc.post_id = :post_id

              UNION ALL

              SELECT
                parent.id,
                parent.parent_comment_id,
                parent.created_at
              FROM public.post_comments parent
              JOIN focus_chain fc
                ON fc.parent_comment_id = parent.id
            ),
            focus_root AS (
              SELECT
                fc.id,
                fc.created_at
              FROM focus_chain fc
              WHERE fc.parent_comment_id IS NULL
              LIMIT 1
            ),
            root_comments AS (
              SELECT id, created_at
              FROM page_root_comments
              UNION
              SELECT id, created_at
              FROM focus_root
            ),
            thread_comments AS (
              SELECT
                pc.id,
                pc.post_id,
                pc.parent_comment_id,
                pc.body,
                pc.created_at,
                pc.updated_at,
                pc.user_id,
                rc.created_at AS root_created_at,
                rc.id AS root_comment_id
              FROM public.post_comments pc
              JOIN root_comments rc
                ON rc.id = pc.id

              UNION ALL

              SELECT
                child.id,
                child.post_id,
                child.parent_comment_id,
                child.body,
                child.created_at,
                child.updated_at,
                child.user_id,
                tc.root_created_at,
                tc.root_comment_id
              FROM public.post_comments child
              JOIN thread_comments tc
                ON child.parent_comment_id = tc.id
            ),
            like_counts AS (
              SELECT pcl.comment_id, COUNT(*)::int AS like_count
              FROM public.post_comment_likes pcl
              WHERE pcl.comment_id IN (SELECT id FROM thread_comments)
              GROUP BY pcl.comment_id
            ),
            mention_roles AS (
              SELECT
                ur.user_id,
                CASE
                  WHEN bool_or(r.key = 'athlete') THEN 'athlete'
                  WHEN bool_or(r.key = 'coach') THEN 'coach'
                  ELSE NULL
                END AS role
              FROM public.user_roles ur
              JOIN public.roles r
                ON r.id = ur.role_id
              GROUP BY ur.user_id
            ),
            mention_agg AS (
              SELECT
                pcm.comment_id,
                jsonb_agg(
                  jsonb_build_object(
                    'userId', pcm.mentioned_user_id,
                    'handle', pcm.handle,
                    'label', pcm.label,
                    'role', mr.role
                  )
                  ORDER BY pcm.created_at ASC, pcm.mentioned_user_id ASC
                ) AS mentions
              FROM public.post_comment_mentions pcm
              LEFT JOIN mention_roles mr
                ON mr.user_id = pcm.mentioned_user_id
              WHERE pcm.comment_id IN (SELECT id FROM thread_comments)
              GROUP BY pcm.comment_id
            )
            SELECT
              tc.id,
              tc.post_id,
              tc.parent_comment_id,
              tc.body,
              tc.created_at,
              tc.updated_at,
              tc.user_id,
              COALESCE(NULLIF(CONCAT_WS(' ', ap.first_name, ap.last_name), ''), NULLIF(CONCAT_WS(' ', cp.first_name, cp.last_name), ''), u.email) AS author_name,
              COALESCE(lc.like_count, 0) AS like_count,
              EXISTS (
                SELECT 1
                FROM public.post_comment_likes pclv
                WHERE pclv.comment_id = tc.id
                  AND pclv.user_id = :viewer_user_id
              ) AS viewer_liked,
              COALESCE(ma.mentions, '[]'::jsonb) AS mentions
            FROM thread_comments tc
            JOIN public.users u
              ON u.id = tc.user_id
            LEFT JOIN public.athlete_profiles ap
              ON ap.user_id = tc.user_id
            LEFT JOIN public.coach_profiles cp
              ON cp.user_id = tc.user_id
            LEFT JOIN like_counts lc
              ON lc.comment_id = tc.id
            LEFT JOIN mention_agg ma
              ON ma.comment_id = tc.id
            ORDER BY
              tc.root_created_at DESC,
              tc.root_comment_id DESC,
              CASE WHEN tc.parent_comment_id IS NULL THEN 0 ELSE 1 END,
              tc.created_at ASC,
              tc.id ASC
            """
        ),
        {
            "post_id": post_id,
            "viewer_user_id": viewer_user_id,
            "limit": limit,
            "offset": offset,
            "focus_comment_id": focus_comment_id,
        },
    ).mappings().all()
    return rows, int(total_root_comments or 0)


def _fetch_single_comment(db: Session, *, comment_id: int, viewer_user_id: int):
    ensure_feed_comment_schema(db)
    rows = db.execute(
        text(
            """
            WITH like_counts AS (
              SELECT pcl.comment_id, COUNT(*)::int AS like_count
              FROM public.post_comment_likes pcl
              WHERE pcl.comment_id = :comment_id
              GROUP BY pcl.comment_id
            ),
            mention_roles AS (
              SELECT
                ur.user_id,
                CASE
                  WHEN bool_or(r.key = 'athlete') THEN 'athlete'
                  WHEN bool_or(r.key = 'coach') THEN 'coach'
                  ELSE NULL
                END AS role
              FROM public.user_roles ur
              JOIN public.roles r
                ON r.id = ur.role_id
              GROUP BY ur.user_id
            ),
            mention_agg AS (
              SELECT
                pcm.comment_id,
                jsonb_agg(
                  jsonb_build_object(
                    'userId', pcm.mentioned_user_id,
                    'handle', pcm.handle,
                    'label', pcm.label,
                    'role', mr.role
                  )
                  ORDER BY pcm.created_at ASC, pcm.mentioned_user_id ASC
                ) AS mentions
              FROM public.post_comment_mentions pcm
              LEFT JOIN mention_roles mr
                ON mr.user_id = pcm.mentioned_user_id
              WHERE pcm.comment_id = :comment_id
              GROUP BY pcm.comment_id
            )
            SELECT
              pc.id,
              pc.post_id,
              pc.parent_comment_id,
              pc.body,
              pc.created_at,
              pc.updated_at,
              pc.user_id,
              COALESCE(NULLIF(CONCAT_WS(' ', ap.first_name, ap.last_name), ''), NULLIF(CONCAT_WS(' ', cp.first_name, cp.last_name), ''), u.email) AS author_name,
              COALESCE(lc.like_count, 0) AS like_count,
              EXISTS (
                SELECT 1
                FROM public.post_comment_likes pclv
                WHERE pclv.comment_id = pc.id
                  AND pclv.user_id = :viewer_user_id
              ) AS viewer_liked,
              COALESCE(ma.mentions, '[]'::jsonb) AS mentions
            FROM public.post_comments pc
            JOIN public.users u
              ON u.id = pc.user_id
            LEFT JOIN public.athlete_profiles ap
              ON ap.user_id = pc.user_id
            LEFT JOIN public.coach_profiles cp
              ON cp.user_id = pc.user_id
            LEFT JOIN like_counts lc
              ON lc.comment_id = pc.id
            LEFT JOIN mention_agg ma
              ON ma.comment_id = pc.id
            WHERE pc.id = :comment_id
            """
        ),
        {
            "comment_id": comment_id,
            "viewer_user_id": viewer_user_id,
        },
    ).mappings().first()
    return rows


def _validate_post_exists(db: Session, post_id: int):
    row = db.execute(
        text(
            """
            SELECT id, author_user_id, caption
            FROM public.posts
            WHERE id = :post_id
            """
        ),
        {"post_id": post_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Post not found")
    return row


def _normalize_mentions(db: Session, mentions: list[dict]) -> list[dict]:
    if not mentions:
        return []

    deduped: list[dict] = []
    seen: set[int] = set()
    for mention in mentions:
        user_id = int(mention.user_id)
        if user_id in seen:
            continue
        seen.add(user_id)
        deduped.append(
            {
                "user_id": user_id,
                "handle": mention.handle.strip().lstrip("@")[:40],
                "label": mention.label.strip()[:120],
            }
        )

    if not deduped:
        return []

    user_ids = [m["user_id"] for m in deduped]
    rows = db.execute(
        text("SELECT id FROM public.users WHERE id = ANY(:user_ids)"),
        {"user_ids": user_ids},
    ).all()
    valid = {int(r[0]) for r in rows}
    invalid = [user_id for user_id in user_ids if user_id not in valid]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Invalid mentioned user ids: {invalid}")
    return deduped


def _insert_notifications_for_comment(
    db: Session,
    *,
    actor_user_id: int,
    post_id: int,
    comment_id: int,
    comment_body: str,
    post_author_user_id: int,
    parent_comment_user_id: int | None,
    mentions: list[dict],
) -> None:
    preview = comment_body.strip()
    if len(preview) > 120:
        preview = preview[:117] + "..."

    recipients: list[tuple[int, str, str, str, dict]] = []
    notified: set[int] = set()

    if post_author_user_id != actor_user_id:
        recipients.append(
            (
                post_author_user_id,
                "post_comment",
                "New comment on your post",
                preview or "Someone commented on your post.",
                {"postId": post_id, "commentId": comment_id, "actorUserId": actor_user_id},
            )
        )
        notified.add(post_author_user_id)

    if parent_comment_user_id and parent_comment_user_id not in notified and parent_comment_user_id != actor_user_id:
        recipients.append(
            (
                parent_comment_user_id,
                "comment_reply",
                "New reply to your comment",
                preview or "Someone replied to your comment.",
                {"postId": post_id, "commentId": comment_id, "actorUserId": actor_user_id},
            )
        )
        notified.add(parent_comment_user_id)

    for mention in mentions:
        mentioned_user_id = mention["user_id"]
        if mentioned_user_id == actor_user_id or mentioned_user_id in notified:
            continue
        recipients.append(
            (
                mentioned_user_id,
                "comment_mention",
                "You were mentioned in a comment",
                preview or "Someone mentioned you in a comment.",
                {
                    "postId": post_id,
                    "commentId": comment_id,
                    "actorUserId": actor_user_id,
                    "handle": mention["handle"],
                },
            )
        )
        notified.add(mentioned_user_id)

    if not recipients:
        return

    db.execute(
        text(
            """
            INSERT INTO public.notifications (user_id, notif_type, title, body, data)
            VALUES (:user_id, :notif_type, :title, :body, CAST(:data_json AS jsonb))
            """
        ),
        [
            {
                "user_id": user_id,
                "notif_type": notif_type,
                "title": title,
                "body": body,
                "data_json": json.dumps(data),
            }
            for user_id, notif_type, title, body, data in recipients
        ],
    )


@router.get("/posts/{post_id}/comments")
def list_post_comments(
    post_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    focus_comment_id: int | None = Query(None, ge=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _validate_post_exists(db, post_id)
    rows, total_root_comments = _fetch_comment_rows(
        db,
        post_id=post_id,
        viewer_user_id=current_user.id,
        limit=limit,
        offset=offset,
        focus_comment_id=focus_comment_id,
    )
    return {
        "items": [_comment_row_to_response(row, current_user.id) for row in rows],
        "total": len(rows),
        "totalRootComments": total_root_comments,
        "limit": limit,
        "offset": offset,
        "hasMore": (offset + limit) < total_root_comments,
    }


@router.post("/posts/{post_id}/comments")
def create_post_comment(
    post_id: int,
    payload: CommentCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_feed_comment_schema(db)
    post_row = _validate_post_exists(db, post_id)
    parent_comment_user_id: int | None = None

    if payload.parent_comment_id is not None:
        parent_row = db.execute(
            text(
                """
                SELECT id, post_id, user_id
                FROM public.post_comments
                WHERE id = :comment_id
                """
            ),
            {"comment_id": payload.parent_comment_id},
        ).mappings().first()
        if not parent_row or int(parent_row["post_id"]) != post_id:
            raise HTTPException(status_code=400, detail="Reply target comment is invalid for this post")
        parent_comment_user_id = int(parent_row["user_id"])

    mentions = _normalize_mentions(db, payload.mentions)
    row = db.execute(
        text(
            """
            INSERT INTO public.post_comments
              (post_id, user_id, parent_comment_id, body)
            VALUES
              (:post_id, :user_id, :parent_comment_id, :body)
            RETURNING id
            """
        ),
        {
            "post_id": post_id,
            "user_id": current_user.id,
            "parent_comment_id": payload.parent_comment_id,
            "body": payload.body.strip(),
        },
    ).mappings().one()
    comment_id = int(row["id"])

    if mentions:
        db.execute(
            text(
                """
                INSERT INTO public.post_comment_mentions
                  (comment_id, mentioned_user_id, handle, label)
                VALUES
                  (:comment_id, :mentioned_user_id, :handle, :label)
                ON CONFLICT DO NOTHING
                """
            ),
            [
                {
                    "comment_id": comment_id,
                    "mentioned_user_id": mention["user_id"],
                    "handle": mention["handle"],
                    "label": mention["label"],
                }
                for mention in mentions
            ],
        )

    _insert_notifications_for_comment(
        db,
        actor_user_id=current_user.id,
        post_id=post_id,
        comment_id=comment_id,
        comment_body=payload.body,
        post_author_user_id=int(post_row["author_user_id"]),
        parent_comment_user_id=parent_comment_user_id,
        mentions=mentions,
    )
    db.commit()

    created = _fetch_single_comment(db, comment_id=comment_id, viewer_user_id=current_user.id)
    if not created:
        raise HTTPException(status_code=500, detail="Comment created but could not be loaded")
    return {"ok": True, "comment": _comment_row_to_response(created, current_user.id)}


@router.delete("/comments/{comment_id}")
def delete_post_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_feed_comment_schema(db)
    row = db.execute(
        text(
            """
            DELETE FROM public.post_comments
            WHERE id = :comment_id
              AND user_id = :user_id
            RETURNING id
            """
        ),
        {"comment_id": comment_id, "user_id": current_user.id},
    ).first()
    if not row:
        exists = db.execute(
            text("SELECT 1 FROM public.post_comments WHERE id = :comment_id"),
            {"comment_id": comment_id},
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Comment not found")
        raise HTTPException(status_code=403, detail="You can only delete your own comments")
    db.commit()
    return {"ok": True}


@router.post("/comments/{comment_id}/like")
def like_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_feed_comment_schema(db)
    exists = db.execute(
        text("SELECT 1 FROM public.post_comments WHERE id = :comment_id"),
        {"comment_id": comment_id},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.execute(
        text(
            """
            INSERT INTO public.post_comment_likes (comment_id, user_id)
            VALUES (:comment_id, :user_id)
            ON CONFLICT DO NOTHING
            """
        ),
        {"comment_id": comment_id, "user_id": current_user.id},
    )
    db.commit()
    return {"ok": True, "liked": True}


@router.delete("/comments/{comment_id}/like")
def unlike_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_feed_comment_schema(db)
    db.execute(
        text(
            """
            DELETE FROM public.post_comment_likes
            WHERE comment_id = :comment_id
              AND user_id = :user_id
            """
        ),
        {"comment_id": comment_id, "user_id": current_user.id},
    )
    db.commit()
    return {"ok": True, "liked": False}
