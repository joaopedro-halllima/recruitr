from __future__ import annotations

import argparse
import csv
from pathlib import Path

from sqlalchemy import text

from app.db.session import SessionLocal


def _pick(row: dict[str, str], *keys: str) -> str | None:
    for key in keys:
        val = row.get(key.lower())
        if val is not None and str(val).strip() != "":
            return str(val).strip()
    return None


def _parse_float(value: str | None) -> float | None:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except ValueError:
        return None


def _parse_bool(value: str | None) -> bool | None:
    if value is None:
        return None
    normalized = value.strip().lower()
    if normalized in {"1", "true", "t", "yes", "y"}:
        return True
    if normalized in {"0", "false", "f", "no", "n"}:
        return False
    return None


def _is_community_college(name: str | None, iclevel: str | None, explicit: bool | None) -> bool:
    if explicit is not None:
        return explicit
    level = (iclevel or "").strip().lower()
    school_name = (name or "").strip().lower()
    if "2-year" in level or "2 year" in level:
        return True
    if "associate" in level:
        return True
    if "community college" in school_name:
        return True
    return False


def _normalize_row(raw_row: dict[str, str]) -> dict | None:
    row = {str(k).strip().lower(): (str(v).strip() if v is not None else "") for k, v in raw_row.items()}

    unitid = _pick(row, "unitid", "opeid", "id")
    name = _pick(row, "name", "instnm", "institution_name")
    if not unitid or not name:
        return None

    addr = _pick(row, "addr", "address")
    city = _pick(row, "city")
    state = _pick(row, "state", "stabbr")
    zip_code = _pick(row, "zip", "zip_code")
    webaddr = _pick(row, "webaddr", "web_addr", "website", "url")
    latitude = _parse_float(_pick(row, "latitude", "lat"))
    longitud = _parse_float(_pick(row, "longitud", "longitude", "lon", "lng"))
    iclevel = _pick(row, "iclevel", "institution_level")
    control = _pick(row, "control")
    logo_url = _pick(row, "logo_url", "logo_clearbit_url", "logo")
    explicit_cc = _parse_bool(_pick(row, "is_community_college", "community_college"))

    return {
        "unitid": unitid,
        "name": name,
        "addr": addr,
        "city": city,
        "state": state,
        "zip": zip_code,
        "webaddr": webaddr,
        "latitude": latitude,
        "longitud": longitud,
        "iclevel": iclevel,
        "control": control,
        "is_community_college": _is_community_college(name, iclevel, explicit_cc),
        "logo_url": logo_url,
    }


def import_csv(csv_path: Path, batch_size: int = 1000) -> tuple[int, int]:
    if not csv_path.exists():
        raise FileNotFoundError(f"CSV not found: {csv_path}")

    db = SessionLocal()
    upsert_sql = text(
        """
        INSERT INTO public.schools
          (unitid, name, addr, city, state, zip, webaddr, latitude, longitud, iclevel, control, is_community_college, logo_url)
        VALUES
          (:unitid, :name, :addr, :city, :state, :zip, :webaddr, :latitude, :longitud, :iclevel, :control, :is_community_college, :logo_url)
        ON CONFLICT (unitid)
        DO UPDATE SET
          name = EXCLUDED.name,
          addr = EXCLUDED.addr,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          zip = EXCLUDED.zip,
          webaddr = EXCLUDED.webaddr,
          latitude = EXCLUDED.latitude,
          longitud = EXCLUDED.longitud,
          iclevel = EXCLUDED.iclevel,
          control = EXCLUDED.control,
          is_community_college = EXCLUDED.is_community_college,
          logo_url = EXCLUDED.logo_url,
          updated_at = now()
        """
    )

    rows_buffer: list[dict] = []
    processed = 0
    skipped = 0
    try:
        with csv_path.open("r", encoding="utf-8", newline="") as f:
            reader = csv.DictReader(f)
            for raw in reader:
                normalized = _normalize_row(raw)
                if not normalized:
                    skipped += 1
                    continue
                rows_buffer.append(normalized)
                processed += 1
                if len(rows_buffer) >= batch_size:
                    db.execute(upsert_sql, rows_buffer)
                    rows_buffer.clear()

            if rows_buffer:
                db.execute(upsert_sql, rows_buffer)

        db.commit()
        return processed, skipped
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import or upsert schools from CSV")
    parser.add_argument(
        "--csv",
        required=True,
        help="Path to CSV file (e.g. data/eastern_colleges_cc_hd2024.csv)",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=1000,
        help="Number of rows per upsert batch",
    )
    args = parser.parse_args()

    csv_path = Path(args.csv).expanduser().resolve()
    processed, skipped = import_csv(csv_path, batch_size=args.batch_size)
    print(f"Schools import complete. processed={processed} skipped={skipped} file={csv_path}")


if __name__ == "__main__":
    main()
