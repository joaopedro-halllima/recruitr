from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.coach_profile import CoachProfile
from app.models.user import User
from app.schemas.profile import AthleteProfileUpsertRequest, CoachProfileUpsertRequest
from app.services.profile_media import (
    assert_profile_media_asset_ownership,
    get_profile_media,
    upsert_profile_media,
)

router = APIRouter(prefix="/api/v1/athlete-profile", tags=["athlete-profile"])
coach_router = APIRouter(prefix="/api/v1/coach-profile", tags=["coach-profile"])


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


def _ensure_athlete(db: Session, user_id: int) -> None:
    if not _user_has_role(db, user_id, "athlete"):
        raise HTTPException(status_code=403, detail="Only athlete users can manage athlete profile")


def _ensure_coach(db: Session, user_id: int) -> None:
    if not _user_has_role(db, user_id, "coach"):
        raise HTTPException(status_code=403, detail="Only coach users can manage coach profile")


def _athlete_profile_response(row, media: dict[str, int | str | None] | None = None) -> dict:
    media = media or {}
    return {
        "userId": int(row["user_id"]),
        "firstName": row["first_name"] or "",
        "lastName": row["last_name"] or "",
        "sport": row["sport"] or "",
        "gradYear": row["grad_year"],
        "positions": row["positions"] or [],
        "state": row["state"],
        "country": row["country"] or "USA",
        "willingToTravel": bool(row["willing_to_travel"]) if row["willing_to_travel"] is not None else False,
        "travelRadiusMi": row["travel_radius_mi"],
        "clubTeam": row["club_team"],
        "schoolUnitId": row["school_unitid"],
        "schoolName": row["school_name"] or row["high_school"],
        "highSchool": row["high_school"],
        "bio": row["bio"],
        "avatarMediaAssetId": media.get("avatar_media_asset_id"),
        "bannerMediaAssetId": media.get("banner_media_asset_id"),
        "avatarUrl": media.get("avatar_url"),
        "bannerUrl": media.get("banner_url"),
    }


def _coach_profile_response(
    db: Session,
    profile: CoachProfile,
    media: dict[str, int | str | None] | None = None,
) -> dict:
    media = media or {}
    school_name = None
    if profile.school_unitid:
        school_name = db.execute(
            text("SELECT name FROM public.schools WHERE unitid = :unitid"),
            {"unitid": profile.school_unitid},
        ).scalar()

    return {
        "id": profile.id,
        "userId": profile.user_id,
        "firstName": profile.first_name or "",
        "lastName": profile.last_name or "",
        "title": profile.title,
        "organizationName": profile.organization_name,
        "schoolUnitId": profile.school_unitid,
        "schoolName": school_name,
        "sport": profile.sport,
        "level": profile.level,
        "bio": profile.bio,
        "isVerifiedCoach": bool(profile.is_verified_coach),
        "avatarMediaAssetId": media.get("avatar_media_asset_id"),
        "bannerMediaAssetId": media.get("banner_media_asset_id"),
        "avatarUrl": media.get("avatar_url"),
        "bannerUrl": media.get("banner_url"),
    }


@router.get("/me")
def get_my_athlete_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_athlete(db, current_user.id)

    row = db.execute(
        text(
            """
            SELECT
              ap.user_id,
              ap.first_name,
              ap.last_name,
              ap.sport,
              ap.grad_year,
              ap.positions,
              ap.state,
              ap.country,
              ap.willing_to_travel,
              ap.travel_radius_mi,
              ap.club_team,
              ap.school_unitid,
              s.name AS school_name,
              ap.high_school,
              ap.bio
            FROM public.athlete_profiles ap
            LEFT JOIN public.schools s
              ON s.unitid = ap.school_unitid
            WHERE ap.user_id = :user_id
            """
        ),
        {"user_id": current_user.id},
    ).mappings().first()

    media = get_profile_media(db, current_user.id, request) if row else None

    return {"profile": (_athlete_profile_response(row, media) if row else None)}


