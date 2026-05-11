from __future__ import annotations

import argparse
import csv
import json
import random
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal

KIND_BY_SUFFIX: dict[str, str] = {
    ".mp4": "video",
    ".mov": "video",
    ".m4v": "video",
    ".jpg": "image",
    ".jpeg": "image",
    ".png": "image",
    ".webp": "image",
}

MIME_BY_SUFFIX: dict[str, str] = {
    ".mp4": "video/mp4",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


@dataclass(frozen=True)
class AthleteTarget:
    user_id: int
    email: str
    sport: str | None


@dataclass(frozen=True)
class ManifestRecord:
    athlete_user_id: int | None
    athlete_email: str | None
    caption: str | None
    sport: str | None
    tags: list[str]


def _safe_filename(name: str) -> str:
    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", name.strip())
    return cleaned[:120] or "upload.bin"


def _build_caption(path: Path, prefix: str) -> str:
    stem = re.sub(r"[_-]+", " ", path.stem).strip()
    if not stem:
        stem = "highlight clip"
    caption = f"{prefix.strip()} {stem}".strip()
    return caption[:280]


def _normalize_tags(raw_tags: list[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for raw in raw_tags:
        cleaned = raw.strip().lower().lstrip("#")
        cleaned = re.sub(r"[^a-z0-9_]+", "-", cleaned).strip("-")
        if not cleaned:
            continue
        if cleaned in seen:
            continue
        seen.add(cleaned)
        out.append(cleaned[:50])
    return out[:12]


def _extract_manifest_rows(payload: Any) -> list[dict[str, Any]]:
    if isinstance(payload, list):
        return [row for row in payload if isinstance(row, dict)]
    if isinstance(payload, dict):
        if isinstance(payload.get("items"), list):
            return [row for row in payload["items"] if isinstance(row, dict)]
        if isinstance(payload.get("files"), list):
            return [row for row in payload["files"] if isinstance(row, dict)]
        return [payload]
    return []


def _coerce_manifest_record(raw: dict[str, Any]) -> ManifestRecord | None:
    norm = {str(k).strip().lower(): v for k, v in raw.items()}

    filename_raw = norm.get("filename") or norm.get("file") or norm.get("name")
    if not filename_raw:
        return None

    athlete_user_id = None
    if norm.get("athlete_user_id") not in (None, ""):
        try:
            athlete_user_id = int(norm["athlete_user_id"])
        except (TypeError, ValueError):
            athlete_user_id = None

    athlete_email_raw = norm.get("athlete_email") or norm.get("email")
    athlete_email = (
        str(athlete_email_raw).strip().lower() if athlete_email_raw not in (None, "") else None
    )

    caption_raw = norm.get("caption") or norm.get("post_title") or norm.get("title")
    caption = str(caption_raw).strip() if caption_raw not in (None, "") else None

    sport_raw = norm.get("sport")
    sport = str(sport_raw).strip().lower() if sport_raw not in (None, "") else None

    tags_raw = norm.get("tags")
    tag_list: list[str] = []
    if isinstance(tags_raw, str):
        tag_list = re.split(r"[,\|]", tags_raw)
    elif isinstance(tags_raw, list):
        tag_list = [str(x) for x in tags_raw]

    return ManifestRecord(
        athlete_user_id=athlete_user_id,
        athlete_email=athlete_email,
        caption=caption,
        sport=sport,
        tags=_normalize_tags(tag_list),
    )


def _load_manifest(manifest_path: Path | None) -> dict[str, ManifestRecord]:
    if manifest_path is None:
        return {}

    if not manifest_path.exists() or not manifest_path.is_file():
        raise FileNotFoundError(f"Manifest not found: {manifest_path}")

    suffix = manifest_path.suffix.lower()
    out: dict[str, ManifestRecord] = {}

    if suffix == ".csv":
        with manifest_path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for row in reader:
                record = _coerce_manifest_record(row)
                if not record:
                    continue
                norm = {str(k).strip().lower(): v for k, v in row.items()}
                key = Path(str(norm.get("filename") or norm.get("file") or norm.get("name"))).name.lower()
                out[key] = record
        return out

    if suffix in {".json", ".jsonl"}:
        if suffix == ".jsonl":
            with manifest_path.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    raw = json.loads(line)
                    if not isinstance(raw, dict):
                        continue
                    record = _coerce_manifest_record(raw)
                    if not record:
                        continue
                    norm = {str(k).strip().lower(): v for k, v in raw.items()}
                    filename_raw = norm.get("filename") or norm.get("file") or norm.get("name")
                    key = Path(str(filename_raw)).name.lower()
                    out[key] = record
            return out

        payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        for raw in _extract_manifest_rows(payload):
            record = _coerce_manifest_record(raw)
            if not record:
                continue
            norm = {str(k).strip().lower(): v for k, v in raw.items()}
            filename_raw = norm.get("filename") or norm.get("file") or norm.get("name")
            key = Path(str(filename_raw)).name.lower()
            out[key] = record
        return out

    raise ValueError(f"Unsupported manifest format: {manifest_path.suffix}")


def _load_athletes(email_like: str | None) -> list[AthleteTarget]:
    db = SessionLocal()
    try:
        rows = db.execute(
            text(
                """
                SELECT
                  u.id AS user_id,
                  u.email,
                  ap.sport
                FROM public.users u
                JOIN public.user_roles ur ON ur.user_id = u.id
                JOIN public.roles r ON r.id = ur.role_id
                LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
                WHERE r.key = 'athlete'
                  AND (CAST(:email_like AS text) IS NULL OR u.email ILIKE CAST(:email_like AS text))
                ORDER BY u.id ASC
                """
            ),
            {"email_like": email_like},
        ).mappings().all()

        return [
            AthleteTarget(
                user_id=int(r["user_id"]),
                email=str(r["email"]),
                sport=(str(r["sport"]).strip().lower() if r["sport"] else None),
            )
            for r in rows
        ]
    finally:
        db.close()


def _collect_media_files(input_dir: Path) -> list[Path]:
    files: list[Path] = []
    for path in input_dir.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in KIND_BY_SUFFIX:
            continue
        files.append(path)
    files.sort()
    return files


def _insert_post(db, *, author_user_id: int, sport: str, caption: str) -> int:
    return int(
        db.execute(
            text(
                """
                INSERT INTO public.posts (author_user_id, sport, caption, visibility)
                VALUES (:author_user_id, :sport, :caption, 'public')
                RETURNING id
                """
            ),
            {
                "author_user_id": author_user_id,
                "sport": sport,
                "caption": caption,
            },
        ).scalar_one()
    )


def _upsert_post_tags(db, *, post_id: int, tags: list[str]) -> int:
    if not tags:
        return 0
    links = 0
    for slug in _normalize_tags(tags):
        tag_id = int(
            db.execute(
                text(
                    """
                    INSERT INTO public.tags (slug, display_name)
                    VALUES (:slug, :display_name)
                    ON CONFLICT (slug) DO UPDATE
                    SET display_name = EXCLUDED.display_name
                    RETURNING id
                    """
                ),
                {"slug": slug, "display_name": slug},
            ).scalar_one()
        )
        db.execute(
            text(
                """
                INSERT INTO public.post_tags (post_id, tag_id)
                VALUES (:post_id, :tag_id)
                ON CONFLICT DO NOTHING
                """
            ),
            {"post_id": post_id, "tag_id": tag_id},
        )
        links += 1
    return links


def _insert_media_asset(
    db,
    *,
    owner_user_id: int,
    post_id: int | None,
    kind: str,
    storage_key: str,
    mime_type: str,
    byte_size: int,
    api_base_url: str,
) -> int:
    media_row = db.execute(
        text(
            """
            INSERT INTO public.media_assets
              (owner_user_id, post_id, kind, provider, status, storage_key, mime_type, byte_size, meta)
            VALUES
              (:owner_user_id, :post_id, :kind, 'local', 'ready', :storage_key, :mime_type, :byte_size, '{}'::jsonb)
            RETURNING id, public_id::text AS public_id
            """
        ),
        {
            "owner_user_id": owner_user_id,
            "post_id": post_id,
            "kind": kind,
            "storage_key": storage_key,
            "mime_type": mime_type,
            "byte_size": byte_size,
        },
    ).mappings().one()

    media_id = int(media_row["id"])
    public_id = str(media_row["public_id"])
    public_url = f"{api_base_url}/api/v1/uploads/media/{public_id}"

    db.execute(
        text(
            """
            UPDATE public.media_assets
            SET public_url = :public_url,
                updated_at = now()
            WHERE id = :media_id
            """
        ),
        {"public_url": public_url, "media_id": media_id},
    )
    return media_id


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Import local sample media files (.mp4/.jpg/etc), auto-assign them to athletes, "
            "and create posts + media assets."
        )
    )
    parser.add_argument(
        "--input-dir",
        default="../data/sample_media",
        help="Folder containing media files to import (recursive).",
    )
    parser.add_argument(
        "--manifest",
        default=None,
        help=(
            "Optional CSV/JSON/JSONL metadata manifest keyed by filename. "
            "Supports fields: filename, athlete_user_id/athlete_email, caption/title, sport, tags."
        ),
    )
    parser.add_argument(
        "--api-base-url",
        default="http://localhost:8001",
        help="Base API URL used to build media public_url values.",
    )
    parser.add_argument(
        "--athlete-email-like",
        default=None,
        help="Optional athlete email filter (ILIKE pattern), e.g. '%%@synthetic.recruitr.test'.",
    )
    parser.add_argument(
        "--default-sport",
        default="soccer",
        help="Sport fallback if athlete profile has no sport.",
    )
    parser.add_argument(
        "--caption-prefix",
        default="New highlight:",
        help="Caption prefix for created posts.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Optional max number of files to import (0 = all).",
    )
    parser.add_argument(
        "--shuffle-athletes",
        action="store_true",
        help="Shuffle athlete assignment order before round-robin.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed used when --shuffle-athletes is enabled.",
    )
    parser.add_argument(
        "--no-posts",
        action="store_true",
        help="Import media assets only (do not create posts).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview assignments without writing files/DB rows.",
    )
    parser.add_argument(
        "--stop-on-error",
        action="store_true",
        help="Stop immediately on first failed file (default continues).",
    )
    args = parser.parse_args()

    input_dir = Path(args.input_dir).expanduser().resolve()
    if not input_dir.exists() or not input_dir.is_dir():
        raise FileNotFoundError(f"Input directory not found: {input_dir}")

    media_files = _collect_media_files(input_dir)
    if args.limit and args.limit > 0:
        media_files = media_files[: args.limit]
    if not media_files:
        print(f"No supported media files found in {input_dir}")
        return

    email_like = args.athlete_email_like.strip() if args.athlete_email_like else None
    athletes = _load_athletes(email_like=email_like)
    if not athletes:
        raise RuntimeError("No athlete users found for import assignment.")

    manifest_path = Path(args.manifest).expanduser().resolve() if args.manifest else None
    manifest_map = _load_manifest(manifest_path)

    if args.shuffle_athletes:
        random.seed(args.seed)
        athletes = list(athletes)
        random.shuffle(athletes)

    athlete_by_id = {a.user_id: a for a in athletes}
    athlete_by_email = {a.email.lower(): a for a in athletes}

    api_base_url = args.api_base_url.rstrip("/")
    uploads_root = Path(settings.LOCAL_UPLOAD_DIR).expanduser().resolve()

    if args.dry_run:
        print("DRY RUN")
        print(f"input_dir={input_dir}")
        print(f"files={len(media_files)}")
        print(f"athletes={len(athletes)}")
        print(f"manifest_rows={len(manifest_map)}")
        print(f"posts={'no' if args.no_posts else 'yes'}")
        for idx, file_path in enumerate(media_files, start=1):
            record = manifest_map.get(file_path.name.lower())
            athlete = athletes[(idx - 1) % len(athletes)]
            if record and record.athlete_user_id:
                athlete = athlete_by_id.get(record.athlete_user_id, athlete)
            elif record and record.athlete_email:
                athlete = athlete_by_email.get(record.athlete_email, athlete)
            kind = KIND_BY_SUFFIX[file_path.suffix.lower()]
            sport = (
                (record.sport if record and record.sport else athlete.sport or args.default_sport)
                .strip()
                .lower()
            )
            caption = record.caption if record and record.caption else _build_caption(file_path, args.caption_prefix)
            tags = record.tags if record else []
            print(
                f"[{idx}] {file_path.name} -> athlete_id={athlete.user_id} "
                f"email={athlete.email} kind={kind} sport={sport} "
                f"caption='{caption[:60]}' tags={tags}"
            )
        return

    db = SessionLocal()
    created_posts = 0
    created_media_assets = 0
    created_tag_links = 0
    copied_files = 0
    failures: list[str] = []

    try:
        for idx, file_path in enumerate(media_files, start=1):
            athlete = athletes[(idx - 1) % len(athletes)]
            record = manifest_map.get(file_path.name.lower())
            if record and record.athlete_user_id:
                mapped = athlete_by_id.get(record.athlete_user_id)
                if not mapped:
                    msg = (
                        f"{file_path}: manifest athlete_user_id={record.athlete_user_id} "
                        "not found in selected athlete pool"
                    )
                    failures.append(msg)
                    print(f"[{idx}/{len(media_files)}] FAILED {msg}")
                    if args.stop_on_error:
                        break
                    continue
                athlete = mapped
            elif record and record.athlete_email:
                mapped = athlete_by_email.get(record.athlete_email.lower())
                if not mapped:
                    msg = (
                        f"{file_path}: manifest athlete_email={record.athlete_email} "
                        "not found in selected athlete pool"
                    )
                    failures.append(msg)
                    print(f"[{idx}/{len(media_files)}] FAILED {msg}")
                    if args.stop_on_error:
                        break
                    continue
                athlete = mapped

            suffix = file_path.suffix.lower()
            kind = KIND_BY_SUFFIX[suffix]
            mime_type = MIME_BY_SUFFIX.get(suffix, "application/octet-stream")
            sport = (
                (record.sport if record and record.sport else athlete.sport or args.default_sport)
                .strip()
                .lower()
                or "soccer"
            )
            caption = record.caption if record and record.caption else _build_caption(file_path, args.caption_prefix)
            tags = record.tags if record else []

            owner_dir = uploads_root / str(athlete.user_id)
            owner_dir.mkdir(parents=True, exist_ok=True)

            dest_name = f"import_{uuid4().hex[:12]}_{_safe_filename(file_path.name)}"
            dest_path = owner_dir / dest_name
            shutil.copy2(file_path, dest_path)
            byte_size = dest_path.stat().st_size

            try:
                post_id: int | None = None
                if not args.no_posts:
                    post_id = _insert_post(
                        db,
                        author_user_id=athlete.user_id,
                        sport=sport,
                        caption=caption,
                    )
                    created_tag_links += _upsert_post_tags(db, post_id=post_id, tags=tags)
                    created_posts += 1

                _insert_media_asset(
                    db,
                    owner_user_id=athlete.user_id,
                    post_id=post_id,
                    kind=kind,
                    storage_key=str(dest_path),
                    mime_type=mime_type,
                    byte_size=byte_size,
                    api_base_url=api_base_url,
                )

                db.commit()
                copied_files += 1
                created_media_assets += 1
                print(
                    f"[{idx}/{len(media_files)}] imported {file_path.name} "
                    f"-> athlete_id={athlete.user_id} kind={kind} "
                    f"tags={len(tags)}"
                )
            except Exception as exc:
                db.rollback()
                try:
                    if dest_path.exists():
                        dest_path.unlink()
                except Exception:
                    pass
                msg = f"{file_path}: {exc}"
                failures.append(msg)
                print(f"[{idx}/{len(media_files)}] FAILED {msg}")
                if args.stop_on_error:
                    break
    finally:
        db.close()

    print("")
    print("Import complete.")
    print(f"Copied files: {copied_files}")
    print(f"Created media assets: {created_media_assets}")
    print(f"Created posts: {created_posts}")
    print(f"Created post tag links: {created_tag_links}")
    print(f"Failures: {len(failures)}")
    if failures:
        print("Failure samples:")
        for line in failures[:10]:
            print(f" - {line}")


if __name__ == "__main__":
    main()
