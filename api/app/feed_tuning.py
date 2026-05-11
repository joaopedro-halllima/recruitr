import argparse
import json
from math import sqrt
from pathlib import Path
from typing import Any

from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal


POSITIVE_COMPONENTS = ["recency", "social", "match", "exploration_boost"]
PENALTY_COMPONENTS = ["diversity_penalty", "negative_feedback_penalty"]


def pearson(xs: list[float], ys: list[float]) -> float:
    n = len(xs)
    if n < 3:
        return 0.0
    mean_x = sum(xs) / n
    mean_y = sum(ys) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(xs, ys))
    var_x = sum((x - mean_x) ** 2 for x in xs)
    var_y = sum((y - mean_y) ** 2 for y in ys)
    if var_x <= 0 or var_y <= 0:
        return 0.0
    return cov / sqrt(var_x * var_y)


def clamp(val: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, val))


def tune_multiplier(
    corr: float,
    is_penalty: bool,
    *,
    base_step: float,
    max_step: float,
    high_conf_threshold: float,
) -> float:
    threshold = 0.02
    step = max_step if abs(corr) >= high_conf_threshold else base_step

    if is_penalty:
        if corr <= -threshold:
            return 1.0 + step
        if corr >= threshold:
            return 1.0 - step
        return 1.0

    if corr >= threshold:
        return 1.0 + step
    if corr <= -threshold:
        return 1.0 - step
    return 1.0


def compute_recommendations(
    correlations: dict[str, float],
    *,
    base_step: float,
    max_step: float,
    high_conf_threshold: float,
) -> dict[str, float]:
    recency_mult = tune_multiplier(
        correlations.get("recency", 0.0),
        is_penalty=False,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )
    social_mult = tune_multiplier(
        correlations.get("social", 0.0),
        is_penalty=False,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )
    match_mult = tune_multiplier(
        correlations.get("match", 0.0),
        is_penalty=False,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )
    exploration_mult = tune_multiplier(
        correlations.get("exploration_boost", 0.0),
        is_penalty=False,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )
    diversity_mult = tune_multiplier(
        correlations.get("diversity_penalty", 0.0),
        is_penalty=True,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )
    negative_mult = tune_multiplier(
        correlations.get("negative_feedback_penalty", 0.0),
        is_penalty=True,
        base_step=base_step,
        max_step=max_step,
        high_conf_threshold=high_conf_threshold,
    )

    return {
        "FEED_RECENCY_MAX": round(clamp(settings.FEED_RECENCY_MAX * recency_mult, 1.0, 6.0), 4),
        "FEED_SOCIAL_MAX": round(clamp(settings.FEED_SOCIAL_MAX * social_mult, 0.5, 6.0), 4),
        "FEED_MATCH_SPORT_WEIGHT": round(clamp(settings.FEED_MATCH_SPORT_WEIGHT * match_mult, 0.0, 3.0), 4),
        "FEED_MATCH_GRAD_YEAR_WEIGHT": round(clamp(settings.FEED_MATCH_GRAD_YEAR_WEIGHT * match_mult, 0.0, 4.0), 4),
        "FEED_MATCH_POSITION_WEIGHT": round(clamp(settings.FEED_MATCH_POSITION_WEIGHT * match_mult, 0.0, 4.0), 4),
        "FEED_MATCH_GEO_WEIGHT": round(clamp(settings.FEED_MATCH_GEO_WEIGHT * match_mult, 0.0, 3.0), 4),
        "FEED_EXPLORATION_BOOST": round(clamp(settings.FEED_EXPLORATION_BOOST * exploration_mult, 0.0, 2.0), 4),
        "FEED_DIVERSITY_IMPRESSION_WEIGHT": round(
            clamp(settings.FEED_DIVERSITY_IMPRESSION_WEIGHT * diversity_mult, 0.01, 2.0), 4
        ),
        "FEED_NEGATIVE_HIDE_WEIGHT": round(
            clamp(settings.FEED_NEGATIVE_HIDE_WEIGHT * negative_mult, 0.1, 6.0), 4
        ),
        "FEED_NEGATIVE_REPORT_WEIGHT": round(
            clamp(settings.FEED_NEGATIVE_REPORT_WEIGHT * negative_mult, 0.1, 10.0), 4
        ),
    }


