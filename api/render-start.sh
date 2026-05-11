#!/usr/bin/env bash
set -e

# Render provides postgres:// but psycopg needs postgresql+psycopg://
if [[ "$DATABASE_URL" == postgres://* ]]; then
  export DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgres://}"
  echo "Converted DATABASE_URL to psycopg format"
elif [[ "$DATABASE_URL" == postgresql://* ]]; then
  export DATABASE_URL="postgresql+psycopg://${DATABASE_URL#postgresql://}"
  echo "Converted DATABASE_URL to psycopg format"
fi

echo "Running migrations..."
python -m alembic upgrade head

echo "Seeding required data..."
python -m app.seed_required

echo "Starting API server on port ${PORT:-8001}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8001}"
