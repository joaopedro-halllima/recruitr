from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.api.routes.auth import get_current_user
from app.db.deps import get_db
from app.models.user import User
from app.schemas.coach_verification import (
    CoachVerificationRequestCreate,
    CoachVerificationReviewRequest,
)

router = APIRouter(prefix="/api/v1/coach-verification", tags=["coach-verification"])


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


def _require_coach(db: Session, user_id: int) -> dict:
    if not _user_has_role(db, user_id, "coach"):
        raise HTTPException(status_code=403, detail="Coach role required")
    row = db.execute(
        text(
            """
            SELECT user_id, school_unitid, is_verified_coach
            FROM public.coach_profiles
            WHERE user_id = :user_id
            """
        ),
        {"user_id": user_id},
    ).mappings().first()
    if not row:
        raise HTTPException(status_code=403, detail="Coach profile required")
    return dict(row)


@router.get("/me")
def get_my_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach_profile = _require_coach(db, current_user.id)
    latest = db.execute(
        text(
            """
            SELECT id, status, evidence_media_asset_id, notes, submitted_at, reviewed_at
            FROM public.coach_verification_requests
            WHERE coach_user_id = :uid
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            """
        ),
        {"uid": current_user.id},
    ).mappings().first()

    return {
        "isCoach": True,
        "isVerifiedCoach": bool(coach_profile["is_verified_coach"]),
        "schoolUnitid": coach_profile["school_unitid"],
        "latestRequest": (
            {
                "id": int(latest["id"]),
                "status": latest["status"],
                "evidenceMediaAssetId": latest["evidence_media_asset_id"],
                "notes": latest["notes"],
                "submittedAt": latest["submitted_at"].isoformat(),
                "reviewedAt": latest["reviewed_at"].isoformat() if latest["reviewed_at"] else None,
            }
            if latest
            else None
        ),
    }


