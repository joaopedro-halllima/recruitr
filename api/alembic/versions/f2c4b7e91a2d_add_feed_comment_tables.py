"""add feed comment tables

Revision ID: f2c4b7e91a2d
Revises: e7b8c2d4a1f0
Create Date: 2026-04-22 16:20:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "f2c4b7e91a2d"
down_revision: Union[str, Sequence[str], None] = "e7b8c2d4a1f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass
    """
    op.execute(
        CREATE TABLE IF NOT EXISTS public.post_comments (
          id BIGSERIAL PRIMARY KEY,
          post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          parent_comment_id BIGINT REFERENCES public.post_comments(id) ON DELETE CASCADE,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_post_comments_post_id_created_at
        ON public.post_comments (post_id, created_at DESC)
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_post_comments_parent_comment_id
        ON public.post_comments (parent_comment_id)
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_post_comments_user_id
        ON public.post_comments (user_id)
        
    )

    op.execute(
        
        CREATE TABLE IF NOT EXISTS public.post_comment_likes (
          comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (comment_id, user_id)
        )
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_post_comment_likes_user_id
        ON public.post_comment_likes (user_id)
        
    )

    op.execute(
        
        CREATE TABLE IF NOT EXISTS public.post_comment_mentions (
          comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
          mentioned_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          handle TEXT NOT NULL,
          label TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          PRIMARY KEY (comment_id, mentioned_user_id)
        )
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_post_comment_mentions_mentioned_user_id
        ON public.post_comment_mentions (mentioned_user_id)
        
    ) """


def downgrade() -> None:
    pass
    """
    op.execute("DROP INDEX IF EXISTS public.ix_post_comment_mentions_mentioned_user_id")
    op.execute("DROP TABLE IF EXISTS public.post_comment_mentions")
    op.execute("DROP INDEX IF EXISTS public.ix_post_comment_likes_user_id")
    op.execute("DROP TABLE IF EXISTS public.post_comment_likes")
    op.execute("DROP INDEX IF EXISTS public.ix_post_comments_user_id")
    op.execute("DROP INDEX IF EXISTS public.ix_post_comments_parent_comment_id")
    op.execute("DROP INDEX IF EXISTS public.ix_post_comments_post_id_created_at")
    op.execute("DROP TABLE IF EXISTS public.post_comments") """
