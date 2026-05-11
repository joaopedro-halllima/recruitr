"""init all tables for fresh database

Revision ID: 0000_init_all
Revises:
Create Date: 2026-02-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0000_init_all"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("""

    -- ══════════════════════════════════════
    -- Core identity tables
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.roles (
      id SERIAL PRIMARY KEY,
      key VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS public.users (
      id SERIAL PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      is_email_verified BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX IF NOT EXISTS ix_users_email ON public.users (email);

    CREATE TABLE IF NOT EXISTS public.user_roles (
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      role_id INTEGER NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, role_id)
    );

    CREATE TABLE IF NOT EXISTS public.leads (
      id SERIAL PRIMARY KEY,
      email VARCHAR(320) NOT NULL,
      source VARCHAR(64),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT uq_leads_email UNIQUE (email)
    );

    -- ══════════════════════════════════════
    -- Profiles
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.athlete_profiles (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL DEFAULT '',
      last_name VARCHAR(100) NOT NULL DEFAULT '',
      sport VARCHAR(100),
      grad_year INTEGER,
      positions TEXT[] DEFAULT '{}',
      state VARCHAR(50),
      country VARCHAR(100) DEFAULT 'USA',
      willing_to_travel BOOLEAN DEFAULT false,
      travel_radius_mi INTEGER,
      club_team VARCHAR(200),
      school_unitid VARCHAR(16),
      high_school VARCHAR(200),
      bio TEXT DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.coach_profiles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      title VARCHAR(150),
      organization_name VARCHAR(255),
      sport VARCHAR(100),
      level VARCHAR(100),
      bio TEXT,
      is_verified_coach BOOLEAN NOT NULL DEFAULT false,
      school_unitid VARCHAR(16),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.coach_recruiting_prefs (
      id BIGSERIAL PRIMARY KEY,
      coach_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      sport VARCHAR(100) NOT NULL,
      grad_year_min INTEGER,
      grad_year_max INTEGER,
      positions_needed TEXT[] DEFAULT '{}',
      geo_state VARCHAR(50),
      radius_mi INTEGER,
      level VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (coach_user_id, sport)
    );

    CREATE TABLE IF NOT EXISTS public.athlete_statlines_soccer (
      id BIGSERIAL PRIMARY KEY,
      athlete_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      season_year INTEGER NOT NULL,
      team_name VARCHAR(200),
      matches INTEGER DEFAULT 0,
      minutes INTEGER DEFAULT 0,
      goals INTEGER DEFAULT 0,
      assists INTEGER DEFAULT 0,
      source_type VARCHAR(50) DEFAULT 'manual',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ══════════════════════════════════════
    -- Media and uploads
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.media_assets (
      id BIGSERIAL PRIMARY KEY,
      public_id UUID NOT NULL DEFAULT gen_random_uuid(),
      owner_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      post_id BIGINT,
      kind VARCHAR(50) NOT NULL DEFAULT 'image',
      provider VARCHAR(50) NOT NULL DEFAULT 'local',
      status VARCHAR(50) NOT NULL DEFAULT 'pending',
      storage_key TEXT,
      mime_type VARCHAR(120),
      byte_size BIGINT DEFAULT 0,
      public_url TEXT,
      poster_url TEXT,
      thumb_public_url TEXT,
      duration_seconds REAL,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_media_assets_post_id ON public.media_assets (post_id);
    CREATE INDEX IF NOT EXISTS ix_media_assets_owner ON public.media_assets (owner_user_id);

    CREATE TABLE IF NOT EXISTS public.upload_sessions (
      id BIGSERIAL PRIMARY KEY,
      public_id UUID NOT NULL DEFAULT gen_random_uuid(),
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL DEFAULT 'local-direct',
      status VARCHAR(50) NOT NULL DEFAULT 'issued',
      expires_at TIMESTAMPTZ,
      meta JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.profile_media (
      user_id INTEGER PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
      avatar_media_asset_id BIGINT REFERENCES public.media_assets(id) ON DELETE SET NULL,
      banner_media_asset_id BIGINT REFERENCES public.media_assets(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ══════════════════════════════════════
    -- Posts, tags, feed
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.posts (
      id BIGSERIAL PRIMARY KEY,
      public_id UUID NOT NULL DEFAULT gen_random_uuid(),
      author_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      sport VARCHAR(100),
      caption TEXT DEFAULT '',
      visibility VARCHAR(50) NOT NULL DEFAULT 'public',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_posts_author ON public.posts (author_user_id);

    CREATE TABLE IF NOT EXISTS public.tags (
      id SERIAL PRIMARY KEY,
      slug VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(150),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.post_tags (
      post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      tag_id INTEGER NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,
      PRIMARY KEY (post_id, tag_id)
    );

    CREATE TABLE IF NOT EXISTS public.post_likes (
      post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS public.post_saves (
      post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS public.feed_events (
      id BIGSERIAL PRIMARY KEY,
      viewer_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      subject_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      post_id BIGINT REFERENCES public.posts(id) ON DELETE CASCADE,
      event_type VARCHAR(50) NOT NULL,
      algorithm_version VARCHAR(50),
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT feed_events_event_type_check CHECK (
        event_type IN (
          'impression','view_3s','view_10s','view_complete',
          'profile_open','shortlist','message_sent',
          'hide','report','like','save'
        )
      )
    );
    CREATE INDEX IF NOT EXISTS ix_feed_events_viewer ON public.feed_events (viewer_user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS ix_feed_events_post ON public.feed_events (post_id);

    -- ══════════════════════════════════════
    -- Comments
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.post_comments (
      id BIGSERIAL PRIMARY KEY,
      post_id BIGINT NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      parent_comment_id BIGINT REFERENCES public.post_comments(id) ON DELETE CASCADE,
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_post_comments_post_id_created_at ON public.post_comments (post_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS public.post_comment_likes (
      comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS public.post_comment_mentions (
      comment_id BIGINT NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
      mentioned_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      handle TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (comment_id, mentioned_user_id)
    );

    -- ══════════════════════════════════════
    -- Social graph
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.follows (
      follower_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      followee_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (follower_user_id, followee_user_id)
    );

    -- ══════════════════════════════════════
    -- Direct messaging
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.dm_threads (
      id BIGSERIAL PRIMARY KEY,
      public_id UUID NOT NULL DEFAULT gen_random_uuid(),
      coach_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      athlete_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      last_message_at TIMESTAMPTZ DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (coach_user_id, athlete_user_id)
    );

    CREATE TABLE IF NOT EXISTS public.dm_messages (
      id BIGSERIAL PRIMARY KEY,
      thread_id BIGINT NOT NULL REFERENCES public.dm_threads(id) ON DELETE CASCADE,
      sender_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      body TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_dm_messages_thread ON public.dm_messages (thread_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS public.dm_message_attachments (
      message_id BIGINT NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
      media_asset_id BIGINT NOT NULL REFERENCES public.media_assets(id) ON DELETE CASCADE,
      PRIMARY KEY (message_id, media_asset_id)
    );

    CREATE TABLE IF NOT EXISTS public.dm_message_reads (
      message_id BIGINT NOT NULL REFERENCES public.dm_messages(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (message_id, user_id)
    );

    -- ══════════════════════════════════════
    -- Coach workflow
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.shortlist_lists (
      id BIGSERIAL PRIMARY KEY,
      coach_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      name VARCHAR(200) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.shortlist_items (
      list_id BIGINT NOT NULL REFERENCES public.shortlist_lists(id) ON DELETE CASCADE,
      athlete_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (list_id, athlete_user_id)
    );

    CREATE TABLE IF NOT EXISTS public.coach_verification_requests (
      id BIGSERIAL PRIMARY KEY,
      coach_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      status VARCHAR(50) NOT NULL DEFAULT 'submitted',
      evidence_media_asset_id BIGINT REFERENCES public.media_assets(id) ON DELETE SET NULL,
      notes TEXT,
      submitted_at TIMESTAMPTZ DEFAULT now(),
      reviewed_at TIMESTAMPTZ
    );

    -- ══════════════════════════════════════
    -- Notifications
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.notifications (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      notif_type VARCHAR(100) NOT NULL,
      title VARCHAR(300),
      body TEXT,
      data JSONB DEFAULT '{}'::jsonb,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_notifications_user ON public.notifications (user_id, created_at DESC);

    -- ══════════════════════════════════════
    -- Moderation
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.reports (
      id BIGSERIAL PRIMARY KEY,
      reporter_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      target_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      target_post_id BIGINT REFERENCES public.posts(id) ON DELETE SET NULL,
      reason VARCHAR(200),
      details TEXT,
      status VARCHAR(50) NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.user_blocks (
      blocker_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      blocked_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (blocker_user_id, blocked_user_id)
    );

    CREATE TABLE IF NOT EXISTS public.user_hides (
      hider_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      hidden_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (hider_user_id, hidden_user_id)
    );

    -- ══════════════════════════════════════
    -- Schools and teams
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.schools (
      unitid VARCHAR(16) PRIMARY KEY,
      name VARCHAR(300) NOT NULL,
      city VARCHAR(200),
      state VARCHAR(50),
      zip VARCHAR(20),
      website VARCHAR(500),
      sector VARCHAR(100),
      level VARCHAR(100),
      conference VARCHAR(200),
      logo_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.teams (
      id BIGSERIAL PRIMARY KEY,
      school_unitid VARCHAR(16) REFERENCES public.schools(unitid) ON DELETE CASCADE,
      sport VARCHAR(100) NOT NULL,
      team_name VARCHAR(200),
      created_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.team_memberships (
      id BIGSERIAL PRIMARY KEY,
      team_id BIGINT NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      role VARCHAR(50) DEFAULT 'member',
      status VARCHAR(50) DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (team_id, user_id)
    );

    -- ══════════════════════════════════════
    -- Metrics
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.page_views (
      id BIGSERIAL PRIMARY KEY,
      path TEXT NOT NULL,
      visitor_id VARCHAR(128),
      user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
      referrer TEXT,
      title VARCHAR(255),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    -- ══════════════════════════════════════
    -- Auth tokens
    -- ══════════════════════════════════════

    CREATE TABLE IF NOT EXISTS public.auth_action_tokens (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      action VARCHAR(50) NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS ix_auth_action_tokens_hash ON public.auth_action_tokens (token_hash);

    """))


def downgrade() -> None:
    pass
