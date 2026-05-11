import hashlib
import secrets
import re
from datetime import datetime
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)
from app.db.deps import get_db
from app.models.coach_profile import CoachProfile
from app.models.role import Role
from app.models.user import User
from app.models.user_roles import UserRole
from app.schemas.auth import (
    ActionResponse,
    AuthResponse,
    DevLoginRequest,
    EmailVerificationConfirmRequest,
    EmailVerificationRequest,
    LoginRequest,
    MeResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    RegisterRequest,
)
from app.services.email import send_email
from app.services.profile_media import get_profile_media

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
bearer_scheme = HTTPBearer()


def _is_prod() -> bool:
    return settings.ENV.lower() in {"prod", "production"}


def _hash_action_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _create_action_token(
    db: Session,
    *,
    user_id: int,
    purpose: str,
    expires_in: timedelta,
) -> str:
    token = secrets.token_urlsafe(40)
    db.execute(
        text(
            """
            UPDATE public.auth_action_tokens
            SET used_at = now()
            WHERE user_id = :user_id
              AND purpose = :purpose
              AND used_at IS NULL
            """
        ),
        {"user_id": user_id, "purpose": purpose},
    )
    db.execute(
        text(
            """
            INSERT INTO public.auth_action_tokens
              (user_id, purpose, token_hash, expires_at)
            VALUES
              (:user_id, :purpose, :token_hash, now() + make_interval(secs => :expires_seconds))
            """
        ),
        {
            "user_id": user_id,
            "purpose": purpose,
            "token_hash": _hash_action_token(token),
            "expires_seconds": int(expires_in.total_seconds()),
        },
    )
    return token


def _consume_action_token(db: Session, *, token: str, purpose: str) -> int | None:
    row = db.execute(
        text(
            """
            UPDATE public.auth_action_tokens
            SET used_at = now()
            WHERE id = (
              SELECT id
              FROM public.auth_action_tokens
              WHERE token_hash = :token_hash
                AND purpose = :purpose
                AND used_at IS NULL
                AND expires_at > now()
              LIMIT 1
            )
            RETURNING user_id
            """
        ),
        {"token_hash": _hash_action_token(token), "purpose": purpose},
    ).mappings().first()
    return int(row["user_id"]) if row else None


def _frontend_link(path: str, token: str) -> str:
    base = settings.FRONTEND_URL.rstrip("/")
    return f"{base}{path}?token={token}"


def _maybe_dev_link(link: str) -> str | None:
    return None if _is_prod() else link


def _derive_name_parts(email: str, first_name: str | None, last_name: str | None, *, fallback_last: str) -> tuple[str, str]:
    first = (first_name or "").strip()
    last = (last_name or "").strip()
    if first and last:
        return first, last
    if first and not last:
        return first, fallback_last
    if last and not first:
        return "Recruitr", last

    local = email.split("@")[0]
    tokens = [part for part in re.split(r"[^a-zA-Z0-9]+", local) if part]
    if not tokens:
        return "Recruitr", fallback_last
    if len(tokens) == 1:
        return tokens[0].title(), fallback_last
    return tokens[0].title(), tokens[-1].title()


def _ensure_athlete_profile_row(
    db: Session,
    *,
    user_id: int,
    email: str,
    first_name: str | None = None,
    last_name: str | None = None,
    sport: str | None = None,
    bio: str | None = None,
) -> None:
    existing = db.execute(
        text("SELECT 1 FROM public.athlete_profiles WHERE user_id = :user_id"),
        {"user_id": user_id},
    ).scalar()
    if existing:
        return

    derived_first, derived_last = _derive_name_parts(
        email,
        first_name,
        last_name,
        fallback_last="Athlete",
    )
    normalized_sport = (sport or "").strip().lower() or "athlete"
    normalized_bio = (bio or "").strip() or "New athlete on Recruitr. Posting highlights soon."
    default_grad_year = min(max(datetime.now().year + 2, 2026), 2040)

    db.execute(
        text(
            """
            INSERT INTO public.athlete_profiles
              (user_id, first_name, last_name, sport, grad_year, positions, country, willing_to_travel, bio)
            VALUES
              (:user_id, :first_name, :last_name, :sport, :grad_year, ARRAY[]::text[], 'USA', false, :bio)
            ON CONFLICT (user_id) DO NOTHING
            """
        ),
        {
            "user_id": user_id,
            "first_name": derived_first,
            "last_name": derived_last,
            "sport": normalized_sport,
            "grad_year": default_grad_year,
            "bio": normalized_bio,
        },
    )


def _get_user_roles(db: Session, user_id: int) -> list[str]:
    rows = db.execute(
        select(Role.key)
        .join(UserRole, UserRole.role_id == Role.id)
        .where(UserRole.user_id == user_id)
    ).all()
    return [row[0] for row in rows]


