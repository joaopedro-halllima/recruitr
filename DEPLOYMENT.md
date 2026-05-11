# Recruitr Launch Checklist

## Backend

Run these from `api/` during deploy:

```bash
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_required
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Required production env:

```bash
ENV=prod
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=https://your-web-domain.com
ALLOWED_ORIGINS=https://your-web-domain.com
RATE_LIMIT_ENABLED=true
RATE_LIMIT_PER_MINUTE=120
AUTH_RATE_LIMIT_PER_MINUTE=12
MAX_UPLOAD_BYTES=104857600
LOCAL_UPLOAD_DIR=/persistent/recruitr_uploads
```

Email verification and password reset require SMTP:

```bash
EMAIL_FROM=noreply@your-domain.com
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_USERNAME=...
SMTP_PASSWORD=...
SMTP_USE_TLS=true
```

## Frontend

Run these from `web/`:

```bash
npm ci
npm run build
npm run start
```

Required production env:

```bash
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

## Smoke Tests

- `GET /health`
- `GET /health/db`
- Register a new athlete.
- Request a password reset.
- Verify upload presign rejects unsupported MIME types.
- Confirm demo login buttons are hidden and `/api/v1/auth/dev-login` returns 404 in `ENV=prod`.
