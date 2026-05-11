from __future__ import annotations

import re
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.schools import CreateTeamRequest, JoinTeamRequest

router = APIRouter(prefix="/api/v1", tags=["schools"])


def _user_roles(db: Session, user_id: int) -> set[str]:
    rows = db.execute(
        text(
            """
            SELECT r.key
            FROM public.user_roles ur
            JOIN public.roles r ON r.id = ur.role_id
            WHERE ur.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).all()
    return {str(r[0]) for r in rows}


def _ensure_school_exists(db: Session, unitid: str) -> dict:
    school = db.execute(
        text(
            """
            SELECT
              unitid,
              name,
              addr,
              city,
              state,
              zip,
              webaddr,
              latitude,
              longitud,
              iclevel,
              control,
              is_community_college,
              logo_url,
              created_at,
              updated_at
            FROM public.schools
            WHERE unitid = :unitid
            """
        ),
        {"unitid": unitid},
    ).mappings().first()
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    return dict(school)


def _website_domain(webaddr: str | None) -> str | None:
    if not webaddr:
        return None
    candidate = webaddr.strip()
    if not candidate:
        return None
    parsed = urlparse(candidate if "://" in candidate else f"https://{candidate}")
    host = (parsed.netloc or "").strip().lower()
    if host.startswith("www."):
        host = host[4:]
    return host or None


def _derived_logo_url(webaddr: str | None) -> str | None:
    domain = _website_domain(webaddr)
    if not domain:
        return None
    return f"https://logo.clearbit.com/{domain}"


def _school_initials(name: str) -> str:
    parts = [p for p in re.split(r"[^A-Za-z0-9]+", name) if p]
    if not parts:
        return "SC"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return f"{parts[0][0]}{parts[1][0]}".upper()


def _level_matches_filter(level_filter: str | None, value_iclevel: str | None, is_cc: bool) -> bool:
    if not level_filter:
        return True
    normalized = level_filter.strip().lower()
    if normalized == "2-year":
        return bool(is_cc)
    if normalized == "4-year":
        return not bool(is_cc)
    return (value_iclevel or "").strip().lower() == normalized


def _can_manage_team_memberships(db: Session, user_id: int, team_id: int) -> bool:
    roles = _user_roles(db, user_id)
    if "admin" in roles:
        return True
    return bool(
        db.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM public.team_memberships tm
                  WHERE tm.team_id = :team_id
                    AND tm.user_id = :user_id
                    AND tm.role = 'coach'
                    AND tm.status = 'active'
                )
                """
            ),
            {"team_id": team_id, "user_id": user_id},
        ).scalar()
    )


