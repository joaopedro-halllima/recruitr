#!/usr/bin/env python3
"""
Build a list of EVERY 2-year + 4-year college in the U.S. Census "Northeast"
(CT, ME, MA, NH, RI, VT, NJ, NY, PA) from NCES IPEDS Directory (HD) data.

Outputs a CSV suitable for importing into Recruitr.

USAGE:
  pip install pandas requests
  python build_northeast_ipeds_schools.py --year 2024

If NCES is down, download the zip manually later and run:
  python build_northeast_ipeds_schools.py --zip HD2024_Data_Stata.zip

Or if you already extracted the CSV:
  python build_northeast_ipeds_schools.py --csv hd2024_data_stata.csv
"""

from __future__ import annotations

import argparse
import io
import sys
import zipfile
from urllib.parse import urlparse

import pandas as pd
import requests


# U.S. Census "Northeast" region states
NE_STATES = {"CT", "ME", "MA", "NH", "RI", "VT", "NJ", "NY", "PA"}


def eprint(*args, **kwargs):
    print(*args, file=sys.stderr, **kwargs)


def normalize_webaddr(webaddr: str | None) -> str | None:
    if not webaddr or not isinstance(webaddr, str):
        return None
    w = webaddr.strip()
    if not w:
        return None
    # IPEDS sometimes stores without scheme
    if not w.startswith(("http://", "https://")):
        w = "https://" + w
    return w


def domain_from_webaddr(webaddr: str | None) -> str | None:
    w = normalize_webaddr(webaddr)
    if not w:
        return None
    try:
        netloc = urlparse(w).netloc.lower()
        if netloc.startswith("www."):
            netloc = netloc[4:]
        return netloc or None
    except Exception:
        return None


def clearbit_logo_url(domain: str | None) -> str | None:
    if not domain:
        return None
    return f"https://logo.clearbit.com/{domain}"


def download_ipeds_hd_zip(year: int) -> bytes:
    """
    Tries a couple common IPEDS Data Center direct-download filenames.
    """
    # Common patterns seen in IPEDS Data Center "Complete Data Files"
    candidates = [
        f"https://nces.ed.gov/ipeds/datacenter/data/HD{year}_Data_Stata.zip",
        f"https://nces.ed.gov/ipeds/datacenter/data/HD{year}_Data.zip",
    ]

    last_err = None
    for url in candidates:
        try:
            eprint(f"Downloading: {url}")
            r = requests.get(url, timeout=120)
            r.raise_for_status()
            return r.content
        except Exception as exc:
            last_err = exc
            eprint(f"  -> failed: {exc}")
    raise RuntimeError(
        f"Could not download IPEDS HD zip for year {year}. "
        f"NCES may be temporarily down. Try again later, or download manually and use --zip.\n"
        f"Last error: {last_err}"
    )


def extract_csv_from_zip(zip_bytes: bytes) -> tuple[str, bytes]:
    with zipfile.ZipFile(io.BytesIO(zip_bytes), "r") as z:
        names = z.namelist()

        # Prefer the Stata-export CSV naming, but fall back to any CSV
        preferred = [n for n in names if n.lower().endswith("_data_stata.csv")]
        any_csv = [n for n in names if n.lower().endswith(".csv")]

        if preferred:
            preferred.sort(key=lambda s: (0 if s.lower().startswith("hd") else 1, len(s)))
            fname = preferred[0]
        elif any_csv:
            any_csv.sort(key=len)
            fname = any_csv[0]
        else:
            raise RuntimeError(f"No CSV found inside zip. First files: {names[:25]}")

        return fname, z.read(fname)


