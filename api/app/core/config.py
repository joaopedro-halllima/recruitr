from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


API_DIR = Path(__file__).resolve().parents[2]
REPO_ROOT_DIR = API_DIR.parent

class Settings(BaseSettings):
    ENV: str = "dev"
    DATABASE_URL: str
    ALLOWED_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    FRONTEND_URL: str = "http://localhost:3000"

    # auth
    JWT_SECRET: str = "dev_jwt_secret_change_me"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # feed ranking weights (v2)
    FEED_RECENCY_MAX: float = 3.0
    FEED_RECENCY_DAYS_PER_POINT: float = 5.0
    FEED_SOCIAL_MAX: float = 2.5
    FEED_SAVE_MULTIPLIER: float = 2.0
    FEED_MATCH_SPORT_WEIGHT: float = 0.75
    FEED_MATCH_GRAD_YEAR_WEIGHT: float = 1.20
    FEED_MATCH_POSITION_WEIGHT: float = 1.35
    FEED_MATCH_GEO_WEIGHT: float = 0.70
    FEED_FOLLOW_BOOST: float = 0.65
    FEED_DIVERSITY_IMPRESSION_WEIGHT: float = 0.20
    FEED_NEGATIVE_HIDE_WEIGHT: float = 1.25
    FEED_NEGATIVE_REPORT_WEIGHT: float = 2.50
    FEED_NEGATIVE_MAX_PENALTY: float = 6.0
    FEED_EXPLORATION_WINDOW_DAYS: int = 14
    FEED_EXPLORATION_PROBABILITY: float = 0.15
    FEED_EXPLORATION_BOOST: float = 0.90

    # existing required keys (keep yours)
    MINIO_ENDPOINT: str = "localhost:9000"
    MINIO_ACCESS_KEY: str = "minioadmin"
    MINIO_SECRET_KEY: str = "minioadmin"
    LOCAL_UPLOAD_DIR: str = "/tmp/recruitr_uploads"
    MEILI_URL: str | None = None
    MEILI_MASTER_KEY: str | None = None

    # realtime (Centrifugo-ready; disabled by default)
    REALTIME_ENABLED: bool = False
    CENTRIFUGO_URL: str | None = None
    CENTRIFUGO_API_KEY: str | None = None

    # email
    EMAIL_FROM: str = "noreply@recruitr.local"
    SMTP_HOST: str | None = None
    SMTP_PORT: int = 587
    SMTP_USERNAME: str | None = None
    SMTP_PASSWORD: str | None = None
    SMTP_USE_TLS: bool = True

    # request/upload safety
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 120
    AUTH_RATE_LIMIT_PER_MINUTE: int = 12
    MAX_UPLOAD_BYTES: int = 100 * 1024 * 1024

    @property
    def allowed_origins(self) -> list[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    model_config = SettingsConfigDict(
        # Support running API from either repo root or `api/` dir.
        env_file=(API_DIR / ".env", REPO_ROOT_DIR / ".env", ".env"),
        extra="ignore",
        case_sensitive=True,
    )

settings = Settings()
