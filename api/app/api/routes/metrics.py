from fastapi import APIRouter, Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.deps import get_db

router = APIRouter(prefix="/api/v1/metrics", tags=["metrics"])

optional_bearer = HTTPBearer(auto_error=False)
ACTIVE_USERS_WINDOW_DAYS = 30
_page_views_schema_ready = False


class MetricsResponse(BaseModel):
    signups: int
    active_users: int
    waitlisted: int
    pageviews: int
    active_users_window_days: int = ACTIVE_USERS_WINDOW_DAYS


class PageViewPayload(BaseModel):
    path: str
    visitor_id: str | None = None
    referrer: str | None = None
    title: str | None = None


def _ensure_page_views_schema(db: Session) -> None:
    global _page_views_schema_ready
    if _page_views_schema_ready:
        return

    db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS public.page_views (
              id BIGSERIAL PRIMARY KEY,
              path TEXT NOT NULL,
              visitor_id VARCHAR(128),
              user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
              referrer TEXT,
              title VARCHAR(255),
              created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_page_views_created_at
            ON public.page_views (created_at DESC)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_page_views_user_id
            ON public.page_views (user_id)
            """
        )
    )
    db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_page_views_path
            ON public.page_views (path)
            """
        )
    )
    db.commit()
    _page_views_schema_ready = True


def _extract_user_id(credentials: HTTPAuthorizationCredentials | None) -> int | None:
    if not credentials or not credentials.credentials:
        return None

    payload = decode_access_token(credentials.credentials)
    if not payload:
        return None

    try:
        return int(payload.get("sub"))
    except (TypeError, ValueError):
        return None


@router.get("", response_model=MetricsResponse)
def get_metrics(db: Session = Depends(get_db)):
    _ensure_page_views_schema(db)

    signups = int(db.execute(text("SELECT COUNT(*)::int FROM public.users")).scalar() or 0)
    waitlisted = int(db.execute(text("SELECT COUNT(*)::int FROM public.leads")).scalar() or 0)
    pageviews = int(db.execute(text("SELECT COUNT(*)::int FROM public.page_views")).scalar() or 0)
    active_users = int(
        db.execute(
            text(
                """
                SELECT COUNT(*)::int
                FROM (
                  SELECT DISTINCT pv.user_id AS user_id
                  FROM public.page_views pv
                  WHERE pv.user_id IS NOT NULL
                    AND pv.created_at >= now() - make_interval(days => CAST(:window_days AS int))
                  UNION
                  SELECT DISTINCT fe.viewer_user_id AS user_id
                  FROM public.feed_events fe
                  WHERE fe.viewer_user_id IS NOT NULL
                    AND fe.created_at >= now() - make_interval(days => CAST(:window_days AS int))
                ) active_users
                """
            ),
            {"window_days": ACTIVE_USERS_WINDOW_DAYS},
        ).scalar()
        or 0
    )

    return MetricsResponse(
        signups=signups,
        active_users=active_users,
        waitlisted=waitlisted,
        pageviews=pageviews,
    )


@router.post("/pageview")
def create_pageview(
    payload: PageViewPayload,
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(optional_bearer),
    db: Session = Depends(get_db),
):
    _ensure_page_views_schema(db)

    path = (payload.path or "/").strip() or "/"
    if len(path) > 2048:
        path = path[:2048]

    visitor_id = (payload.visitor_id or "").strip() or None
    if visitor_id and len(visitor_id) > 128:
        visitor_id = visitor_id[:128]

    referrer = (payload.referrer or request.headers.get("referer") or "").strip() or None
    title = (payload.title or "").strip() or None
    if title and len(title) > 255:
        title = title[:255]

    db.execute(
        text(
            """
            INSERT INTO public.page_views (path, visitor_id, user_id, referrer, title)
            VALUES (:path, :visitor_id, :user_id, :referrer, :title)
            """
        ),
        {
            "path": path,
            "visitor_id": visitor_id,
            "user_id": _extract_user_id(credentials),
            "referrer": referrer,
            "title": title,
        },
    )
    db.commit()

    return {"ok": True}