def load_dataframe_from_sources(year: int, zip_path: str | None, csv_path: str | None) -> pd.DataFrame:
    if csv_path:
        eprint(f"Reading local CSV: {csv_path}")
        return pd.read_csv(csv_path, dtype=str, low_memory=False)

    if zip_path:
        eprint(f"Reading local ZIP: {zip_path}")
        with open(zip_path, "rb") as f:
            zip_bytes = f.read()
        fname, csv_bytes = extract_csv_from_zip(zip_bytes)
        eprint(f"Found CSV inside zip: {fname}")
        return pd.read_csv(io.BytesIO(csv_bytes), dtype=str, low_memory=False)

    # Default: download from NCES
    zip_bytes = download_ipeds_hd_zip(year)
    fname, csv_bytes = extract_csv_from_zip(zip_bytes)
    eprint(f"Found CSV inside zip: {fname}")
    return pd.read_csv(io.BytesIO(csv_bytes), dtype=str, low_memory=False)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--year", type=int, default=2024, help="IPEDS HD year, e.g. 2024")
    ap.add_argument("--out", type=str, default="", help="Output CSV path")
    ap.add_argument("--zip", type=str, default="", help="Path to a downloaded IPEDS HD zip (optional)")
    ap.add_argument("--csv", type=str, default="", help="Path to an extracted IPEDS HD CSV (optional)")
    ap.add_argument(
        "--states",
        type=str,
        default=",".join(sorted(NE_STATES)),
        help="Comma-separated state abbreviations to include (default = Northeast region states)",
    )
    ap.add_argument(
        "--levels",
        type=str,
        default="1,2",
        help="Comma-separated ICLEVELs to include (default 1,2 = 4-year and 2-year)",
    )
    args = ap.parse_args()

    out_path = args.out or f"northeast_schools_hd{args.year}.csv"
    states = {s.strip().upper() for s in args.states.split(",") if s.strip()}
    levels = {int(x.strip()) for x in args.levels.split(",") if x.strip()}

    df = load_dataframe_from_sources(args.year, args.zip or None, args.csv or None)

    # Normalize column names
    df.columns = [c.strip().lower() for c in df.columns]

    # Columns we expect from HD Directory
    required = ["unitid", "instnm", "city", "stabbr", "zip", "addr", "webaddr", "control", "iclevel"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise RuntimeError(
            f"Missing expected columns: {missing}\n"
            f"Available columns (first 60): {list(df.columns)[:60]}"
        )

    # Filter to region + institution level
    df["stabbr"] = df["stabbr"].astype(str).str.upper().str.strip()
    df = df[df["stabbr"].isin(states)].copy()

    df["iclevel"] = pd.to_numeric(df["iclevel"], errors="coerce").astype("Int64")
    df = df[df["iclevel"].isin(list(levels))].copy()

    df["control"] = pd.to_numeric(df["control"], errors="coerce").astype("Int64")

    # Derived fields for Recruitr
    df["institution_level"] = df["iclevel"].map({1: "4-year", 2: "2-year"}).fillna("unknown")
    df["is_public"] = df["control"] == 1
    df["is_community_college"] = (df["is_public"]) & (df["institution_level"] == "2-year")

    df["webaddr"] = df["webaddr"].apply(normalize_webaddr)
    df["domain"] = df["webaddr"].apply(domain_from_webaddr)
    df["logo_clearbit_url"] = df["domain"].apply(clearbit_logo_url)

    # Optional convenience (UI fallback)
    df["name_mentions_community_college"] = df["instnm"].str.contains("community college", case=False, na=False)

    # Final output columns (stable, import-friendly)
    out_cols = [
        "unitid",
        "instnm",
        "addr",
        "city",
        "stabbr",
        "zip",
        "webaddr",
        "domain",
        "logo_clearbit_url",
        "control",
        "iclevel",
        "institution_level",
        "is_public",
        "is_community_college",
        "name_mentions_community_college",
    ]
    df_out = df[out_cols].drop_duplicates(subset=["unitid"]).copy()

    df_out.to_csv(out_path, index=False)
    eprint(f"Wrote {len(df_out):,} schools to: {out_path}")

    # Quick sanity check to avoid the "only 3 schools" problem
    eprint("Sanity check (first 10):")
    eprint(df_out[["unitid", "instnm", "city", "stabbr", "institution_level"]].head(10).to_string(index=False))

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
