from __future__ import annotations
 
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session
 
from app.api.routes.auth import get_current_user
from app.core.config import settings
from app.db.deps import get_db
from app.models.user import User
from app.search_index import reindex_all
from app.services.meili import MeiliError, search_index
 
router = APIRouter(prefix="/api/v1", tags=["search"])
 
 
def _user_has_role(db: Session, user_id: int, role_key: str) -> bool:
    return bool(
        db.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM public.user_roles ur
                  JOIN public.roles r ON r.id = ur.role_id
                  WHERE ur.user_id = :user_id
                    AND r.key = :role_key
                )
                """
            ),
            {"user_id": user_id, "role_key": role_key},
        ).scalar()
    )
 
 
def _search_user_item_from_hit(raw: dict) -> dict | None:
    role = str(raw.get("role") or "").strip().lower()
    if role not in {"athlete", "coach"}:
        return None
 
    user_id_raw = raw.get("userId", raw.get("user_id", raw.get("id")))
    try:
        user_id = int(user_id_raw)
    except (TypeError, ValueError):
        return None
 
    email = raw.get("email")
    name = (raw.get("name") or email or f"User {user_id}").strip()
    sport_val = raw.get("sport")
    grad_year = raw.get("gradYear", raw.get("grad_year")) if role == "athlete" else None
    positions = raw.get("positions") if role == "athlete" else []
    positions = positions if isinstance(positions, list) else []
    state = raw.get("state") if role == "athlete" else None
    organization_name = raw.get("organizationName", raw.get("organization_name")) if role == "coach" else None
    level = raw.get("level") if role == "coach" else None
    school_name = raw.get("schoolName", raw.get("school_name"))
 
    meta = raw.get("meta")
    if not meta:
        meta_parts: list[str] = []
        if role == "athlete" and grad_year:
            meta_parts.append(f"Class of {grad_year}")
        if sport_val:
            meta_parts.append(str(sport_val).capitalize())
        if role == "athlete" and state:
            meta_parts.append(str(state))
        if school_name:
            meta_parts.append(str(school_name))
        if role == "coach" and organization_name:
            meta_parts.append(str(organization_name))
        if role == "coach" and level:
            meta_parts.append(str(level))
        meta = " • ".join(meta_parts)
 
    return {
        "userId": user_id,
        "email": email,
        "role": role,
        "name": name,
        "sport": sport_val,
        "gradYear": grad_year if role == "athlete" else None,
        "positions": positions if role == "athlete" else [],
        "state": state if role == "athlete" else None,
        "organizationName": organization_name if role == "coach" else None,
        "level": level if role == "coach" else None,
        "schoolName": school_name,
        "meta": meta or "",
    }
 
 
@router.post("/search/reindex")
def reindex_search(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_admin = _user_has_role(db, current_user.id, "admin")
    if settings.ENV != "dev" and not is_admin:
        raise HTTPException(status_code=403, detail="Only admin can trigger reindex outside dev")
    try:
        result = reindex_all()
    except MeiliError as exc:
        raise HTTPException(status_code=503, detail=f"Meili reindex failed: {exc}") from exc
    return {"ok": True, **result}
 
 
@router.get("/search/users")
def search_users(
    q: str = Query("", max_length=120),
    sport: str | None = Query(default=None),
    grad_year: int | None = Query(default=None, ge=2026, le=2045),
    position: str | None = Query(default=None),
    state: str | None = Query(default=None),
    role: str | None = Query(default=None, pattern="^(athlete|coach)$"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=10000),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Try Meili first (if indexed + reachable).
    meili_filters: list[str] = []
    if role:
        meili_filters.append(f'role = "{role}"')
    if sport:
        meili_filters.append(f'sport = "{sport.strip().lower()}"')
    if grad_year:
        meili_filters.append(f"grad_year = {grad_year}")
    if position:
        meili_filters.append(f'positions = "{position.strip().upper()}"')
    if state:
        meili_filters.append(f'state = "{state.strip().upper()}"')
    meili_hits = search_index(
        index_uid="users",
        query=q.strip(),
        limit=limit,
        offset=offset,
        filters=" AND ".join(meili_filters) if meili_filters else None,
    )
    if meili_hits is not None and len(meili_hits) > 0:
        items = []
        for hit in meili_hits:
            if isinstance(hit, dict):
                normalized = _search_user_item_from_hit(hit)
                if normalized:
                    items.append(normalized)
        if items:
            return {"source": "meili", "items": items}
 
    # SQL fallback (works immediately without indexing pipeline).
    pattern = f"%{q.strip()}%"
    rows = db.execute(
        text(
            """
            WITH roles_agg AS (
              SELECT ur.user_id, array_agg(r.key) AS roles
              FROM public.user_roles ur
              JOIN public.roles r ON r.id = ur.role_id
              GROUP BY ur.user_id
            )
            SELECT
              u.id AS user_id,
              u.email,
              ra.roles,
              ap.first_name AS athlete_first_name,
              ap.last_name AS athlete_last_name,
              ap.sport AS athlete_sport,
              ap.grad_year,
              ap.positions,
              ap.state AS athlete_state,
              cp.first_name AS coach_first_name,
              cp.last_name AS coach_last_name,
              cp.sport AS coach_sport,
              cp.organization_name,
              cp.level,
              aps.name AS athlete_school_name,
              cps.name AS coach_school_name
            FROM public.users u
            JOIN roles_agg ra ON ra.user_id = u.id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
            LEFT JOIN public.schools aps ON aps.unitid = ap.school_unitid
            LEFT JOIN public.schools cps ON cps.unitid = cp.school_unitid
            WHERE
              (
                :q = ''
                OR u.email ILIKE :pattern
                OR CONCAT_WS(' ', ap.first_name, ap.last_name) ILIKE :pattern
                OR CONCAT_WS(' ', cp.first_name, cp.last_name) ILIKE :pattern
                OR COALESCE(ap.high_school, '') ILIKE :pattern
                OR COALESCE(cp.organization_name, '') ILIKE :pattern
                OR COALESCE(aps.name, '') ILIKE :pattern
                OR COALESCE(cps.name, '') ILIKE :pattern
              )
              AND (CAST(:role AS text) IS NULL OR CAST(:role AS text) = ANY(ra.roles))
              AND (
                CAST(:sport AS text) IS NULL
                OR lower(COALESCE(ap.sport, cp.sport, '')) = lower(CAST(:sport AS text))
              )
              AND (CAST(:grad_year AS integer) IS NULL OR ap.grad_year = CAST(:grad_year AS integer))
              AND (
                CAST(:position AS text) IS NULL
                OR (ap.positions IS NOT NULL AND CAST(:position AS text) = ANY(ap.positions))
              )
              AND (
                CAST(:state AS text) IS NULL
                OR upper(COALESCE(ap.state, '')) = upper(CAST(:state AS text))
              )
            ORDER BY u.id DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "q": q.strip(),
            "pattern": pattern,
            "role": role,
            "sport": sport.strip().lower() if sport else None,
            "grad_year": grad_year,
            "position": position.strip().upper() if position else None,
            "state": state.strip().upper() if state else None,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()
 
    items = []
    for r in rows:
        roles = list(r["roles"] or [])
        is_athlete = "athlete" in roles
        first_name = r["athlete_first_name"] if is_athlete else r["coach_first_name"]
        last_name = r["athlete_last_name"] if is_athlete else r["coach_last_name"]
        sport_val = r["athlete_sport"] if is_athlete else r["coach_sport"]
        meta_parts = []
        if is_athlete and r["grad_year"]:
            meta_parts.append(f"Class of {r['grad_year']}")
        if sport_val:
            meta_parts.append(str(sport_val).capitalize())
        if is_athlete and r["athlete_state"]:
            meta_parts.append(r["athlete_state"])
        if is_athlete and r["athlete_school_name"]:
            meta_parts.append(r["athlete_school_name"])
        if (not is_athlete) and r["organization_name"]:
            meta_parts.append(r["organization_name"])
        if (not is_athlete) and r["coach_school_name"]:
            meta_parts.append(r["coach_school_name"])
        if (not is_athlete) and r["level"]:
            meta_parts.append(r["level"])
        items.append(
            {
                "userId": int(r["user_id"]),
                "email": r["email"],
                "role": "athlete" if is_athlete else "coach",
                "name": " ".join([p for p in [first_name, last_name] if p]).strip() or r["email"],
                "sport": sport_val,
                "gradYear": r["grad_year"] if is_athlete else None,
                "positions": r["positions"] if is_athlete else [],
                "state": r["athlete_state"] if is_athlete else None,
                "organizationName": r["organization_name"] if not is_athlete else None,
                "level": r["level"] if not is_athlete else None,
                "schoolName": r["athlete_school_name"] if is_athlete else r["coach_school_name"],
                "meta": " • ".join(meta_parts),
            }
        )
    return {"source": "sql", "items": items}
 
 