def _get_coach_profile_dict(db: Session, user_id: int, request: Request) -> dict | None:
    cp = db.execute(
        select(CoachProfile).where(CoachProfile.user_id == user_id)
    ).scalar_one_or_none()

    if not cp:
        return None

    school_name = None
    if cp.school_unitid:
        school_name = db.execute(
            text("SELECT name FROM public.schools WHERE unitid = :unitid"),
            {"unitid": cp.school_unitid},
        ).scalar()

    media = get_profile_media(db, user_id, request)

    return {
        "id": cp.id,
        "first_name": cp.first_name,
        "last_name": cp.last_name,
        "title": cp.title,
        "organization_name": cp.organization_name,
        "school_unitid": cp.school_unitid,
        "school_name": school_name,
        "sport": cp.sport,
        "level": cp.level,
        "bio": cp.bio,
        "is_verified_coach": cp.is_verified_coach,
        "avatar_media_asset_id": media["avatar_media_asset_id"],
        "banner_media_asset_id": media["banner_media_asset_id"],
        "avatar_url": media["avatar_url"],
        "banner_url": media["banner_url"],
    }


def _get_athlete_profile_dict(db: Session, user_id: int, request: Request) -> dict | None:
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
        return None

    media = get_profile_media(db, user_id, request)

    return {
        "user_id": int(row["user_id"]),
        "first_name": row["first_name"],
        "last_name": row["last_name"],
        "sport": row["sport"],
        "grad_year": row["grad_year"],
        "positions": row["positions"] or [],
        "state": row["state"],
        "country": row["country"],
        "willing_to_travel": (
            bool(row["willing_to_travel"]) if row["willing_to_travel"] is not None else None
        ),
        "travel_radius_mi": row["travel_radius_mi"],
        "club_team": row["club_team"],
        "school_unitid": row["school_unitid"],
        "school_name": row["school_name"],
        "high_school": row["high_school"],
        "bio": row["bio"],
        "avatar_media_asset_id": media["avatar_media_asset_id"],
        "banner_media_asset_id": media["banner_media_asset_id"],
        "avatar_url": media["avatar_url"],
        "banner_url": media["banner_url"],
    }


def _build_me_response(db: Session, user: User, request: Request) -> MeResponse:
    roles = _get_user_roles(db, user.id)
    primary_role = roles[0] if roles else None

    if "athlete" in roles:
        _ensure_athlete_profile_row(db, user_id=user.id, email=user.email)
        db.flush()

    return MeResponse(
        id=user.id,
        email=user.email,
        is_email_verified=user.is_email_verified,
        roles=roles,
        primary_role=primary_role,
        coach_profile=_get_coach_profile_dict(db, user.id, request) if "coach" in roles else None,
        athlete_profile=_get_athlete_profile_dict(db, user.id, request) if "athlete" in roles else None,
    )


def _get_or_create_role(db: Session, role_key: str) -> Role:
    role = db.execute(select(Role).where(Role.key == role_key)).scalar_one_or_none()
    if role:
        return role

    # safety for local dev if roles weren't seeded
    role = Role(key=role_key, name=role_key.capitalize())
    db.add(role)
    db.flush()
    return role


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    token = credentials.credentials
    payload = decode_access_token(token)

    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )

    try:
        user_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token subject",
        )

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user


@router.post("/register", response_model=AuthResponse)
def register(payload: RegisterRequest, request: Request, db: Session = Depends(get_db)):
    existing = db.execute(select(User).where(User.email == payload.email)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    role = _get_or_create_role(db, payload.role)

    user = User(
        email=str(payload.email).lower(),
        password_hash=hash_password(payload.password),
        is_active=True,
        is_email_verified=not _is_prod(),
    )
    db.add(user)
    db.flush()  # get user.id

    db.add(UserRole(user_id=user.id, role_id=role.id))

    if payload.role == "coach":
        db.add(
            CoachProfile(
                user_id=user.id,
                first_name=payload.first_name or "Demo",
                last_name=payload.last_name or "Coach",
                title=payload.title,
                organization_name=payload.organization_name,
                sport=payload.sport,
                level=payload.level,
                bio=payload.bio,
                is_verified_coach=False,
            )
        )
    else:
        _ensure_athlete_profile_row(
            db,
            user_id=user.id,
            email=str(payload.email).lower(),
            first_name=payload.first_name,
            last_name=payload.last_name,
            sport=payload.sport,
            bio=payload.bio,
        )

    verification_link = None
    if not user.is_email_verified:
        verification_token = _create_action_token(
            db,
            user_id=user.id,
            purpose="email_verification",
            expires_in=timedelta(hours=24),
        )
        verification_link = _frontend_link("/verify-email", verification_token)

    db.commit()
    db.refresh(user)

    if verification_link:
        send_email(
            to_email=user.email,
            subject="Verify your Recruitr email",
            body=(
                "Welcome to Recruitr.\n\n"
                f"Verify your email by opening this link:\n{verification_link}\n\n"
                "This link expires in 24 hours."
            ),
        )

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=_build_me_response(db, user, request))


