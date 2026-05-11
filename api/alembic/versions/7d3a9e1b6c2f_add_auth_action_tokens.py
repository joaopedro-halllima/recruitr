"""add auth action tokens

Revision ID: 7d3a9e1b6c2f
Revises: f2c4b7e91a2d
Create Date: 2026-04-28 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "7d3a9e1b6c2f"
down_revision: Union[str, Sequence[str], None] = "f2c4b7e91a2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.auth_action_tokens (
          id BIGSERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
          purpose VARCHAR(32) NOT NULL,
          token_hash VARCHAR(128) NOT NULL UNIQUE,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_user_purpose
        ON public.auth_action_tokens (user_id, purpose)
        """
    )
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_expires_at
        ON public.auth_action_tokens (expires_at)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS public.ix_auth_action_tokens_expires_at")
    op.execute("DROP INDEX IF EXISTS public.ix_auth_action_tokens_user_purpose")
    op.execute("DROP TABLE IF EXISTS public.auth_action_tokens")