@router.get("/{user_id}")
def get_athlete_profile(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user

    if not _user_has_role(db, user_id, "athlete"):
        raise HTTPException(status_code=404, detail="Athlete not found")

    row = db.execute(
        text(
            """
            SELECT
              ap.user_id,
              ap.first_name,
              ap.last_name,
              ap.sport,
              ap.grad_year,
              ap.positions,
              ap.state,
              ap.country,
              ap.willing_to_travel,
              ap.travel_radius_mi,
              ap.club_team,
              ap.school_unitid,
              s.name AS school_name,
              ap.high_school,
              ap.bio
            FROM public.athlete_profiles ap
            LEFT JOIN public.schools s
              ON s.unitid = ap.school_unitid
            WHERE ap.user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Athlete profile not found")

    return {"profile": _athlete_profile_response(row, get_profile_media(db, user_id, request))}


@router.put("/me")
def upsert_my_athlete_profile(
    payload: AthleteProfileUpsertRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_athlete(db, current_user.id)
    assert_profile_media_asset_ownership(
        db,
        user_id=current_user.id,
        media_asset_id=payload.avatar_media_asset_id,
        field_name="avatar_media_asset_id",
    )
    assert_profile_media_asset_ownership(
        db,
        user_id=current_user.id,
        media_asset_id=payload.banner_media_asset_id,
        field_name="banner_media_asset_id",
    )

    positions = [p.strip() for p in payload.positions if p and p.strip()]
    school_unitid = payload.school_unitid.strip() if payload.school_unitid else None
    high_school = payload.high_school.strip() if payload.high_school else None
    if school_unitid:
        school_row = db.execute(
            text("SELECT unitid, name FROM public.schools WHERE unitid = :unitid"),
            {"unitid": school_unitid},
        ).mappings().first()
        if not school_row:
            raise HTTPException(status_code=400, detail="Invalid school_unitid")
        high_school = str(school_row["name"])

    row = db.execute(
        text(
            """
            INSERT INTO public.athlete_profiles
              (user_id, first_name, last_name, sport, grad_year, positions, state, country,
               willing_to_travel, travel_radius_mi, club_team, school_unitid, high_school, bio)
            VALUES
              (:user_id, :first_name, :last_name, :sport, :grad_year, :positions, :state, :country,
               :willing_to_travel, :travel_radius_mi, :club_team, :school_unitid, :high_school, :bio)
            ON CONFLICT (user_id)
            DO UPDATE SET
              first_name = EXCLUDED.first_name,
              last_name = EXCLUDED.last_name,
              sport = EXCLUDED.sport,
              grad_year = EXCLUDED.grad_year,
              positions = EXCLUDED.positions,
              state = EXCLUDED.state,
              country = EXCLUDED.country,
              willing_to_travel = EXCLUDED.willing_to_travel,
              travel_radius_mi = EXCLUDED.travel_radius_mi,
              club_team = EXCLUDED.club_team,
              school_unitid = EXCLUDED.school_unitid,
              high_school = EXCLUDED.high_school,
              bio = EXCLUDED.bio,
              updated_at = now()
            RETURNING
              athlete_profiles.user_id,
              athlete_profiles.first_name,
              athlete_profiles.last_name,
              athlete_profiles.sport,
              athlete_profiles.grad_year,
              athlete_profiles.positions,
              athlete_profiles.state,
              athlete_profiles.country,
              athlete_profiles.willing_to_travel,
              athlete_profiles.travel_radius_mi,
              athlete_profiles.club_team,
              athlete_profiles.school_unitid,
              athlete_profiles.high_school,
              athlete_profiles.bio
            """
        ),
        {
            "user_id": current_user.id,
            "first_name": payload.first_name.strip(),
            "last_name": payload.last_name.strip(),
            "sport": payload.sport.strip().lower(),
            "grad_year": payload.grad_year,
            "positions": positions,
            "state": payload.state.strip() if payload.state else None,
            "country": (payload.country or "USA").strip(),
            "willing_to_travel": payload.willing_to_travel,
            "travel_radius_mi": payload.travel_radius_mi,
            "club_team": payload.club_team.strip() if payload.club_team else None,
            "school_unitid": school_unitid,
            "high_school": high_school,
            "bio": payload.bio.strip() if payload.bio else None,
        },
    ).mappings().one()
    upsert_profile_media(
        db,
        user_id=current_user.id,
        avatar_media_asset_id=payload.avatar_media_asset_id,
        banner_media_asset_id=payload.banner_media_asset_id,
    )
    db.commit()

    school_name = None
    if row["school_unitid"]:
        school_name = db.execute(
            text("SELECT name FROM public.schools WHERE unitid = :unitid"),
            {"unitid": row["school_unitid"]},
        ).scalar()

    return {
        "ok": True,
        "profile": _athlete_profile_response(
            {
                **row,
                "school_name": school_name or row["high_school"],
            },
            get_profile_media(db, current_user.id, request),
        ),
    }


@coach_router.get("/me")
def get_my_coach_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)

    profile = db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    return {
        "profile": (
            _coach_profile_response(db, profile, get_profile_media(db, current_user.id, request))
            if profile
            else None
        )
    }


@coach_router.get("/{user_id}")
def get_coach_profile(
    user_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    del current_user

    if not _user_has_role(db, user_id, "coach"):
        raise HTTPException(status_code=404, detail="Coach not found")

    profile = db.execute(
        select(CoachProfile).where(CoachProfile.user_id == user_id)
    ).scalar_one_or_none()

    if not profile:
        raise HTTPException(status_code=404, detail="Coach profile not found")

    return {"profile": _coach_profile_response(db, profile, get_profile_media(db, user_id, request))}


@coach_router.put("/me")
def upsert_my_coach_profile(
    payload: CoachProfileUpsertRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_coach(db, current_user.id)
    assert_profile_media_asset_ownership(
        db,
        user_id=current_user.id,
        media_asset_id=payload.avatar_media_asset_id,
        field_name="avatar_media_asset_id",
    )
    assert_profile_media_asset_ownership(
        db,
        user_id=current_user.id,
        media_asset_id=payload.banner_media_asset_id,
        field_name="banner_media_asset_id",
    )

    school_unitid = payload.school_unitid.strip() if payload.school_unitid else None
    school_name = None
    if school_unitid:
        school_row = db.execute(
            text("SELECT unitid, name FROM public.schools WHERE unitid = :unitid"),
            {"unitid": school_unitid},
        ).mappings().first()
        if not school_row:
            raise HTTPException(status_code=400, detail="Invalid school_unitid")
        school_name = str(school_row["name"])

    profile = db.execute(
        select(CoachProfile).where(CoachProfile.user_id == current_user.id)
    ).scalar_one_or_none()

    if not profile:
        profile = CoachProfile(
            user_id=current_user.id,
            first_name=payload.first_name.strip(),
            last_name=payload.last_name.strip(),
            is_verified_coach=False,
        )
        db.add(profile)

    profile.first_name = payload.first_name.strip()
    profile.last_name = payload.last_name.strip()
    profile.title = payload.title.strip() if payload.title else None
    profile.school_unitid = school_unitid
    profile.organization_name = (
        payload.organization_name.strip()
        if payload.organization_name and payload.organization_name.strip()
        else school_name
    )
    profile.sport = payload.sport.strip() if payload.sport else None
    profile.level = payload.level.strip() if payload.level else None
    profile.bio = payload.bio.strip() if payload.bio else None

    upsert_profile_media(
        db,
        user_id=current_user.id,
        avatar_media_asset_id=payload.avatar_media_asset_id,
        banner_media_asset_id=payload.banner_media_asset_id,
    )
    db.commit()
    db.refresh(profile)

    return {
        "ok": True,
        "profile": _coach_profile_response(db, profile, get_profile_media(db, current_user.id, request)),
    }
