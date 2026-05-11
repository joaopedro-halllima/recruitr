from __future__ import annotations

import json
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db.deps import get_db
from app.models.user import User
from app.services.feed_comments import ensure_feed_comment_schema
from app.schemas.feed import FeedEventCreateRequest

router = APIRouter(prefix="/api/v1/feed", tags=["feed"])


def _normalize_media_url(url: str | None, request: Request) -> str | None:
    if not url:
        return None

    parsed = urlparse(url)
    if url.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + url

    if parsed.path.startswith("/api/v1/uploads/media/"):
        return str(request.base_url).rstrip("/") + parsed.path

    return url


def _ranking_weights() -> dict[str, float | int]:
    return {
        "recency_max": settings.FEED_RECENCY_MAX,
        "recency_days_per_point": settings.FEED_RECENCY_DAYS_PER_POINT,
        "social_max": settings.FEED_SOCIAL_MAX,
        "save_multiplier": settings.FEED_SAVE_MULTIPLIER,
        "match_sport_weight": settings.FEED_MATCH_SPORT_WEIGHT,
        "match_grad_year_weight": settings.FEED_MATCH_GRAD_YEAR_WEIGHT,
        "match_position_weight": settings.FEED_MATCH_POSITION_WEIGHT,
        "match_geo_weight": settings.FEED_MATCH_GEO_WEIGHT,
        "follow_boost": settings.FEED_FOLLOW_BOOST,
        "diversity_impression_weight": settings.FEED_DIVERSITY_IMPRESSION_WEIGHT,
        "negative_hide_weight": settings.FEED_NEGATIVE_HIDE_WEIGHT,
        "negative_report_weight": settings.FEED_NEGATIVE_REPORT_WEIGHT,
        "negative_max_penalty": settings.FEED_NEGATIVE_MAX_PENALTY,
        "exploration_window_days": settings.FEED_EXPLORATION_WINDOW_DAYS,
        "exploration_probability": settings.FEED_EXPLORATION_PROBABILITY,
        "exploration_boost": settings.FEED_EXPLORATION_BOOST,
    }