@router.post("/request")
def submit_coach_verification_request(
    payload: CoachVerificationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    coach_profile = _require_coach(db, current_user.id)
    if bool(coach_profile["is_verified_coach"]):
        return {"ok": True, "alreadyVerified": True}
    if not coach_profile["school_unitid"]:
        raise HTTPException(
            status_code=400,
            detail="Select your school before requesting verification",
        )

    existing_submitted = db.execute(
        text(
            """
            SELECT id
            FROM public.coach_verification_requests
            WHERE coach_user_id = :uid
              AND status = 'submitted'
            ORDER BY submitted_at DESC, id DESC
            LIMIT 1
            """
        ),
        {"uid": current_user.id},
    ).mappings().first()
    if existing_submitted:
        raise HTTPException(status_code=409, detail="A verification request is already pending")

    row = db.execute(
        text(
            """
            INSERT INTO public.coach_verification_requests
              (coach_user_id, status, evidence_media_asset_id, notes, submitted_at)
            VALUES
              (:uid, 'submitted', :evidence_media_asset_id, :notes, now())
            RETURNING id, status, evidence_media_asset_id, notes, submitted_at, reviewed_at
            """
        ),
        {
            "uid": current_user.id,
            "evidence_media_asset_id": payload.evidence_media_asset_id,
            "notes": payload.notes.strip() if payload.notes else None,
        },
    ).mappings().one()
    db.commit()

    return {
        "ok": True,
        "request": {
            "id": int(row["id"]),
            "status": row["status"],
            "evidenceMediaAssetId": row["evidence_media_asset_id"],
            "notes": row["notes"],
            "submittedAt": row["submitted_at"].isoformat(),
            "reviewedAt": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
        },
    }


@router.get("/requests")
def list_verification_requests(
    status: str | None = Query(default=None, pattern="^(submitted|approved|rejected)$"),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0, le=10000),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _user_has_role(db, current_user.id, "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")

    rows = db.execute(
        text(
            """
            SELECT
              cvr.id,
              cvr.coach_user_id,
              cvr.status,
              cvr.evidence_media_asset_id,
              cvr.notes,
              cvr.submitted_at,
              cvr.reviewed_at,
              u.email,
              cp.first_name,
              cp.last_name,
              cp.school_unitid,
              s.name AS school_name,
              cp.is_verified_coach
            FROM public.coach_verification_requests cvr
            JOIN public.users u ON u.id = cvr.coach_user_id
            LEFT JOIN public.coach_profiles cp ON cp.user_id = cvr.coach_user_id
            LEFT JOIN public.schools s ON s.unitid = cp.school_unitid
            WHERE (CAST(:status AS text) IS NULL OR cvr.status = CAST(:status AS text))
            ORDER BY cvr.submitted_at DESC, cvr.id DESC
            LIMIT :limit
            OFFSET :offset
            """
        ),
        {"status": status, "limit": limit, "offset": offset},
    ).mappings().all()

    return {
        "items": [
            {
                "id": int(r["id"]),
                "coachUserId": int(r["coach_user_id"]),
                "status": r["status"],
                "evidenceMediaAssetId": r["evidence_media_asset_id"],
                "notes": r["notes"],
                "submittedAt": r["submitted_at"].isoformat(),
                "reviewedAt": r["reviewed_at"].isoformat() if r["reviewed_at"] else None,
                "coachEmail": r["email"],
                "coachName": " ".join(
                    [p for p in [r["first_name"], r["last_name"]] if p]
                ).strip()
                or r["email"],
                "schoolUnitid": r["school_unitid"],
                "schoolName": r["school_name"],
                "isVerifiedCoach": bool(r["is_verified_coach"]) if r["is_verified_coach"] is not None else False,
            }
            for r in rows
        ]
    }


def _set_request_status(
    *,
    request_id: int,
    status: str,
    notes: str | None,
    db: Session,
) -> dict:
    request_row = db.execute(
        text(
            """
            SELECT id, coach_user_id
            FROM public.coach_verification_requests
            WHERE id = :request_id
            """
        ),
        {"request_id": request_id},
    ).mappings().first()
    if not request_row:
        raise HTTPException(status_code=404, detail="Verification request not found")

    row = db.execute(
        text(
            """
            UPDATE public.coach_verification_requests
            SET status = :status,
                notes = COALESCE(CAST(:notes AS text), notes),
                reviewed_at = now()
            WHERE id = :request_id
            RETURNING id, coach_user_id, status, notes, submitted_at, reviewed_at
            """
        ),
        {"status": status, "notes": notes, "request_id": request_id},
    ).mappings().one()

    db.execute(
        text(
            """
            UPDATE public.coach_profiles
            SET is_verified_coach = :verified,
                updated_at = now()
            WHERE user_id = :coach_user_id
            """
        ),
        {
            "verified": (status == "approved"),
            "coach_user_id": int(request_row["coach_user_id"]),
        },
    )
    db.commit()

    return {
        "ok": True,
        "request": {
            "id": int(row["id"]),
            "coachUserId": int(row["coach_user_id"]),
            "status": row["status"],
            "notes": row["notes"],
            "submittedAt": row["submitted_at"].isoformat(),
            "reviewedAt": row["reviewed_at"].isoformat() if row["reviewed_at"] else None,
        },
    }


@router.post("/requests/{request_id}/approve")
def approve_verification_request(
    request_id: int,
    payload: CoachVerificationReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _user_has_role(db, current_user.id, "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")
    return _set_request_status(
        request_id=request_id,
        status="approved",
        notes=(payload.notes.strip() if payload.notes else None),
        db=db,
    )


@router.post("/requests/{request_id}/reject")
def reject_verification_request(
    request_id: int,
    payload: CoachVerificationReviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not _user_has_role(db, current_user.id, "admin"):
        raise HTTPException(status_code=403, detail="Admin role required")
    return _set_request_status(
        request_id=request_id,
        status="rejected",
        notes=(payload.notes.strip() if payload.notes else None),
        db=db,
    )
