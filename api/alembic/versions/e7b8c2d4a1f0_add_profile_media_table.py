"""add profile_media table

Revision ID: e7b8c2d4a1f0
Revises: c1a9d8e4f3b2
Create Date: 2026-04-22 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "e7b8c2d4a1f0"
down_revision: Union[str, Sequence[str], None] = "c1a9d8e4f3b2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
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
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_profile_media_avatar_media_asset_id
        ON public.profile_media (avatar_media_asset_id)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_profile_media_banner_media_asset_id
        ON public.profile_media (banner_media_asset_id)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_profile_media_banner_media_asset_id")
    op.execute("DROP INDEX IF EXISTS public.ix_profile_media_avatar_media_asset_id")
    op.execute("DROP TABLE IF EXISTS public.profile_media")