def write_env_updates(env_path: Path, updates: dict[str, float]) -> tuple[Path, Path]:
    env_path = env_path.expanduser().resolve()
    if not env_path.exists():
        raise FileNotFoundError(f"Env file not found: {env_path}")

    backup_path = env_path.with_suffix(env_path.suffix + ".bak")
    backup_path.write_text(env_path.read_text(), encoding="utf-8")

    lines = env_path.read_text(encoding="utf-8").splitlines()
    key_to_value = {k: str(v) for k, v in updates.items()}
    seen: set[str] = set()
    out_lines: list[str] = []

    for line in lines:
        if "=" not in line or line.strip().startswith("#"):
            out_lines.append(line)
            continue
        key, _ = line.split("=", 1)
        key = key.strip()
        if key in key_to_value:
            out_lines.append(f"{key}={key_to_value[key]}")
            seen.add(key)
        else:
            out_lines.append(line)

    for key, value in key_to_value.items():
        if key not in seen:
            out_lines.append(f"{key}={value}")

    env_path.write_text("\n".join(out_lines) + "\n", encoding="utf-8")
    return env_path, backup_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Offline feed weight tuning from feed_events.")
    parser.add_argument("--days", type=int, default=7, help="Lookback window in days (default: 7)")
    parser.add_argument(
        "--viewer-user-id",
        type=int,
        default=None,
        help="Optional viewer filter; omit to aggregate across all viewers.",
    )
    parser.add_argument(
        "--write-env",
        action="store_true",
        help="Write recommended FEED_* values into an env file (with backup).",
    )
    parser.add_argument(
        "--env-file",
        type=str,
        default=str(Path(__file__).resolve().parents[2] / ".env"),
        help="Target env file for --write-env (default: repo .env).",
    )
    parser.add_argument(
        "--base-step",
        type=float,
        default=0.03,
        help="Default max relative change per run (default: 0.03 => 3%%).",
    )
    parser.add_argument(
        "--max-step",
        type=float,
        default=0.05,
        help="High-confidence max relative change per run (default: 0.05 => 5%%).",
    )
    parser.add_argument(
        "--high-conf-threshold",
        type=float,
        default=0.15,
        help="Absolute correlation threshold to allow --max-step (default: 0.15).",
    )
    parser.add_argument(
        "--min-write-samples",
        type=int,
        default=1000,
        help="Minimum impression samples required before --write-env applies (default: 1000).",
    )
    args = parser.parse_args()

    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                WITH impressions AS (
                    SELECT
                        fe.viewer_user_id,
                        fe.post_id,
                        fe.created_at AS impression_at,
                        COALESCE((fe.metadata->'score_breakdown'->>'recency')::double precision, 0.0) AS recency,
                        COALESCE((fe.metadata->'score_breakdown'->>'social')::double precision, 0.0) AS social,
                        COALESCE((fe.metadata->'score_breakdown'->>'match')::double precision, 0.0) AS match,
                        COALESCE((fe.metadata->'score_breakdown'->>'exploration_boost')::double precision, 0.0) AS exploration_boost,
                        COALESCE((fe.metadata->'score_breakdown'->>'diversity_penalty')::double precision, 0.0) AS diversity_penalty,
                        COALESCE((fe.metadata->'score_breakdown'->>'negative_feedback_penalty')::double precision, 0.0) AS negative_feedback_penalty
                    FROM public.feed_events fe
                    WHERE fe.event_type = 'impression'
                      AND fe.created_at >= now() - make_interval(days => :days)
                      AND (CAST(:viewer_user_id AS int) IS NULL OR fe.viewer_user_id = CAST(:viewer_user_id AS int))
                )
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
                """
            ),
            {"days": args.days, "viewer_user_id": args.viewer_user_id},
        ).mappings().all()

        if not rows:
            print("No impression data found for requested window/filter.")
            return

        engagement_scores: list[float] = []
        components: dict[str, list[float]] = {
            "recency": [],
            "social": [],
            "match": [],
            "exploration_boost": [],
            "diversity_penalty": [],
            "negative_feedback_penalty": [],
        }

        positives = 0
        negatives = 0
        for row in rows:
            did_view_3s = bool(row["did_view_3s"])
            did_like = bool(row["did_like"])
            did_save = bool(row["did_save"])
            did_hide = bool(row["did_hide"])
            did_report = bool(row["did_report"])

            engagement = (
                (1.0 if did_view_3s else 0.0)
                + (2.0 if did_like else 0.0)
                + (3.0 if did_save else 0.0)
                - (2.0 if did_hide else 0.0)
                - (4.0 if did_report else 0.0)
            )
            engagement_scores.append(engagement)
            positives += int(did_view_3s or did_like or did_save)
            negatives += int(did_hide or did_report)

            for key in components:
                components[key].append(float(row[key] or 0.0))

        correlations = {k: pearson(v, engagement_scores) for k, v in components.items()}
        recommendations = compute_recommendations(
            correlations,
            base_step=args.base_step,
            max_step=args.max_step,
            high_conf_threshold=args.high_conf_threshold,
        )

        output: dict[str, Any] = {
            "window_days": args.days,
            "viewer_user_id": args.viewer_user_id,
            "sample_size": len(rows),
            "positive_rate": round(positives / len(rows), 4),
            "negative_rate": round(negatives / len(rows), 4),
            "component_outcome_correlations": {k: round(v, 4) for k, v in correlations.items()},
            "recommended_env": recommendations,
            "tuning_params": {
                "base_step": args.base_step,
                "max_step": args.max_step,
                "high_conf_threshold": args.high_conf_threshold,
                "min_write_samples": args.min_write_samples,
            },
        }

        print(json.dumps(output, indent=2))
        print("\n# Suggested .env overrides")
        for key, value in recommendations.items():
            print(f"{key}={value}")

        if args.write_env:
            if len(rows) < args.min_write_samples:
                print(
                    f"\nSkipped writing env: sample_size={len(rows)} is below min_write_samples={args.min_write_samples}."
                )
                return
            target_path, backup_path = write_env_updates(Path(args.env_file), recommendations)
            print(f"\nWrote recommended values to: {target_path}")
            print(f"Backup created at: {backup_path}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
