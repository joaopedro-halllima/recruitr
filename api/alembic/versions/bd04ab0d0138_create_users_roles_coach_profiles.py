"""create users roles coach profiles

Revision ID: bd04ab0d0138
Revises: 
Create Date: 2026-02-24 19:23:36.046917

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bd04ab0d0138'
down_revision: Union[str, Sequence[str], None] = "0000_init_all"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