@router.post("/password-reset/request", response_model=ActionResponse)
def request_password_reset(payload: PasswordResetRequest, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    message = "If an account exists for that email, a reset link has been sent."
    if not email or "@" not in email:
        return ActionResponse(message=message)

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user:
        return ActionResponse(message=message)

    token = _create_action_token(
        db,
        user_id=user.id,
        purpose="password_reset",
        expires_in=timedelta(hours=1),
    )
    link = _frontend_link("/reset-password", token)
    db.commit()

    send_email(
        to_email=user.email,
        subject="Reset your Recruitr password",
        body=(
            "A password reset was requested for your Recruitr account.\n\n"
            f"Reset your password here:\n{link}\n\n"
            "This link expires in 1 hour. If you did not request this, you can ignore this email."
        ),
    )

    return ActionResponse(message=message, dev_link=_maybe_dev_link(link))


@router.post("/password-reset/confirm", response_model=ActionResponse)
def confirm_password_reset(payload: PasswordResetConfirmRequest, db: Session = Depends(get_db)):
    user_id = _consume_action_token(db, token=payload.token, purpose="password_reset")
    if not user_id:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Reset link is invalid or expired")

    user.password_hash = hash_password(payload.password)
    db.execute(
        text(
            """
            UPDATE public.auth_action_tokens
            SET used_at = now()
            WHERE user_id = :user_id
              AND purpose = 'password_reset'
              AND used_at IS NULL
            """
        ),
        {"user_id": user.id},
    )
    db.commit()
    return ActionResponse(message="Password updated.")


@router.post("/email-verification/request", response_model=ActionResponse)
def request_email_verification(payload: EmailVerificationRequest, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    message = "If that email needs verification, a verification link has been sent."
    if not email or "@" not in email:
        return ActionResponse(message=message)

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
    if not user or user.is_email_verified:
        return ActionResponse(message=message)

    token = _create_action_token(
        db,
        user_id=user.id,
        purpose="email_verification",
        expires_in=timedelta(hours=24),
    )
    link = _frontend_link("/verify-email", token)
    db.commit()

    send_email(
        to_email=user.email,
        subject="Verify your Recruitr email",
        body=(
            "Verify your Recruitr email by opening this link:\n\n"
            f"{link}\n\n"
            "This link expires in 24 hours."
        ),
    )

    return ActionResponse(message=message, dev_link=_maybe_dev_link(link))


@router.post("/email-verification/confirm", response_model=ActionResponse)
def confirm_email_verification(payload: EmailVerificationConfirmRequest, db: Session = Depends(get_db)):
    user_id = _consume_action_token(db, token=payload.token, purpose="email_verification")
    if not user_id:
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired")

    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=400, detail="Verification link is invalid or expired")

    user.is_email_verified = True
    db.commit()
    return ActionResponse(message="Email verified.")


@router.post("/login", response_model=AuthResponse)
def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
    email = (payload.email or "").strip().lower()
    password = payload.password or ""

    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Enter a valid email address")
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")

    user = db.execute(
        select(User).where(User.email == email)
    ).scalar_one_or_none()

    if not user or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=_build_me_response(db, user, request))


@router.post("/dev-login", response_model=AuthResponse)
def dev_login(payload: DevLoginRequest, request: Request, db: Session = Depends(get_db)):
    """
    Fast shortcut for UI demos: creates (if missing) and logs in a coach/athlete demo account.
    """
    if settings.ENV.lower() not in {"dev", "local", "development"}:
        raise HTTPException(status_code=404, detail="Not found")

    email = f"demo.{payload.role}@example.com"
    password = "demo1234"

    user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()

    if not user:
        role = _get_or_create_role(db, payload.role)

        user = User(
            email=email,
            password_hash=hash_password(password),
            is_active=True,
            is_email_verified=True,
        )
        db.add(user)
        db.flush()

        db.add(UserRole(user_id=user.id, role_id=role.id))

        if payload.role == "coach":
            db.add(
                CoachProfile(
                    user_id=user.id,
                    first_name="Cam",
                    last_name="Wilson",
                    title="Assistant Coach",
                    organization_name="Columbia University",
                    sport="Soccer",
                    level="D1",
                    bio="Demo coach account for Recruitr UI testing.",
                    is_verified_coach=False,
                )
            )
        else:
            _ensure_athlete_profile_row(
                db,
                user_id=user.id,
                email=email,
                first_name="Demo",
                last_name="Athlete",
                sport="soccer",
                bio="Demo athlete account for Recruitr UI testing.",
            )

        db.commit()
        db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    return AuthResponse(access_token=token, user=_build_me_response(db, user, request))


@router.get("/me", response_model=MeResponse)
def me(request: Request, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _build_me_response(db, current_user, request)
