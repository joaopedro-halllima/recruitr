from fastapi import FastAPI
from fastapi import Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.api.routes.auth import router as auth_router
from app.api.routes.leads import router as leads_router
from app.api.routes.feed import router as feed_router  # NEW
from app.api.routes.comments import router as comments_router
from app.api.routes.dm import router as dm_router
from app.api.routes.notifications import router as notifications_router
from app.api.routes.uploads import router as uploads_router
from app.api.routes.profile import coach_router as coach_profile_router
from app.api.routes.profile import router as profile_router
from app.api.routes.directory import router as directory_router
from app.api.routes.posts import router as posts_router
from app.api.routes.shortlists import router as shortlists_router
from app.api.routes.moderation import router as moderation_router
from app.api.routes.search import router as search_router
from app.api.routes.schools import router as schools_router
from app.api.routes.coach_verification import router as coach_verification_router
from app.api.routes.metrics import router as metrics_router

from app.core.config import settings
from app.db.session import engine
from app.services.rate_limit import rate_limiter

app = FastAPI(title="Recruitr API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def rate_limit_requests(request: Request, call_next):
    if not settings.RATE_LIMIT_ENABLED:
        return await call_next(request)

    path = request.url.path
    if path in {"/health", "/health/db"}:
        return await call_next(request)

    client_host = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if not client_host and request.client:
        client_host = request.client.host
    client_host = client_host or "unknown"

    is_auth_path = path.startswith("/api/v1/auth")
    limit = settings.AUTH_RATE_LIMIT_PER_MINUTE if is_auth_path else settings.RATE_LIMIT_PER_MINUTE
    key = f"{client_host}:{'auth' if is_auth_path else 'api'}"
    result = rate_limiter.check(key=key, limit=limit, window_seconds=60)
    if not result.allowed:
        return JSONResponse(
            status_code=429,
            content={"detail": "Too many requests. Please try again shortly."},
            headers={"Retry-After": str(result.retry_after_seconds)},
        )

    return await call_next(request)

@app.get("/")
def root():
    return {"message": "Recruitr API is running"}

@app.get("/health")
def health():
    return {
        "status": "ok",
        "env": getattr(settings, "ENV", "dev"),
        "meili": getattr(settings, "MEILI_URL", None),
        "minio_bucket": getattr(settings, "MINIO_BUCKET", None),
    }

@app.get("/health/db")
def health_db():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1")).scalar()
    return {"status": "ok", "db": result}

# Routers (each router defines its own prefix)
app.include_router(auth_router)   # /api/v1/auth/...
app.include_router(leads_router)  # /api/v1/leads/...
app.include_router(feed_router)   # /api/v1/feed
app.include_router(comments_router)  # /api/v1/feed comments
app.include_router(dm_router)     # /api/v1/dm
app.include_router(notifications_router)  # /api/v1/notifications
app.include_router(uploads_router)  # /api/v1/uploads
app.include_router(profile_router)  # /api/v1/athlete-profile
app.include_router(coach_profile_router)  # /api/v1/coach-profile
app.include_router(directory_router)  # /api/v1/directory
app.include_router(posts_router)  # /api/v1/posts
app.include_router(shortlists_router)  # /api/v1/shortlists
app.include_router(moderation_router)  # /api/v1/moderation
app.include_router(search_router)  # /api/v1/search, /api/v1/autocomplete
app.include_router(schools_router)  # /api/v1/schools, /api/v1/teams
app.include_router(coach_verification_router)  # /api/v1/coach-verification
app.include_router(metrics_router)  # /api/v1/metrics