@router.get("/search/schools")
def search_schools(
    q: str = Query("", max_length=120),
    state: str | None = Query(default=None, max_length=24),
    level: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filters: list[str] = []
    if state:
        filters.append(f'state = "{state.strip().upper()}"')
    if level:
        filters.append(f'level = "{level.strip()}"')
 
    meili_hits = search_index(
        index_uid="schools",
        query=q.strip(),
        limit=limit,
        filters=" AND ".join(filters) if filters else None,
    )
    if meili_hits is not None and len(meili_hits) > 0:
        return {"source": "meili", "items": meili_hits}
 
    rows = db.execute(
        text(
            """
            SELECT
              s.unitid,
              s.name,
              s.city,
              s.state,
              s.website,
              s.logo_url,
              s.level,
              s.sector,
              s.conference
            FROM public.schools s
            WHERE
              (
                :q = ''
                OR s.name ILIKE :pattern
                OR similarity(s.name, :q) >= 0.12
              )
              AND (CAST(:state AS text) IS NULL OR upper(s.state) = upper(CAST(:state AS text)))
              AND (
                CAST(:level AS text) IS NULL
                OR lower(COALESCE(s.level, '')) = lower(CAST(:level AS text))
              )
            ORDER BY
              CASE WHEN :q = '' THEN 0 ELSE similarity(s.name, :q) END DESC,
              s.name ASC
            LIMIT :limit
            """
        ),
        {
            "q": q.strip(),
            "pattern": f"%{q.strip()}%",
            "state": state.strip() if state else None,
            "level": level.strip() if level else None,
            "limit": limit,
        },
    ).mappings().all()
    return {
        "source": "sql",
        "items": [
            {
                "unitid": r["unitid"],
                "name": r["name"],
                "city": r["city"],
                "state": r["state"],
                "website": r["website"],
                "logo_url": r["logo_url"],
                "level": r["level"],
                "sector": r["sector"],
                "conference": r["conference"],
            }
            for r in rows
        ],
    }
 
 
@router.get("/search/teams")
def search_teams(
    q: str = Query("", max_length=120),
    school_unitid: str | None = Query(default=None, max_length=16),
    school_name: str | None = Query(default=None, max_length=120),
    sport: str | None = Query(default=None, max_length=80),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meili_filters: list[str] = []
    if school_unitid:
        meili_filters.append(f'school_unitid = "{school_unitid.strip()}"')
    if school_name:
        meili_filters.append(f'school_name = "{school_name.strip()}"')
    if sport:
        meili_filters.append(f'sport = "{sport.strip().lower()}"')
    meili_hits = search_index(
        index_uid="teams",
        query=q.strip(),
        limit=limit,
        filters=" AND ".join(meili_filters) if meili_filters else None,
    )
    if meili_hits is not None and len(meili_hits) > 0:
        return {"source": "meili", "items": meili_hits}
 
    rows = db.execute(
        text(
            """
            SELECT
              t.id,
              t.team_name AS name,
              t.sport,
              t.school_unitid,
              s.name AS school_name,
              s.state AS school_state,
              (COUNT(tm.id) FILTER (WHERE tm.status = 'active'))::int AS active_member_count
            FROM public.teams t
            JOIN public.schools s ON s.unitid = t.school_unitid
            LEFT JOIN public.team_memberships tm ON tm.team_id = t.id
            WHERE
              (
                :q = ''
                OR t.team_name ILIKE :pattern
                OR similarity(t.team_name, :q) >= 0.12
              )
              AND (
                CAST(:school_unitid AS text) IS NULL
                OR t.school_unitid = CAST(:school_unitid AS text)
              )
              AND (
                CAST(:school_name AS text) IS NULL
                OR s.name = CAST(:school_name AS text)
              )
              AND (
                CAST(:sport AS text) IS NULL
                OR lower(t.sport) = lower(CAST(:sport AS text))
              )
            GROUP BY t.id, t.team_name, t.sport, t.school_unitid, s.name, s.state
            ORDER BY
              CASE WHEN :q = '' THEN 0 ELSE similarity(t.team_name, :q) END DESC,
              t.team_name ASC
            LIMIT :limit
            """
        ),
        {
            "q": q.strip(),
            "pattern": f"%{q.strip()}%",
            "school_unitid": school_unitid.strip() if school_unitid else None,
            "school_name": school_name.strip() if school_name else None,
            "sport": sport.strip() if sport else None,
            "limit": limit,
        },
    ).mappings().all()
    return {
        "source": "sql",
        "items": [
            {
                "id": int(r["id"]),
                "name": r["name"],
                "sport": r["sport"],
                "school_unitid": r["school_unitid"],
                "school_name": r["school_name"],
                "school_state": r["school_state"],
                "active_member_count": int(r["active_member_count"] or 0),
            }
            for r in rows
        ],
    }
 
 
@router.get("/search/tags")
def search_tags(
    q: str = Query("", max_length=120),
    limit: int = Query(default=20, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT
              t.slug,
              t.display_name,
              COUNT(pt.post_id)::int AS post_count
            FROM public.tags t
            LEFT JOIN public.post_tags pt ON pt.tag_id = t.id
            WHERE
              (
                :q = ''
                OR t.slug ILIKE :pattern
                OR COALESCE(t.display_name, '') ILIKE :pattern
              )
            GROUP BY t.id, t.slug, t.display_name
            ORDER BY
              CASE
                WHEN lower(t.slug) = lower(:q) THEN 0
                WHEN lower(t.slug) LIKE lower(:prefix_pattern) THEN 1
                ELSE 2
              END,
              COUNT(pt.post_id) DESC,
              t.slug ASC
            LIMIT :limit
            """
        ),
        {
            "q": q.strip(),
            "pattern": f"%{q.strip()}%",
            "prefix_pattern": f"{q.strip()}%",
            "limit": limit,
        },
    ).mappings().all()
 
    return {
        "source": "sql",
        "items": [
            {
                "slug": r["slug"],
                "display_name": r["display_name"] or r["slug"],
                "tag": f"#{r['slug']}",
                "post_count": int(r["post_count"] or 0),
            }
            for r in rows
        ],
    }
 
 
@router.get("/autocomplete/schools")
def autocomplete_schools(
    q: str = Query("", max_length=120),
    limit: int = Query(default=8, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_schools(q=q, limit=limit, _=current_user, db=db)
 
 
@router.get("/autocomplete/teams")
def autocomplete_teams(
    q: str = Query("", max_length=120),
    school_unitid: str | None = Query(default=None, max_length=16),
    school_name: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=8, ge=1, le=30),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return search_teams(
        q=q,
        school_unitid=school_unitid,
        school_name=school_name,
        limit=limit,
        _=current_user,
        db=db,
    )