@router.get("")
def get_feed(
    request: Request,
    limit: int = Query(20, ge=1, le=50),
    debug: bool = Query(False, description="Include score breakdown in response items."),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Post feed v1 (PostCards):
    - returns public posts that have at least 1 ready media asset
    - includes tags (#slug)
    - includes media (video preferred, else image)
    - uses JWT identity for personalization/event logging
    - optional debug score breakdown with `?debug=1`
    """
    viewer_user_id = current_user.id
    ensure_feed_comment_schema(db)

    rows = db.execute(
        text(
            """
        WITH latest_media AS (
            SELECT DISTINCT ON (m.post_id)
                m.post_id,
                m.kind,
                m.public_url,
                COALESCE(NULLIF(to_jsonb(m)->>'thumb_public_url', ''), m.public_url) AS poster_url,
                CASE
                    WHEN (to_jsonb(m)->>'duration_seconds') ~ '^[0-9]+(\\.[0-9]+)?$'
                    THEN (to_jsonb(m)->>'duration_seconds')::double precision
                    ELSE NULL
                END AS duration_seconds
            FROM public.media_assets m
            WHERE m.status = 'ready'
                AND m.kind IN ('video','image')
                AND m.public_url IS NOT NULL
                AND btrim(m.public_url) <> ''
                AND lower(m.public_url) NOT LIKE 'https://example.com/%'
                AND lower(m.public_url) NOT LIKE 'http://example.com/%'
            -- prefer video if both exist
            ORDER BY m.post_id,
                    (CASE WHEN m.kind='video' THEN 0 ELSE 1 END),
                    m.created_at DESC
            ),
            tag_agg AS (
            SELECT
                pt.post_id,
                array_agg(DISTINCT '#' || t.slug ORDER BY '#' || t.slug) AS tags
            FROM public.post_tags pt
            JOIN public.tags t ON t.id = pt.tag_id
            GROUP BY pt.post_id
            ),
            ranked_posts AS (
            SELECT
                p.*,
                row_number() OVER (PARTITION BY p.author_user_id ORDER BY p.created_at DESC) AS rn
            FROM public.posts p
            WHERE p.visibility = 'public'
              AND NOT EXISTS (
                SELECT 1
                FROM public.user_hides uh
                WHERE uh.hider_user_id = :viewer_user_id
                  AND uh.hidden_user_id = p.author_user_id
              )
              AND NOT EXISTS (
                SELECT 1
                FROM public.user_blocks ub
                WHERE
                  (ub.blocker_user_id = :viewer_user_id AND ub.blocked_user_id = p.author_user_id)
                  OR
                  (ub.blocker_user_id = p.author_user_id AND ub.blocked_user_id = :viewer_user_id)
              )
              AND NOT EXISTS (
                SELECT 1
                FROM public.feed_events feh
                WHERE feh.viewer_user_id = :viewer_user_id
                  AND feh.post_id = p.id
                  AND feh.event_type = 'hide'
              )
              AND NOT EXISTS (
                SELECT 1
                FROM public.reports rp
                WHERE rp.reporter_user_id = :viewer_user_id
                  AND rp.target_post_id = p.id
              )
            ),
            viewer_prefs AS (
            SELECT
                c.coach_user_id,
                c.sport,
                c.grad_year_min,
                c.grad_year_max,
                c.positions_needed,
                c.geo_state
            FROM public.coach_recruiting_prefs c
            WHERE c.coach_user_id = :viewer_user_id
            ORDER BY c.updated_at DESC NULLS LAST
            LIMIT 1
            ),
            social_counts AS (
            SELECT
                p.id AS post_id,
                COALESCE(pl.like_count, 0) AS like_count,
                COALESCE(ps.save_count, 0) AS save_count,
                COALESCE(pc.comment_count, 0) AS comment_count
            FROM public.posts p
            LEFT JOIN (
                SELECT post_id, COUNT(*)::int AS like_count
                FROM public.post_likes
                GROUP BY post_id
            ) pl ON pl.post_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*)::int AS save_count
                FROM public.post_saves
                GROUP BY post_id
            ) ps ON ps.post_id = p.id
            LEFT JOIN (
                SELECT post_id, COUNT(*)::int AS comment_count
                FROM public.post_comments
                GROUP BY post_id
            ) pc ON pc.post_id = p.id
            ),
            recent_author_impressions AS (
            SELECT
                fe.subject_user_id,
                COUNT(*)::int AS impressions_7d
            FROM public.feed_events fe
            WHERE fe.viewer_user_id = :viewer_user_id
              AND fe.event_type = 'impression'
              AND fe.created_at >= now() - interval '7 days'
            GROUP BY fe.subject_user_id
            ),
            recent_negative_feedback AS (
            SELECT
                fe.subject_user_id,
                COUNT(*) FILTER (WHERE fe.event_type = 'hide')::int AS hide_count_30d,
                COUNT(*) FILTER (WHERE fe.event_type = 'report')::int AS report_count_30d
            FROM public.feed_events fe
                WHERE fe.viewer_user_id = :viewer_user_id
              AND fe.event_type IN ('hide', 'report')
              AND fe.created_at >= now() - interval '30 days'
            GROUP BY fe.subject_user_id
            ),
            viewer_likes AS (
            SELECT pl.post_id
            FROM public.post_likes pl
            WHERE pl.user_id = :viewer_user_id
            ),
            viewer_saves AS (
            SELECT ps.post_id
            FROM public.post_saves ps
            WHERE ps.user_id = :viewer_user_id
            ),
            viewer_follows AS (
            SELECT f.followee_user_id
            FROM public.follows f
            WHERE f.follower_user_id = :viewer_user_id
            ),
            base_candidates AS (
            SELECT
            p.id AS post_id,
            p.public_id AS post_public_id,
            p.caption,
            p.created_at,
            p.author_user_id,
            p.sport,

            lm.kind AS media_kind,
            lm.public_url AS media_url,
            lm.poster_url AS media_poster_url,
            lm.duration_seconds,

            COALESCE(ta.tags, ARRAY[]::text[]) AS tags,

            ap.first_name AS athlete_first,
            ap.last_name AS athlete_last,
            ap.grad_year,
            ap.positions AS athlete_positions,
            ap.state AS athlete_state,

            cp.first_name AS coach_first,
            cp.last_name AS coach_last,
            cp.organization_name,
            cp.level AS coach_level,

            COALESCE(sc.like_count, 0) AS like_count,
            COALESCE(sc.save_count, 0) AS save_count,
            COALESCE(sc.comment_count, 0) AS comment_count,
            COALESCE(rai.impressions_7d, 0) AS impressions_7d,
            COALESCE(rnf.hide_count_30d, 0) AS hide_count_30d,
            COALESCE(rnf.report_count_30d, 0) AS report_count_30d,
            (vl.post_id IS NOT NULL) AS viewer_liked,
            (vs.post_id IS NOT NULL) AS viewer_saved,
            (vf.followee_user_id IS NOT NULL) AS viewer_following,

            -- recency term (max 3.0, decays over ~14 days)
            GREATEST(
                0.0,
                :recency_max - (EXTRACT(EPOCH FROM (now() - p.created_at)) / 86400.0) / :recency_days_per_point
            ) AS recency_score,
            -- social proof (likes/saves)
            LEAST(
                :social_max,
                ln(1 + COALESCE(sc.like_count, 0) + (COALESCE(sc.save_count, 0) * :save_multiplier))
            ) AS social_score,
            -- match score (coach prefs to athlete profile)
            CASE
                WHEN vp.coach_user_id IS NULL THEN 0.0
                ELSE
                    (CASE
                        WHEN vp.sport IS NOT NULL AND lower(vp.sport) = lower(COALESCE(p.sport, '')) THEN :match_sport_weight
                        ELSE 0.0
                    END)
                    +
                    (CASE
                        WHEN vp.grad_year_min IS NOT NULL
                         AND vp.grad_year_max IS NOT NULL
                         AND ap.grad_year IS NOT NULL
                         AND ap.grad_year BETWEEN vp.grad_year_min AND vp.grad_year_max THEN :match_grad_year_weight
                        ELSE 0.0
                    END)
                    +
                    (CASE
                        WHEN vp.positions_needed IS NOT NULL
                         AND ap.positions IS NOT NULL
                         AND vp.positions_needed && ap.positions THEN :match_position_weight
                        ELSE 0.0
                    END)
                    +
                    (CASE
                        WHEN vp.geo_state IS NOT NULL
                         AND ap.state IS NOT NULL
                         AND lower(vp.geo_state) = lower(ap.state) THEN :match_geo_weight
                        ELSE 0.0
                    END)
            END AS match_score,
            -- diversity penalty for recent repeated author impressions
            (COALESCE(rai.impressions_7d, 0) * :diversity_impression_weight) AS diversity_penalty,
            -- penalty from viewer negative feedback history on this author
            LEAST(
                :negative_max_penalty,
                (COALESCE(rnf.hide_count_30d, 0) * :negative_hide_weight)
                + (COALESCE(rnf.report_count_30d, 0) * :negative_report_weight)
            ) AS negative_feedback_penalty,
            -- exploration: occasionally boost high-recency candidates
            CASE
                WHEN p.created_at >= now() - make_interval(days => :exploration_window_days)
                 AND random() < :exploration_probability THEN :exploration_boost
                ELSE 0.0
            END AS exploration_boost,
            -- follow-aware lift
            CASE
                WHEN vf.followee_user_id IS NOT NULL THEN :follow_boost
                ELSE 0.0
            END AS following_boost

            FROM ranked_posts p
            JOIN latest_media lm ON lm.post_id = p.id
            LEFT JOIN tag_agg ta ON ta.post_id = p.id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = p.author_user_id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = p.author_user_id
            LEFT JOIN social_counts sc ON sc.post_id = p.id
            LEFT JOIN recent_author_impressions rai ON rai.subject_user_id = p.author_user_id
            LEFT JOIN recent_negative_feedback rnf ON rnf.subject_user_id = p.author_user_id
            LEFT JOIN viewer_likes vl ON vl.post_id = p.id
            LEFT JOIN viewer_saves vs ON vs.post_id = p.id
            LEFT JOIN viewer_follows vf ON vf.followee_user_id = p.author_user_id
            LEFT JOIN viewer_prefs vp ON true

            WHERE p.rn = 1
            )
            SELECT
                bc.*,
                (
                    bc.recency_score
                    + bc.social_score
                    + bc.match_score
                    + bc.exploration_boost
                    + bc.following_boost
                    - bc.diversity_penalty
                    - bc.negative_feedback_penalty
                ) AS total_score
            FROM base_candidates bc
            ORDER BY total_score DESC, bc.created_at DESC
            LIMIT :limit;
            """
        ),
        {"limit": limit, "viewer_user_id": viewer_user_id, **_ranking_weights()},
    ).mappings().all()

    items: list[dict] = []
    impression_rows: list[dict] = []

    for idx, r in enumerate(rows):
        # author display
        if r["athlete_first"] is not None:
            author_name = f"{r['athlete_first']} {r['athlete_last']}"
            author_meta = f"Athlete • Soccer • Class of {r['grad_year']}"
        elif r["coach_first"] is not None:
            author_name = f"{r['coach_first']} {r['coach_last']}"
            org = r["organization_name"] or "Coach"
            lvl = r["coach_level"] or ""
            author_meta = f"{org}{(' • ' + lvl) if lvl else ''}"
        else:
            author_name = "Unknown Athlete"
            author_meta = "Athlete"

        avatar_text = "".join([p[0].upper() for p in author_name.split()[:2] if p]) or "U"

        media = None
        if r["media_kind"] == "video":
            media = {
                "kind": "video",
                "src": _normalize_media_url(r["media_url"], request),
                "poster": _normalize_media_url(r["media_poster_url"], request),
            }
        elif r["media_kind"] == "image":
            media = {"kind": "image", "src": _normalize_media_url(r["media_url"], request)}

        recency_score = float(r["recency_score"]) if r["recency_score"] is not None else 0.0
        social_score = float(r["social_score"]) if r["social_score"] is not None else 0.0
        match_score = float(r["match_score"]) if r["match_score"] is not None else 0.0
        diversity_penalty = float(r["diversity_penalty"]) if r["diversity_penalty"] is not None else 0.0
        negative_feedback_penalty = (
            float(r["negative_feedback_penalty"]) if r["negative_feedback_penalty"] is not None else 0.0
        )
        exploration_boost = float(r["exploration_boost"]) if r["exploration_boost"] is not None else 0.0
        following_boost = float(r["following_boost"]) if r["following_boost"] is not None else 0.0
        total_score = float(r["total_score"]) if r["total_score"] is not None else 0.0

        item = {
            "id": str(r["post_public_id"] or r["post_id"]),
            "postId": int(r["post_id"]),
            "authorUserId": int(r["author_user_id"]),
            "authorRole": ("athlete" if r["athlete_first"] is not None else ("coach" if r["coach_first"] is not None else "unknown")),
            "postType": ("athlete" if r["athlete_first"] is not None else ("coach" if r["coach_first"] is not None else "unknown")),
            "authorName": author_name,
            "authorMeta": author_meta,
            "avatarText": avatar_text,
            # frontend can compute relative; keep ISO for now
            "time": r["created_at"].isoformat(),
            "timeAgo": r["created_at"].isoformat(),
            "caption": r["caption"] or "",
            "tags": list(r["tags"] or []),
            "media": media,
            "score": total_score,
            "likeCount": int(r["like_count"] or 0),
            "saveCount": int(r["save_count"] or 0),
            "commentCount": int(r["comment_count"] or 0),
            "viewerLiked": bool(r["viewer_liked"]),
            "viewerSaved": bool(r["viewer_saved"]),
            "viewerFollowingAuthor": bool(r["viewer_following"]),
            "canSave": bool(r["athlete_first"] is not None),
        }
        if debug:
            item["scoreBreakdown"] = {
                "recency": recency_score,
                "social": social_score,
                "match": match_score,
                "explorationBoost": exploration_boost,
                "followingBoost": following_boost,
                "diversityPenalty": diversity_penalty,
                "negativeFeedbackPenalty": negative_feedback_penalty,
                "total": total_score,
            }
        items.append(item)

        impression_rows.append(
            {
                "viewer": viewer_user_id,
                "subject_user_id": int(r["author_user_id"]),
                "post_id": int(r["post_id"]),
                "metadata_json": json.dumps(
                    {
                        "limit": limit,
                        "rank": idx + 1,
                        "score_breakdown": {
                            "recency": recency_score,
                                "social": social_score,
                                "match": match_score,
                                "exploration_boost": exploration_boost,
                                "following_boost": following_boost,
                                "diversity_penalty": diversity_penalty,
                                "negative_feedback_penalty": negative_feedback_penalty,
                                "total": total_score,
                            },
                    }
                ),
            }
        )

    # Impression logging
    if impression_rows:
        db.execute(
            text(
                """
                INSERT INTO public.feed_events
                  (viewer_user_id, subject_user_id, post_id, event_type, algorithm_version, metadata)
                VALUES
                  (:viewer, :subject_user_id, :post_id, 'impression', 'post_feed_v2', CAST(:metadata_json AS jsonb))
                """
            ),
            impression_rows,
        )
        db.commit()

    return {"items": items}


@router.get("/posts/{post_id}")
def get_feed_post(
    post_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    viewer_user_id = current_user.id
    ensure_feed_comment_schema(db)

    row = db.execute(
        text(
            """
            WITH latest_media AS (
                SELECT DISTINCT ON (m.post_id)
                    m.post_id,
                    m.kind,
                    m.public_url,
                    COALESCE(NULLIF(to_jsonb(m)->>'thumb_public_url', ''), m.public_url) AS poster_url
                FROM public.media_assets m
                WHERE m.post_id = :post_id
                  AND m.status = 'ready'
                  AND m.kind IN ('video', 'image')
                  AND m.public_url IS NOT NULL
                  AND btrim(m.public_url) <> ''
                ORDER BY
                  m.post_id,
                  (CASE WHEN m.kind = 'video' THEN 0 ELSE 1 END),
                  m.created_at DESC
            ),
            tag_agg AS (
                SELECT
                  pt.post_id,
                  array_agg(DISTINCT '#' || t.slug ORDER BY '#' || t.slug) AS tags
                FROM public.post_tags pt
                JOIN public.tags t
                  ON t.id = pt.tag_id
                WHERE pt.post_id = :post_id
                GROUP BY pt.post_id
            ),
            social_counts AS (
                SELECT
                  p.id AS post_id,
                  COALESCE(pl.like_count, 0) AS like_count,
                  COALESCE(ps.save_count, 0) AS save_count,
                  COALESCE(pc.comment_count, 0) AS comment_count
                FROM public.posts p
                LEFT JOIN (
                  SELECT post_id, COUNT(*)::int AS like_count
                  FROM public.post_likes
                  WHERE post_id = :post_id
                  GROUP BY post_id
                ) pl ON pl.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*)::int AS save_count
                  FROM public.post_saves
                  WHERE post_id = :post_id
                  GROUP BY post_id
                ) ps ON ps.post_id = p.id
                LEFT JOIN (
                  SELECT post_id, COUNT(*)::int AS comment_count
                  FROM public.post_comments
                  WHERE post_id = :post_id
                  GROUP BY post_id
                ) pc ON pc.post_id = p.id
                WHERE p.id = :post_id
            ),
            viewer_likes AS (
                SELECT 1 AS present
                FROM public.post_likes pl
                WHERE pl.user_id = :viewer_user_id
                  AND pl.post_id = :post_id
                LIMIT 1
            ),
            viewer_saves AS (
                SELECT 1 AS present
                FROM public.post_saves ps
                WHERE ps.user_id = :viewer_user_id
                  AND ps.post_id = :post_id
                LIMIT 1
            ),
            viewer_follows AS (
                SELECT 1 AS present
                FROM public.follows f
                WHERE f.follower_user_id = :viewer_user_id
                  AND f.followee_user_id = (
                    SELECT author_user_id FROM public.posts WHERE id = :post_id
                  )
                LIMIT 1
            )
            SELECT
              p.id AS post_id,
              p.public_id AS post_public_id,
              p.caption,
              p.created_at,
              p.author_user_id,
              p.sport,
              lm.kind AS media_kind,
              lm.public_url AS media_url,
              lm.poster_url AS media_poster_url,
              COALESCE(ta.tags, ARRAY[]::text[]) AS tags,
              ap.first_name AS athlete_first,
              ap.last_name AS athlete_last,
              ap.grad_year,
              cp.first_name AS coach_first,
              cp.last_name AS coach_last,
              cp.organization_name,
              cp.level AS coach_level,
              COALESCE(sc.like_count, 0) AS like_count,
              COALESCE(sc.save_count, 0) AS save_count,
              COALESCE(sc.comment_count, 0) AS comment_count,
              EXISTS (SELECT 1 FROM viewer_likes) AS viewer_liked,
              EXISTS (SELECT 1 FROM viewer_saves) AS viewer_saved,
              EXISTS (SELECT 1 FROM viewer_follows) AS viewer_following
            FROM public.posts p
            JOIN latest_media lm
              ON lm.post_id = p.id
            LEFT JOIN tag_agg ta
              ON ta.post_id = p.id
            LEFT JOIN public.athlete_profiles ap
              ON ap.user_id = p.author_user_id
            LEFT JOIN public.coach_profiles cp
              ON cp.user_id = p.author_user_id
            LEFT JOIN social_counts sc
              ON sc.post_id = p.id
            WHERE p.id = :post_id
              AND p.visibility = 'public'
            LIMIT 1
            """
        ),
        {"post_id": post_id, "viewer_user_id": viewer_user_id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Post not found")

    if row["athlete_first"] is not None:
        author_name = f"{row['athlete_first']} {row['athlete_last']}"
        author_meta = f"Athlete • {row['sport'] or 'Sport'} • Class of {row['grad_year']}"
        author_role = "athlete"
    elif row["coach_first"] is not None:
        author_name = f"{row['coach_first']} {row['coach_last']}"
        org = row["organization_name"] or "Coach"
        lvl = row["coach_level"] or ""
        author_meta = f"{org}{(' • ' + lvl) if lvl else ''}"
        author_role = "coach"
    else:
        author_name = "Unknown Athlete"
        author_meta = "Athlete"
        author_role = "unknown"

    avatar_text = "".join([p[0].upper() for p in author_name.split()[:2] if p]) or "U"
    media = None
    if row["media_kind"] == "video":
        media = {
            "kind": "video",
            "src": _normalize_media_url(row["media_url"], request),
            "poster": _normalize_media_url(row["media_poster_url"], request),
        }
    elif row["media_kind"] == "image":
        media = {"kind": "image", "src": _normalize_media_url(row["media_url"], request)}

    return {
        "item": {
            "id": str(row["post_public_id"] or row["post_id"]),
            "postId": int(row["post_id"]),
            "authorUserId": int(row["author_user_id"]),
            "authorRole": author_role,
            "postType": author_role,
            "authorName": author_name,
            "authorMeta": author_meta,
            "avatarText": avatar_text,
            "time": row["created_at"].isoformat(),
            "timeAgo": row["created_at"].isoformat(),
            "caption": row["caption"] or "",
            "tags": list(row["tags"] or []),
            "media": media,
            "likeCount": int(row["like_count"] or 0),
            "saveCount": int(row["save_count"] or 0),
            "commentCount": int(row["comment_count"] or 0),
            "viewerLiked": bool(row["viewer_liked"]),
            "viewerSaved": bool(row["viewer_saved"]),
            "viewerFollowingAuthor": bool(row["viewer_following"]),
            "canSave": bool(author_role == "athlete"),
        }
    }


@router.post("/posts/{post_id}/like")
def like_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            INSERT INTO public.post_likes (post_id, user_id)
            SELECT p.id, :uid
            FROM public.posts p
            WHERE p.id = :post_id
            ON CONFLICT DO NOTHING
            RETURNING post_id
            """
        ),
        {"uid": current_user.id, "post_id": post_id},
    ).first()
    if not row:
        exists = db.execute(
            text("SELECT 1 FROM public.posts WHERE id = :post_id"),
            {"post_id": post_id},
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Post not found")
    db.commit()
    return {"ok": True, "liked": True}


@router.delete("/posts/{post_id}/like")
def unlike_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.post_likes
            WHERE post_id = :post_id
              AND user_id = :uid
            """
        ),
        {"uid": current_user.id, "post_id": post_id},
    )
    db.commit()
    return {"ok": True, "liked": False}


@router.post("/posts/{post_id}/save")
def save_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            """
            INSERT INTO public.post_saves (post_id, user_id)
            SELECT p.id, :uid
            FROM public.posts p
            WHERE p.id = :post_id
              AND EXISTS (
                SELECT 1
                FROM public.user_roles ur
                JOIN public.roles r ON r.id = ur.role_id
                WHERE ur.user_id = p.author_user_id
                  AND r.key = 'athlete'
              )
            ON CONFLICT DO NOTHING
            RETURNING post_id
            """
        ),
        {"uid": current_user.id, "post_id": post_id},
    ).first()
    if not row:
        exists = db.execute(
            text("SELECT 1 FROM public.posts WHERE id = :post_id"),
            {"post_id": post_id},
        ).first()
        if not exists:
            raise HTTPException(status_code=404, detail="Post not found")
        author_is_athlete = db.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM public.posts p
                  JOIN public.user_roles ur ON ur.user_id = p.author_user_id
                  JOIN public.roles r ON r.id = ur.role_id
                  WHERE p.id = :post_id
                    AND r.key = 'athlete'
                )
                """
            ),
            {"post_id": post_id},
        ).scalar()
        if not author_is_athlete:
            raise HTTPException(status_code=400, detail="Coach posts cannot be saved")
    db.commit()
    return {"ok": True, "saved": True}


