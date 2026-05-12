"""add auth action tokens

Revision ID: 7d3a9e1b6c2f
Revises: f2c4b7e91a2d
Create Date: 2026-04-28 13:30:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = "7d3a9e1b6c2f"
down_revision: Union[str, Sequence[str], None] = "5f6d8f2c1a4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
