# Recruitr

Recruitr is a full-stack sports recruiting web app for coaches and athletes. It combines a highlight-style recruiting feed, athlete and coach profiles, school/team discovery, shortlists, messaging, notifications, uploads, moderation tools, metrics, and launch-ready auth flows.

## Current Status

This repo is in release-stabilization for a private reviewer launch.

Working now:
- Next.js web app with dashboard, feed, profiles, search/explore, schools, shortlists, messages, notifications, metrics, login/signup, password reset, and email verification pages.
- FastAPI backend with PostgreSQL, SQLAlchemy, Alembic migrations, JWT auth, profile/feed/post/comment/message/search/school/upload/moderation/metrics routes.
- Local upload sessions with file type and size validation.
- Rate limiting middleware for API/auth traffic.
- Required role seeding script.
- Deployment checklist in `DEPLOYMENT.md`.

Still required before reviewer traffic:
- Configure production Postgres, SMTP, and persistent upload storage.
- Set production environment variables.
- Run a production smoke test.
- Add reviewer accounts/sample data.

## Tech Stack

Frontend:
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4

Backend:
- Python 3.12
- FastAPI
- SQLAlchemy 2
- Alembic
- PostgreSQL
- Pydantic settings

Local support services:
- PostgreSQL
- Redis
- Meilisearch
- MinIO-compatible local object service
- Centrifugo config for realtime experiments

## Repository Layout

```text
api/                  FastAPI backend
  app/
  alembic/
  requirements.txt
web/                  Next.js frontend
data/                 sample/import data
docs/                 product/build docs
infra/                local service config
docker-compose.yml    local support services
DEPLOYMENT.md         launch checklist
```

## Local Development

Start support services if using Docker:

```bash
docker compose up -d
```

Apply migrations and seed required roles:

```bash
cd api
.venv/bin/python -m alembic upgrade head
.venv/bin/python -m app.seed_required
```

Run the API:

```bash
cd api
.venv/bin/python -m uvicorn app.main:app --host 127.0.0.1 --port 8001
```

Run the web app:

```bash
cd web
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open:
- Web: `http://127.0.0.1:3000`
- API health: `http://127.0.0.1:8001/health`
- DB health: `http://127.0.0.1:8001/health/db`

## Validation

Frontend:

```bash
cd web
npm run lint
npm run build
```

Backend:

```bash
cd api
.venv/bin/python -m compileall -q app
.venv/bin/python -m alembic heads
```

## Production Deploy

See `DEPLOYMENT.md` for the launch checklist. Minimum production setup needs:

```bash
ENV=prod
DATABASE_URL=postgresql+psycopg://...
JWT_SECRET=...
FRONTEND_URL=https://your-web-domain.com
ALLOWED_ORIGINS=https://your-web-domain.com
NEXT_PUBLIC_API_BASE_URL=https://your-api-domain.com
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
SMTP_HOST=...
SMTP_USERNAME=...
SMTP_PASSWORD=...
LOCAL_UPLOAD_DIR=/persistent/recruitr_uploads
```

Backend deploy commands:

```bash
pip install -r requirements.txt
python -m alembic upgrade head
python -m app.seed_required
uvicorn app.main:app --host 0.0.0.0 --port "$PORT"
```

Frontend deploy commands:

```bash
npm ci
npm run build
npm run start
```