@router.get("/schools")
def list_schools(
    query: str | None = Query(default=None, max_length=120),
    state: str | None = Query(default=None, max_length=24),
    level: str | None = Query(default=None, max_length=120),
    limit: int = Query(default=24, ge=1, le=100),
    offset: int = Query(default=0, ge=0, le=100000),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = (query or "").strip()
    state_norm = state.strip().upper() if state else None
    level_norm = level.strip() if level else None

    # Use trigram similarity when query text exists.
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
              s.iclevel,
              COUNT(*) OVER()::int AS total_count,
              CASE
                WHEN :q = '' THEN 0.0
                ELSE similarity(s.name, :q)
              END AS score
            FROM public.schools s
            WHERE
              (
                :q = ''
                OR s.name ILIKE :pattern
                OR similarity(s.name, :q) >= 0.12
              )
              AND (CAST(:state_norm AS text) IS NULL OR upper(s.state) = CAST(:state_norm AS text))
              AND (
                CAST(:level_norm AS text) IS NULL
                OR (
                  lower(CAST(:level_norm AS text)) = '2-year'
                  AND s.is_community_college = true
                )
                OR (
                  lower(CAST(:level_norm AS text)) = '4-year'
                  AND s.is_community_college = false
                )
                OR (
                  lower(CAST(:level_norm AS text)) NOT IN ('2-year', '4-year')
                  AND lower(COALESCE(s.iclevel, '')) = lower(CAST(:level_norm AS text))
                )
              )
            ORDER BY score DESC, s.name ASC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {
            "q": q,
            "pattern": f"%{q}%",
            "state_norm": state_norm,
            "level_norm": level_norm,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()

    items = [
        {
            "unitid": r["unitid"],
            "name": r["name"],
            "city": r["city"],
            "state": r["state"],
            "webaddr": r["webaddr"],
            "logo_url": r["logo_url"],
            "is_community_college": bool(r["is_community_college"]),
            "iclevel": r["iclevel"],
        }
        for r in rows
        if _level_matches_filter(level_norm, r["iclevel"], bool(r["is_community_college"]))
    ]
    total = int(rows[0]["total_count"]) if rows else 0
    return {
        "items": items,
        "limit": limit,
        "offset": offset,
        "total": total,
        "hasMore": (offset + len(items)) < total,
    }


@router.get("/schools/{unitid}")
def get_school(
    unitid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = _ensure_school_exists(db, unitid)

    team_count = int(
        db.execute(
            text("SELECT COUNT(*)::int FROM public.teams WHERE school_unitid = :unitid"),
            {"unitid": unitid},
        ).scalar()
        or 0
    )

    selected_by_user = bool(
        db.execute(
            text(
                """
                SELECT EXISTS (
                  SELECT 1
                  FROM public.athlete_profiles ap
                  WHERE ap.user_id = :user_id
                    AND ap.school_unitid = :unitid
                )
                OR EXISTS (
                  SELECT 1
                  FROM public.coach_profiles cp
                  WHERE cp.user_id = :user_id
                    AND cp.school_unitid = :unitid
                )
                """
            ),
            {"user_id": current_user.id, "unitid": unitid},
        ).scalar()
    )

    explicit_logo = school.get("logo_url")
    derived_logo = None if explicit_logo else _derived_logo_url(school.get("webaddr"))
    initials = _school_initials(str(school.get("name") or "School"))

    return {
        "school": {
            "unitid": school["unitid"],
            "name": school["name"],
            "addr": school["addr"],
            "city": school["city"],
            "state": school["state"],
            "zip": school["zip"],
            "webaddr": school["webaddr"],
            "latitude": school["latitude"],
            "longitud": school["longitud"],
            "iclevel": school["iclevel"],
            "control": school["control"],
            "is_community_college": bool(school["is_community_college"]),
            "logo_url": explicit_logo,
            "derived_logo_url": derived_logo,
            "logo_source": "stored" if explicit_logo else ("clearbit" if derived_logo else "initials"),
            "logo_initials": initials,
            "team_count": team_count,
            "selected_by_current_user": selected_by_user,
        }
    }


@router.post("/schools/{unitid}/select")
def select_school_for_current_user(
    unitid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    school = _ensure_school_exists(db, unitid)
    school_name = str(school["name"])
    roles = _user_roles(db, current_user.id)
    updated = False
    missing_athlete_profile = False
    missing_coach_profile = False

    if "athlete" in roles:
        athlete_exists = db.execute(
            text("SELECT EXISTS (SELECT 1 FROM public.athlete_profiles WHERE user_id = :uid)"),
            {"uid": current_user.id},
        ).scalar()
        if athlete_exists:
            db.execute(
                text(
                    """
                    UPDATE public.athlete_profiles
                    SET school_unitid = :unitid,
                        high_school = :school_name,
                        updated_at = now()
                    WHERE user_id = :uid
                    """
                ),
                {"unitid": unitid, "school_name": school_name, "uid": current_user.id},
            )
            updated = True
        else:
            missing_athlete_profile = True

    if "coach" in roles:
        coach_exists = db.execute(
            text("SELECT EXISTS (SELECT 1 FROM public.coach_profiles WHERE user_id = :uid)"),
            {"uid": current_user.id},
        ).scalar()
        if coach_exists:
            db.execute(
                text(
                    """
                    UPDATE public.coach_profiles
                    SET school_unitid = :unitid,
                        organization_name = :school_name,
                        updated_at = now()
                    WHERE user_id = :uid
                    """
                ),
                {"unitid": unitid, "school_name": school_name, "uid": current_user.id},
            )
            updated = True
        else:
            missing_coach_profile = True

    if not updated:
        if missing_athlete_profile and not ("coach" in roles):
            raise HTTPException(
                status_code=409,
                detail="Create your athlete profile first, then select your school",
            )
        if missing_coach_profile and not ("athlete" in roles):
            raise HTTPException(
                status_code=409,
                detail="Create your coach profile first, then select your school",
            )
        raise HTTPException(
            status_code=409,
            detail="No editable athlete or coach profile found for this user",
        )

    db.commit()
    return {"ok": True, "unitid": unitid}


@router.get("/schools/{unitid}/teams")
def list_school_teams(
    unitid: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_school_exists(db, unitid)
    roles = _user_roles(db, current_user.id)
    is_admin = "admin" in roles

    rows = db.execute(
        text(
            """
            SELECT
              t.id,
              t.school_unitid,
              t.sport,
              t.team_name,
              t.created_by_user_id,
              t.created_at,
              COALESCE(ms.active_count, 0)::int AS active_member_count,
              COALESCE(ms.pending_count, 0)::int AS pending_member_count,
              my.id AS my_membership_id,
              my.role AS my_membership_role,
              my.status AS my_membership_status,
              EXISTS (
                SELECT 1
                FROM public.team_memberships coach_mem
                WHERE coach_mem.team_id = t.id
                  AND coach_mem.user_id = :uid
                  AND coach_mem.role = 'coach'
                  AND coach_mem.status = 'active'
              ) AS can_manage_via_membership
            FROM public.teams t
            LEFT JOIN LATERAL (
              SELECT
                COUNT(*) FILTER (WHERE tm.status = 'active') AS active_count,
                COUNT(*) FILTER (WHERE tm.status = 'pending') AS pending_count
              FROM public.team_memberships tm
              WHERE tm.team_id = t.id
            ) ms ON true
            LEFT JOIN public.team_memberships my
              ON my.team_id = t.id
             AND my.user_id = :uid
            WHERE t.school_unitid = :unitid
            ORDER BY lower(t.sport), lower(t.team_name), t.id
            """
        ),
        {"unitid": unitid, "uid": current_user.id},
    ).mappings().all()

    items: list[dict] = []
    manageable_team_ids: list[int] = []
    for r in rows:
        can_manage = bool(is_admin or r["can_manage_via_membership"])
        team_id = int(r["id"])
        if can_manage:
            manageable_team_ids.append(team_id)
        items.append(
            {
                "id": team_id,
                "schoolUnitid": r["school_unitid"],
                "sport": r["sport"],
                "teamName": r["team_name"],
                "createdByUserId": int(r["created_by_user_id"]),
                "createdAt": r["created_at"].isoformat(),
                "activeMemberCount": int(r["active_member_count"]),
                "pendingMemberCount": int(r["pending_member_count"]),
                "myMembership": (
                    {
                        "id": int(r["my_membership_id"]),
                        "role": r["my_membership_role"],
                        "status": r["my_membership_status"],
                    }
                    if r["my_membership_id"] is not None
                    else None
                ),
                "canManageMemberships": can_manage,
                "pendingMemberships": [],
            }
        )

    pending_by_team: dict[int, list[dict]] = {}
    if manageable_team_ids:
        pending_rows = db.execute(
            text(
                """
                SELECT
                  tm.id AS membership_id,
                  tm.team_id,
                  tm.user_id,
                  tm.role,
                  tm.status,
                  tm.created_at,
                  u.email,
                  COALESCE(
                    NULLIF(trim(CONCAT_WS(' ', ap.first_name, ap.last_name)), ''),
                    NULLIF(trim(CONCAT_WS(' ', cp.first_name, cp.last_name)), ''),
                    u.email
                  ) AS display_name
                FROM public.team_memberships tm
                JOIN public.users u ON u.id = tm.user_id
                LEFT JOIN public.athlete_profiles ap ON ap.user_id = u.id
                LEFT JOIN public.coach_profiles cp ON cp.user_id = u.id
                WHERE tm.team_id = ANY(CAST(:team_ids AS bigint[]))
                  AND tm.status = 'pending'
                ORDER BY tm.team_id, tm.created_at ASC
                """
            ),
            {"team_ids": manageable_team_ids},
        ).mappings().all()
        for r in pending_rows:
            team_id = int(r["team_id"])
            pending_by_team.setdefault(team_id, []).append(
                {
                    "membershipId": int(r["membership_id"]),
                    "userId": int(r["user_id"]),
                    "name": r["display_name"],
                    "email": r["email"],
                    "role": r["role"],
                    "status": r["status"],
                    "createdAt": r["created_at"].isoformat(),
                }
            )

    for item in items:
        item["pendingMemberships"] = pending_by_team.get(int(item["id"]), [])

    return {"items": items}


@router.post("/schools/{unitid}/teams")
def create_team_for_school(
    unitid: str,
    payload: CreateTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_school_exists(db, unitid)
    roles = _user_roles(db, current_user.id)
    if "coach" not in roles:
        raise HTTPException(status_code=403, detail="Only coaches can create teams")

    coach_profile = db.execute(
        text(
            """
            SELECT user_id, school_unitid, is_verified_coach
            FROM public.coach_profiles
            WHERE user_id = :uid
            """
        ),
        {"uid": current_user.id},
    ).mappings().first()
    if not coach_profile:
        raise HTTPException(status_code=403, detail="Coach profile required to create teams")
    if not bool(coach_profile["is_verified_coach"]):
        raise HTTPException(status_code=403, detail="Coach must be verified to create teams")
    if coach_profile["school_unitid"] != unitid:
        raise HTTPException(
            status_code=403,
            detail="Coach must be verified for this school to create teams",
        )

    sport = payload.sport.strip()
    team_name = payload.team_name.strip()
    if not sport or not team_name:
        raise HTTPException(status_code=400, detail="sport and team_name are required")

    try:
        row = db.execute(
            text(
                """
                INSERT INTO public.teams (school_unitid, sport, team_name, created_by_user_id)
                VALUES (:unitid, :sport, :team_name, :uid)
                RETURNING id, school_unitid, sport, team_name, created_by_user_id, created_at
                """
            ),
            {
                "unitid": unitid,
                "sport": sport,
                "team_name": team_name,
                "uid": current_user.id,
            },
        ).mappings().one()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Team already exists for this school and sport",
        ) from exc

    db.execute(
        text(
            """
            INSERT INTO public.team_memberships (team_id, user_id, role, status)
            VALUES (:team_id, :uid, 'coach', 'active')
            ON CONFLICT (team_id, user_id)
            DO UPDATE SET
              role = EXCLUDED.role,
              status = EXCLUDED.status,
              updated_at = now()
            """
        ),
        {"team_id": int(row["id"]), "uid": current_user.id},
    )
    db.commit()

    return {
        "team": {
            "id": int(row["id"]),
            "schoolUnitid": row["school_unitid"],
            "sport": row["sport"],
            "teamName": row["team_name"],
            "createdByUserId": int(row["created_by_user_id"]),
            "createdAt": row["created_at"].isoformat(),
        }
    }


@router.post("/teams/{team_id}/join")
def join_team(
    team_id: int,
    payload: JoinTeamRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    team_exists = db.execute(
        text("SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = :team_id)"),
        {"team_id": team_id},
    ).scalar()
    if not team_exists:
        raise HTTPException(status_code=404, detail="Team not found")

    roles = _user_roles(db, current_user.id)
    if payload.role == "athlete" and "athlete" not in roles:
        raise HTTPException(status_code=403, detail="Only athlete users can join as athlete")
    if payload.role == "coach" and ("coach" not in roles and "admin" not in roles):
        raise HTTPException(status_code=403, detail="Only coach users can join as coach")
    if payload.role == "staff" and ("coach" not in roles and "admin" not in roles):
        raise HTTPException(status_code=403, detail="Only coach users can join as staff")

    existing = db.execute(
        text(
            """
            SELECT id, role, status
            FROM public.team_memberships
            WHERE team_id = :team_id
              AND user_id = :uid
            """
        ),
        {"team_id": team_id, "uid": current_user.id},
    ).mappings().first()

    if existing:
        if existing["status"] == "active":
            raise HTTPException(status_code=409, detail="You are already an active member")
        if existing["status"] == "pending":
            raise HTTPException(status_code=409, detail="Join request already pending")
        row = db.execute(
            text(
                """
                UPDATE public.team_memberships
                SET role = :role,
                    status = 'pending',
                    updated_at = now()
                WHERE id = :membership_id
                RETURNING id, team_id, user_id, role, status, created_at, updated_at
                """
            ),
            {"role": payload.role, "membership_id": int(existing["id"])},
        ).mappings().one()
        db.commit()
        return {
            "membership": {
                "id": int(row["id"]),
                "teamId": int(row["team_id"]),
                "userId": int(row["user_id"]),
                "role": row["role"],
                "status": row["status"],
                "createdAt": row["created_at"].isoformat(),
                "updatedAt": row["updated_at"].isoformat(),
            }
        }

    row = db.execute(
        text(
            """
            INSERT INTO public.team_memberships (team_id, user_id, role, status)
            VALUES (:team_id, :uid, :role, 'pending')
            RETURNING id, team_id, user_id, role, status, created_at, updated_at
            """
        ),
        {"team_id": team_id, "uid": current_user.id, "role": payload.role},
    ).mappings().one()
    db.commit()
    return {
        "membership": {
            "id": int(row["id"]),
            "teamId": int(row["team_id"]),
            "userId": int(row["user_id"]),
            "role": row["role"],
            "status": row["status"],
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
        }
    }


def _set_membership_status(
    db: Session,
    *,
    team_id: int,
    membership_id: int,
    status: str,
) -> dict:
    row = db.execute(
        text(
            """
            UPDATE public.team_memberships
            SET status = :status,
                updated_at = now()
            WHERE id = :membership_id
              AND team_id = :team_id
            RETURNING id, team_id, user_id, role, status, created_at, updated_at
            """
        ),
        {"status": status, "membership_id": membership_id, "team_id": team_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Membership not found for this team")
    db.commit()
    return {
        "membership": {
            "id": int(row["id"]),
            "teamId": int(row["team_id"]),
            "userId": int(row["user_id"]),
            "role": row["role"],
            "status": row["status"],
            "createdAt": row["created_at"].isoformat(),
            "updatedAt": row["updated_at"].isoformat(),
        }
    }


@router.post("/teams/{team_id}/memberships/{membership_id}/approve")
def approve_team_membership(
    team_id: int,
    membership_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _can_manage_team_memberships(db, current_user.id, team_id):
        raise HTTPException(status_code=403, detail="Not authorized to approve memberships")
    return _set_membership_status(db, team_id=team_id, membership_id=membership_id, status="active")


@router.post("/teams/{team_id}/memberships/{membership_id}/reject")
def reject_team_membership(
    team_id: int,
    membership_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _can_manage_team_memberships(db, current_user.id, team_id):
        raise HTTPException(status_code=403, detail="Not authorized to reject memberships")
    return _set_membership_status(db, team_id=team_id, membership_id=membership_id, status="rejected")
