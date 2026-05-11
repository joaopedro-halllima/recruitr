from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User

router = APIRouter(prefix="/api/v1/directory", tags=["directory"])


@router.get("/sports")
def list_sports(
    q: str | None = Query(default=None, min_length=1, max_length=40),
    limit: int = Query(default=25, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            WITH source_sports AS (
              SELECT lower(trim(t.sport)) AS sport
              FROM public.teams t
              WHERE t.sport IS NOT NULL AND trim(t.sport) <> ''
              UNION
              SELECT lower(trim(ap.sport)) AS sport
              FROM public.athlete_profiles ap
              WHERE ap.sport IS NOT NULL AND trim(ap.sport) <> ''
            )
            SELECT sport
            FROM source_sports
            WHERE (CAST(:q AS text) IS NULL OR sport ILIKE CAST(:pattern AS text))
            GROUP BY sport
            ORDER BY COUNT(*) DESC, sport ASC
            LIMIT :limit
            """
        ),
        {"q": q, "pattern": f"%{q.strip()}%" if q else None, "limit": limit},
    ).all()
    return {"items": [r[0] for r in rows]}


@router.get("/schools")
def list_schools(
    q: str | None = Query(default=None, min_length=1, max_length=80),
    limit: int = Query(default=25, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT s.unitid, s.name AS school_name
            FROM public.schools s
            WHERE (CAST(:q AS text) IS NULL OR s.name ILIKE CAST(:pattern AS text))
            ORDER BY s.name ASC
            LIMIT :limit
            """
        ),
        {"q": q, "pattern": f"%{q.strip()}%" if q else None, "limit": limit},
    ).all()
    return {"items": [{"unitid": r[0], "name": r[1]} for r in rows]}


@router.get("/teams")
def list_teams(
    q: str | None = Query(default=None, min_length=1, max_length=80),
    school_name: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=25, ge=1, le=100),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        text(
            """
            SELECT t.id, t.team_name, t.school_unitid
            FROM public.teams t
            JOIN public.schools s ON s.unitid = t.school_unitid
            WHERE (CAST(:q AS text) IS NULL OR t.team_name ILIKE CAST(:pattern AS text))
              AND (
                CAST(:school_name AS text) IS NULL
                OR s.name = CAST(:school_name AS text)
              )
            GROUP BY t.id, t.team_name, t.school_unitid
            ORDER BY t.team_name ASC
            LIMIT :limit
            """
        ),
        {
            "q": q,
            "pattern": f"%{q.strip()}%" if q else None,
            "school_name": school_name.strip() if school_name else None,
            "limit": limit,
        },
    ).all()
    return {
        "items": [
            {"teamId": int(r[0]), "name": r[1], "schoolUnitid": r[2]}
            for r in rows
        ]
    }
