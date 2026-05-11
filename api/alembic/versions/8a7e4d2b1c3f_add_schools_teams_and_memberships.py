"""add schools teams and memberships

Revision ID: 8a7e4d2b1c3f
Revises: 5f6d8f2c1a4b
Create Date: 2026-02-27 23:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "8a7e4d2b1c3f"
down_revision: Union[str, Sequence[str], None] = "5f6d8f2c1a4b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    op.create_table(
        "schools",
        sa.Column("unitid", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("addr", sa.String(length=255), nullable=True),
        sa.Column("city", sa.String(length=120), nullable=True),
        sa.Column("state", sa.String(length=16), nullable=True),
        sa.Column("zip", sa.String(length=20), nullable=True),
        sa.Column("webaddr", sa.String(length=255), nullable=True),
        sa.Column("latitude", sa.Float(), nullable=True),
        sa.Column("longitud", sa.Float(), nullable=True),
        sa.Column("iclevel", sa.String(length=120), nullable=True),
        sa.Column("control", sa.String(length=120), nullable=True),
        sa.Column(
            "is_community_college",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
        sa.Column("logo_url", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("unitid"),
    )
    op.create_index("ix_schools_state", "schools", ["state"], unique=False)
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS ix_schools_name_trgm
        ON public.schools
        USING gin (name gin_trgm_ops);
        """
    )

    op.create_table(
        "teams",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("school_unitid", sa.String(length=16), nullable=False),
        sa.Column("sport", sa.String(length=80), nullable=False),
        sa.Column("team_name", sa.String(length=180), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["school_unitid"], ["schools.unitid"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("school_unitid", "sport", "team_name", name="uq_teams_school_sport_name"),
    )
    op.create_index("ix_teams_school_unitid", "teams", ["school_unitid"], unique=False)
    op.create_index("ix_teams_sport", "teams", ["sport"], unique=False)

    op.create_table(
        "team_memberships",
        sa.Column("id", sa.BigInteger(), nullable=False, autoincrement=True),
        sa.Column("team_id", sa.BigInteger(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column(
            "status",
            sa.String(length=20),
            nullable=False,
            server_default=sa.text("'pending'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.CheckConstraint("role IN ('athlete', 'coach', 'staff')", name="team_memberships_role_check"),
        sa.CheckConstraint(
            "status IN ('pending', 'active', 'rejected')",
            name="team_memberships_status_check",
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("team_id", "user_id", name="uq_team_memberships_team_user"),
    )
    op.create_index("ix_team_memberships_team_id", "team_memberships", ["team_id"], unique=False)
    op.create_index("ix_team_memberships_user_id", "team_memberships", ["user_id"], unique=False)
    op.create_index("ix_team_memberships_status", "team_memberships", ["status"], unique=False)

    op.add_column("athlete_profiles", sa.Column("school_unitid", sa.String(length=16), nullable=True))
    op.create_foreign_key(
        "fk_athlete_profiles_school_unitid_schools",
        "athlete_profiles",
        "schools",
        ["school_unitid"],
        ["unitid"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_athlete_profiles_school_unitid",
        "athlete_profiles",
        ["school_unitid"],
        unique=False,
    )

    op.add_column("coach_profiles", sa.Column("school_unitid", sa.String(length=16), nullable=True))
    op.create_foreign_key(
        "fk_coach_profiles_school_unitid_schools",
        "coach_profiles",
        "schools",
        ["school_unitid"],
        ["unitid"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_coach_profiles_school_unitid",
        "coach_profiles",
        ["school_unitid"],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index("ix_coach_profiles_school_unitid", table_name="coach_profiles")
    op.drop_constraint("fk_coach_profiles_school_unitid_schools", "coach_profiles", type_="foreignkey")
    op.drop_column("coach_profiles", "school_unitid")

    op.drop_index("ix_athlete_profiles_school_unitid", table_name="athlete_profiles")
    op.drop_constraint("fk_athlete_profiles_school_unitid_schools", "athlete_profiles", type_="foreignkey")
    op.drop_column("athlete_profiles", "school_unitid")

    op.drop_index("ix_team_memberships_status", table_name="team_memberships")
    op.drop_index("ix_team_memberships_user_id", table_name="team_memberships")
    op.drop_index("ix_team_memberships_team_id", table_name="team_memberships")
    op.drop_table("team_memberships")

    op.drop_index("ix_teams_sport", table_name="teams")
    op.drop_index("ix_teams_school_unitid", table_name="teams")
    op.drop_table("teams")

    op.execute("DROP INDEX IF EXISTS public.ix_schools_name_trgm;")
    op.drop_index("ix_schools_state", table_name="schools")
    op.drop_table("schools")
