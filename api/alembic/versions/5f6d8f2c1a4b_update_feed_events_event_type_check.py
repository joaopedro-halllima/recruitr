"""update feed_events event_type check to include like/save

Revision ID: 5f6d8f2c1a4b
Revises: bd04ab0d0138
Create Date: 2026-02-27 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "5f6d8f2c1a4b"
down_revision: Union[str, Sequence[str], None] = "f2c4b7e91a2d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass

