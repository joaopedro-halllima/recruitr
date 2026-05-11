from __future__ import annotations

from sqlalchemy import text

from app.db.session import SessionLocal
from app.services.meili import (
    MeiliError,
    ensure_index,
    replace_documents,
    update_index_settings,
)
def _users_docs(db) -> list[dict]:
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
              ap.high_school,
              ap.school_unitid AS athlete_school_unitid,
              ap.club_team,
              cp.first_name AS coach_first_name,
              cp.last_name AS coach_last_name,
              cp.sport AS coach_sport,
              cp.organization_name,
              cp.level,
              cp.school_unitid AS coach_school_unitid,
              asch.name AS athlete_school_name,
              csch.name AS coach_school_name
            FROM public.users u
            JOIN roles_agg ra ON ra.user_id = u.id
            LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
            LEFT JOIN public.schools asch ON asch.unitid = ap.school_unitid
            LEFT JOIN public.schools csch ON csch.unitid = cp.school_unitid
            ORDER BY u.id DESC
            """
        )
    ).mappings().all()

    docs: list[dict] = []
    for r in rows:
        roles = list(r["roles"] or [])
        is_athlete = "athlete" in roles
        role = "athlete" if is_athlete else "coach"
        first_name = r["athlete_first_name"] if is_athlete else r["coach_first_name"]
        last_name = r["athlete_last_name"] if is_athlete else r["coach_last_name"]
        sport = r["athlete_sport"] if is_athlete else r["coach_sport"]
        name = " ".join([p for p in [first_name, last_name] if p]).strip() or r["email"]
        docs.append(
            {
                "id": int(r["user_id"]),
                "user_id": int(r["user_id"]),
                "email": r["email"],
                "role": role,
                "name": name,
                "sport": str(sport).lower() if sport else None,
                "grad_year": int(r["grad_year"]) if (is_athlete and r["grad_year"]) else None,
                "positions": [str(p).upper() for p in (r["positions"] or [])] if is_athlete else [],
                "state": str(r["athlete_state"]).upper() if (is_athlete and r["athlete_state"]) else None,
                "organization_name": r["organization_name"] if not is_athlete else None,
                "level": r["level"] if not is_athlete else None,
                "high_school": r["high_school"] if is_athlete else None,
                "school_unitid": (
                    r["athlete_school_unitid"] if is_athlete else r["coach_school_unitid"]
                ),
                "school_name": r["athlete_school_name"] if is_athlete else r["coach_school_name"],
                "club_team": r["club_team"] if is_athlete else None,
                "search_blob": " ".join(
                    [
                        part
                        for part in [
                            name,
                            r["email"],
                            (
                                r["athlete_school_name"]
                                if is_athlete
                                else (r["coach_school_name"] or r["organization_name"])
                            ),
                            (r["club_team"] if is_athlete else r["level"]),
                            (str(sport) if sport else None),
                        ]
                        if part
                    ]
                ),
            }
        )
    return docs


def _schools_docs(db) -> list[dict]:
    rows = db.execute(
        text(
            """
            SELECT
              s.unitid,
              s.name,
              s.city,
              s.state,
              s.webaddr,
              s.logo_url,
              s.is_community_college,
              s.iclevel
            FROM public.schools s
            ORDER BY s.name ASC
            """
        )
    ).mappings().all()
    docs = []
    for r in rows:
        docs.append(
            {
                "id": str(r["unitid"]),
                "unitid": str(r["unitid"]),
                "name": r["name"],
                "city": r["city"],
                "state": r["state"],
                "webaddr": r["webaddr"],
                "logo_url": r["logo_url"],
                "is_community_college": bool(r["is_community_college"]),
                "iclevel": r["iclevel"],
            }
        )
    return docs


def _teams_docs(db) -> list[dict]:
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
              COUNT(tm.id) FILTER (WHERE tm.status = 'active')::int AS active_member_count
            FROM public.teams t
            JOIN public.schools s ON s.unitid = t.school_unitid
            LEFT JOIN public.team_memberships tm ON tm.team_id = t.id
            GROUP BY t.id, t.team_name, t.sport, t.school_unitid, s.name, s.state
            ORDER BY t.team_name ASC
            """
        )
    ).mappings().all()
    docs = []
    for r in rows:
        docs.append(
            {
                "id": int(r["id"]),
                "name": r["name"],
                "sport": (str(r["sport"]).lower() if r["sport"] else None),
                "school_unitid": r["school_unitid"],
                "school_name": r["school_name"],
                "school_state": r["school_state"],
                "active_member_count": int(r["active_member_count"] or 0),
            }
        )
    return docs


def reindex_all() -> dict:
    db = SessionLocal()
    try:
        users_docs = _users_docs(db)
        schools_docs = _schools_docs(db)
        teams_docs = _teams_docs(db)
    finally:
        db.close()

    ensure_index("users", primary_key="id")
    ensure_index("schools", primary_key="id")
    ensure_index("teams", primary_key="id")

    update_index_settings(
        "users",
        {
            "filterableAttributes": ["role", "sport", "grad_year", "positions", "state"],
            "searchableAttributes": [
                "name",
                "email",
                "search_blob",
                "sport",
                "organization_name",
                "high_school",
                "club_team",
            ],
            "sortableAttributes": ["id", "grad_year"],
        },
    )
    update_index_settings(
        "schools",
        {
            "filterableAttributes": ["state", "is_community_college", "iclevel"],
            "searchableAttributes": ["name", "city", "state", "webaddr"],
            "sortableAttributes": ["name"],
        },
    )
    update_index_settings(
        "teams",
        {
            "filterableAttributes": ["school_unitid", "school_name", "sport", "school_state"],
            "searchableAttributes": ["name", "school_name", "sport"],
            "sortableAttributes": ["name", "active_member_count"],
        },
    )

    users_task = replace_documents("users", users_docs)
    schools_task = replace_documents("schools", schools_docs)
    teams_task = replace_documents("teams", teams_docs)

    return {
        "counts": {"users": len(users_docs), "schools": len(schools_docs), "teams": len(teams_docs)},
        "tasks": {"users": users_task, "schools": schools_task, "teams": teams_task},
    }


def main():
    try:
        out = reindex_all()
        counts = out["counts"]
        print(
            "Meili reindex queued:",
            f"users={counts['users']}",
            f"schools={counts['schools']}",
            f"teams={counts['teams']}",
        )
    except MeiliError as exc:
        print(f"Meili reindex failed: {exc}")
        raise


if __name__ == "__main__":
    main()
