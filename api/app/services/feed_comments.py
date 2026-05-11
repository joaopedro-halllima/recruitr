from __future__ import annotations

import json

from sqlalchemy import text
from sqlalchemy.orm import Session

_feed_comment_schema_ready = False


def ensure_feed_comment_schema(db: Session) -> None:
    global _feed_comment_schema_ready
    if _feed_comment_schema_ready:
        return

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.post_comments (
              id BIGSERIAL PRIMARY KEY,
              post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
              parent_comment_id BIGINT REFERENCES public.post_comments(id) ON DELETE CASCADE,
              body TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_post_comments_post_id_created_at
            ON public.post_comments (post_id, created_at DESC)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_post_comments_parent_comment_id
            ON public.post_comments (parent_comment_id)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_post_comments_user_id
            ON public.post_comments (user_id)
            """
        )
    )

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.post_comment_likes (
              comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
              user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              PRIMARY KEY (comment_id, user_id)
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_post_comment_likes_user_id
            ON public.post_comment_likes (user_id)
            """
        )
    )

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.post_comment_mentions (
              comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
              mentioned_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
              handle TEXT NOT NULL,
              label TEXT NOT NULL,
              created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
              PRIMARY KEY (comment_id, mentioned_user_id)
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_post_comment_mentions_mentioned_user_id
            ON public.post_comment_mentions (mentioned_user_id)
            """
        )
    )

    db.commit()
    _feed_comment_schema_ready = True


def serialize_mentions_for_insert(
    mentions: list[dict[str, object]],
) -> str:
    return json.dumps(
        [
            {
                "userId": int(m["user_id"]),
                "handle": str(m["handle"]),
                "label": str(m["label"]),
            }
            for m in mentions
        ]
    )