@router.delete("/posts/{post_id}/save")
def unsave_post(
    post_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.post_saves
            WHERE post_id = :post_id
              AND user_id = :uid
            """
        ),
        {"uid": current_user.id, "post_id": post_id},
    )
    db.commit()
    return {"ok": True, "saved": False}


@router.post("/authors/{author_user_id}/follow")
def follow_author(
    author_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if author_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    exists = db.execute(
        text("SELECT 1 FROM public.users WHERE id = :author_user_id"),
        {"author_user_id": author_user_id},
    ).first()
    if not exists:
        raise HTTPException(status_code=404, detail="Author not found")
    db.execute(
        text(
            """
            INSERT INTO public.follows (follower_user_id, followee_user_id)
            VALUES (:uid, :author_user_id)
            ON CONFLICT DO NOTHING
            """
        ),
        {"uid": current_user.id, "author_user_id": author_user_id},
    )
    db.commit()
    return {"ok": True, "following": True}


@router.delete("/authors/{author_user_id}/follow")
def unfollow_author(
    author_user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            """
            DELETE FROM public.follows
            WHERE follower_user_id = :uid
              AND followee_user_id = :author_user_id
            """
        ),
        {"uid": current_user.id, "author_user_id": author_user_id},
    )
    db.commit()
    return {"ok": True, "following": False}


@router.get("/analytics")
def get_feed_analytics(
    days: int = Query(7, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    weights = _ranking_weights()

    bucket_rows = db.execute(
        text(
            """
            WITH impressions AS (
                SELECT
                    fe.viewer_user_id,
                    fe.post_id,
                    fe.created_at AS impression_at,
                    COALESCE((fe.metadata->'score_breakdown'->>'total')::double precision, 0.0) AS total_score
                FROM public.feed_events fe
                WHERE fe.viewer_user_id = :viewer_user_id
                  AND fe.event_type = 'impression'
                  AND fe.created_at >= now() - make_interval(days => :days)
            ),
            impression_outcomes AS (
                SELECT
                    i.*,
                    EXISTS (
                        SELECT 1
                        FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'view_3s'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_view_3s,
                    EXISTS (
                        SELECT 1
                        FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'like'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_like,
                    EXISTS (
                        SELECT 1
                        FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'save'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_save,
                    EXISTS (
                        SELECT 1
                        FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'hide'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_hide,
                    EXISTS (
                        SELECT 1
                        FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'report'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_report
                FROM impressions i
            )
            SELECT
                CASE
                    WHEN total_score < 1.0 THEN '<1'
                    WHEN total_score < 2.0 THEN '1-2'
                    WHEN total_score < 3.0 THEN '2-3'
                    WHEN total_score < 4.0 THEN '3-4'
                    ELSE '4+'
                END AS score_bucket,
                COUNT(*)::int AS impressions,
                AVG(did_view_3s::int)::double precision AS view_3s_rate,
                AVG(did_like::int)::double precision AS like_rate,
                AVG(did_save::int)::double precision AS save_rate,
                AVG(did_hide::int)::double precision AS hide_rate,
                AVG(did_report::int)::double precision AS report_rate
            FROM impression_outcomes
            GROUP BY score_bucket
            ORDER BY
                CASE score_bucket
                    WHEN '<1' THEN 1
                    WHEN '1-2' THEN 2
                    WHEN '2-3' THEN 3
                    WHEN '3-4' THEN 4
                    ELSE 5
                END
            """
        ),
        {"viewer_user_id": current_user.id, "days": days},
    ).mappings().all()

    summary_row = db.execute(
        text(
            """
            WITH impressions AS (
                SELECT
                    fe.viewer_user_id,
                    fe.post_id,
                    fe.created_at AS impression_at
                FROM public.feed_events fe
                WHERE fe.viewer_user_id = :viewer_user_id
                  AND fe.event_type = 'impression'
                  AND fe.created_at >= now() - make_interval(days => :days)
            ),
            impression_outcomes AS (
                SELECT
                    i.*,
                    EXISTS (
                        SELECT 1 FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'view_3s'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_view_3s,
                    EXISTS (
                        SELECT 1 FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'like'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_like,
                    EXISTS (
                        SELECT 1 FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'save'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_save,
                    EXISTS (
                        SELECT 1 FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'hide'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_hide,
                    EXISTS (
                        SELECT 1 FROM public.feed_events fe
                        WHERE fe.viewer_user_id = i.viewer_user_id
                          AND fe.post_id = i.post_id
                          AND fe.event_type = 'report'
                          AND fe.created_at >= i.impression_at
                          AND fe.created_at <= i.impression_at + interval '24 hours'
                    ) AS did_report
                FROM impressions i
            )
            SELECT
                COUNT(*)::int AS impressions,
                AVG(did_view_3s::int)::double precision AS view_3s_rate,
                AVG(did_like::int)::double precision AS like_rate,
                AVG(did_save::int)::double precision AS save_rate,
                AVG(did_hide::int)::double precision AS hide_rate,
                AVG(did_report::int)::double precision AS report_rate
            FROM impression_outcomes
            """
        ),
        {"viewer_user_id": current_user.id, "days": days},
    ).mappings().first()

    return {
        "viewerUserId": current_user.id,
        "windowDays": days,
        "weights": weights,
        "summary": {
            "impressions": int(summary_row["impressions"] or 0) if summary_row else 0,
            "view3sRate": float(summary_row["view_3s_rate"] or 0.0) if summary_row else 0.0,
            "likeRate": float(summary_row["like_rate"] or 0.0) if summary_row else 0.0,
            "saveRate": float(summary_row["save_rate"] or 0.0) if summary_row else 0.0,
            "hideRate": float(summary_row["hide_rate"] or 0.0) if summary_row else 0.0,
            "reportRate": float(summary_row["report_rate"] or 0.0) if summary_row else 0.0,
        },
        "buckets": [
            {
                "scoreBucket": row["score_bucket"],
                "impressions": int(row["impressions"] or 0),
                "view3sRate": float(row["view_3s_rate"] or 0.0),
                "likeRate": float(row["like_rate"] or 0.0),
                "saveRate": float(row["save_rate"] or 0.0),
                "hideRate": float(row["hide_rate"] or 0.0),
                "reportRate": float(row["report_rate"] or 0.0),
            }
            for row in bucket_rows
        ],
    }


@router.post("/events")
def create_feed_event(
    payload: FeedEventCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        row = db.execute(
            text(
                """
                INSERT INTO public.feed_events
                  (viewer_user_id, subject_user_id, post_id, event_type, algorithm_version, metadata)
                SELECT
                  :viewer_user_id,
                  p.author_user_id,
                  p.id,
                  :event_type,
                  :algorithm_version,
                  COALESCE(CAST(:metadata_json AS jsonb), '{}'::jsonb)
                FROM public.posts p
                WHERE p.id = :post_id
                RETURNING id
                """
            ),
            {
                "viewer_user_id": current_user.id,
                "post_id": payload.post_id,
                "event_type": payload.event_type,
                "algorithm_version": payload.algorithm_version or "post_feed_v2",
                "metadata_json": json.dumps(payload.metadata or {}),
            },
        ).first()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=400, detail=f"Invalid feed event payload: {exc.orig}") from exc

    if not row:
        raise HTTPException(status_code=404, detail="Post not found")

    db.commit()
    return {"ok": True}
