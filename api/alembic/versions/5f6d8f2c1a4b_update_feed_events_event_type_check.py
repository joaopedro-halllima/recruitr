"""update feed_events event_type check to include like/save

Revision ID: 5f6d8f2c1a4b
Revises: bd04ab0d0138
Create Date: 2026-02-27 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "5f6d8f2c1a4b"
down_revision: Union[str, Sequence[str], None] = "bd04ab0d0138"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute(
        """
        ALTER TABLE public.feed_events
        DROP CONSTRAINT IF EXISTS feed_events_event_type_check;
        """
    )
    op.execute(
        """
        ALTER TABLE public.feed_events
        ADD CONSTRAINT feed_events_event_type_check
        CHECK (
            event_type IN (
                'impression',
                'view_3s',
                'view_10s',
                'view_complete',
                'profile_open',
                'shortlist',
                'message_sent',
                'hide',
                'report',
                'like',
                'save'
            )
        );
        """
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.execute(
        """
        ALTER TABLE public.feed_events
        DROP CONSTRAINT IF EXISTS feed_events_event_type_check;
        """
    )
    op.execute(
        """
        ALTER TABLE public.feed_events
        ADD CONSTRAINT feed_events_event_type_check
        CHECK (
            event_type IN (
                'impression',
                'view_3s',
                'view_10s',
                'view_complete',
                'profile_open',
                'shortlist',
                'message_sent',
                'hide',
                'report'
            )
        );
        """
    )

