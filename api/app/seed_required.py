from __future__ import annotations

from sqlalchemy import text

from app.db.session import SessionLocal


REQUIRED_ROLES = [
    ("coach", "Coach"),
    ("athlete", "Athlete"),
    ("admin", "Admin"),
]


def main() -> None:
    with SessionLocal() as db:
        for key, name in REQUIRED_ROLES:
            db.execute(
                text(
                    """
                    INSERT INTO public.roles (key, name)
                    VALUES (:key, :name)
                    ON CONFLICT (key) DO UPDATE
                    SET name = EXCLUDED.name
                    """
                ),
                {"key": key, "name": name},
            )
        db.commit()

    print("Seeded required Recruitr roles.")


if __name__ == "__main__":
    main()
