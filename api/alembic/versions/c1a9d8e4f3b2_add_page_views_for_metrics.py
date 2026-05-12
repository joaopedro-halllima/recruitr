"""add page_views for metrics

Revision ID: c1a9d8e4f3b2
Revises: 8a7e4d2b1c3f
Create Date: 2026-04-02 17:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "c1a9d8e4f3b2"
down_revision: Union[str, Sequence[str], None] = "8a7e4d2b1c3f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass
    """
    op.execute(

        CREATE TABLE IF NOT EXISTS public.page_views (
          id BIGSERIAL PRIMARY KEY,
          path TEXT NOT NULL,
          visitor_id VARCHAR(128),
          user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
          referrer TEXT,
          title VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_page_views_created_at
        ON public.page_views (created_at DESC)
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_page_views_user_id
        ON public.page_views (user_id)
        
    )
    op.execute(
        
        CREATE INDEX IF NOT EXISTS ix_page_views_path
        ON public.page_views (path)
        
    ) """


def downgrade() -> None:
    pass
    """
    op.execute("DROP INDEX IF EXISTS public.ix_page_views_path")
    op.execute("DROP INDEX IF EXISTS public.ix_page_views_user_id")
    op.execute("DROP INDEX IF EXISTS public.ix_page_views_created_at")
    op.execute("DROP TABLE IF EXISTS public.page_views") """
