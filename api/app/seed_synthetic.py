import random
from sqlalchemy import text

from app.db.session import SessionLocal
from app.core.security import hash_password

RANDOM_SEED = 42
SYN_DOMAIN = "synthetic.recruitr.test"  # wipe by domain

STATES = ["NY", "NJ", "CT", "PA", "MA"]
SOCCER_POSITIONS = ["GK", "DF", "MF", "FW"]

COLLEGES_BY_STATE = {
    "NY": ["Columbia University", "New York University", "Cornell University", "Syracuse University", "Stony Brook University", "Fordham University", "RPI"],
    "NJ": ["Rutgers University", "Princeton University", "Seton Hall University", "NJIT", "Stevens Institute of Technology"],
    "CT": ["Yale University", "University of Connecticut", "Quinnipiac University", "Fairfield University", "Wesleyan University"],
    "PA": ["University of Pennsylvania", "Penn State", "University of Pittsburgh", "Temple University", "Villanova University", "Drexel University", "Lehigh University"],
    "MA": ["Harvard University", "MIT", "Northeastern University", "Boston University", "Boston College", "UMass Amherst", "Tufts University"],
}

CLUB_TEAMS = [
    "NYCFC Academy", "Cedar Stars Academy", "Match Fit Academy", "World Class FC",
    "FC Westchester", "PDA Soccer", "FC Delco", "Seacoast United", "NEFC", "Oakwood SC"
]


def ensure_roles(db):
    db.execute(text("""
        INSERT INTO public.roles (key, name)
        VALUES ('coach','Coach'), ('athlete','Athlete'), ('admin','Admin')
        ON CONFLICT (key) DO NOTHING
    """))
    db.commit()


def role_id(db, key: str) -> int:
    return db.execute(text("SELECT id FROM public.roles WHERE key=:k"), {"k": key}).scalar_one()


def create_user(db, email: str, password: str = "password123") -> int:
    uid = db.execute(
        text("""
            INSERT INTO public.users (email, password_hash, is_active, is_email_verified)
            VALUES (:email, :ph, true, true)
            RETURNING id
        """),
        {"email": email.lower().strip(), "ph": hash_password(password)},
    ).scalar_one()
    return uid


def assign_role(db, user_id: int, role_id_val: int):
    db.execute(
        text("""
            INSERT INTO public.user_roles (user_id, role_id)
            VALUES (:u, :r)
            ON CONFLICT DO NOTHING
        """),
        {"u": user_id, "r": role_id_val},
    )


def wipe_synthetic(db):
    # Cascades wipe dependent rows.
    db.execute(text("DELETE FROM public.users WHERE email LIKE :pat"), {"pat": f"%@{SYN_DOMAIN}"})
    db.commit()


def seed_coaches(db, n=10):
    rid = role_id(db, "coach")
    coaches = []
    levels = ["NCAA D1", "NCAA D2", "NCAA D3", "NAIA", "JUCO", "Club", "High School"]

    for i in range(1, n + 1):
        st = random.choice(STATES)
        org = random.choice(COLLEGES_BY_STATE[st])

        uid = create_user(db, f"coach{i}@{SYN_DOMAIN}")
        assign_role(db, uid, rid)

        db.execute(text("""
            INSERT INTO public.coach_profiles
              (user_id, first_name, last_name, title, organization_name, sport, level, bio, is_verified_coach)
            VALUES
              (:uid, :fn, :ln, :title, :org, 'soccer', :lvl, :bio, true)
            ON CONFLICT (user_id) DO NOTHING
        """), {
            "uid": uid,
            "fn": f"Coach{i}",
            "ln": random.choice(["Miller", "Davis", "Wilson", "Garcia", "Nguyen", "Patel", "Brown"]),
            "title": "Assistant Coach" if i % 2 == 0 else "Head Coach",
            "org": org,
            "lvl": random.choice(levels),
            "bio": "Recruiting for the next class. Looking for high-motor, high-IQ players."
        })

        grad_min = random.choice([2027, 2028, 2029])
        grad_max = grad_min + random.choice([1, 2])
        pos_needed = random.sample(SOCCER_POSITIONS, k=random.choice([1, 2]))

        db.execute(text("""
            INSERT INTO public.coach_recruiting_prefs
              (coach_user_id, sport, grad_year_min, grad_year_max, positions_needed, geo_state, radius_mi, level)
            VALUES
              (:uid, 'soccer', :gmin, :gmax, :pos, :st, :rad, :lvl)
            ON CONFLICT (coach_user_id, sport) DO UPDATE
              SET grad_year_min=EXCLUDED.grad_year_min,
                  grad_year_max=EXCLUDED.grad_year_max,
                  positions_needed=EXCLUDED.positions_needed,
                  geo_state=EXCLUDED.geo_state,
                  radius_mi=EXCLUDED.radius_mi,
                  level=EXCLUDED.level,
                  updated_at=now()
        """), {
            "uid": uid,
            "gmin": grad_min,
            "gmax": grad_max,
            "pos": pos_needed,
            "st": st,
            "rad": random.choice([50, 100, 200, 300]),
            "lvl": random.choice(levels),
        })

        coaches.append(uid)

    db.commit()
    return coaches


def seed_athletes(db, n=150):
    rid = role_id(db, "athlete")
    athletes = []

    for i in range(1, n + 1):
        st = random.choice(STATES)
        uid = create_user(db, f"athlete{i}@{SYN_DOMAIN}")
        assign_role(db, uid, rid)

        first = random.choice(["Alex", "Maya", "Jordan", "Sam", "Riley", "Taylor", "Chris", "Avery", "Morgan"])
        last = random.choice(["Reyes", "Chen", "Johnson", "Smith", "Lee", "Martinez", "Kim", "Brown", "Davis"])
        grad_year = random.choice([2027, 2028, 2029, 2030])

        positions = random.sample(SOCCER_POSITIONS, k=random.choice([1, 2]))
        club = random.choice(CLUB_TEAMS)

        db.execute(text("""
            INSERT INTO public.athlete_profiles
              (user_id, first_name, last_name, sport, grad_year, positions, state, country, willing_to_travel,
               travel_radius_mi, club_team, high_school, bio)
            VALUES
              (:uid, :fn, :ln, 'soccer', :gy, :pos, :st, 'USA', :travel, :rad, :club, :hs, :bio)
            ON CONFLICT (user_id) DO NOTHING
        """), {
            "uid": uid,
            "fn": first,
            "ln": last,
            "gy": grad_year,
            "pos": positions,
            "st": st,
            "travel": random.random() < 0.35,
            "rad": random.choice([100, 200, 300, 500]),
            "club": club,
            "hs": f"{st} High School #{random.randint(1, 40)}",
            "bio": "Soccer player. Training hard. Looking for the right fit at the next level."
        })

        athletes.append(uid)

    db.commit()
    return athletes


def seed_tags(db):
    tags = ["soccer", "highlight", "midfield", "striker", "goalkeeper", "defender",
            "classof2027", "classof2028", "classof2029", "classof2030",
            "ny", "nj", "ct", "pa", "ma"]
    for t in tags:
        db.execute(text("""
            INSERT INTO public.tags (slug, display_name)
            VALUES (:s, :d)
            ON CONFLICT (slug) DO NOTHING
        """), {"s": t, "d": t})
    db.commit()


def get_tag_ids(db):
    rows = db.execute(text("SELECT id, slug FROM public.tags")).all()
    return {slug: tid for tid, slug in rows}


def seed_posts_and_media(db, athlete_ids, min_posts=2, max_posts=4):
    tag_ids = get_tag_ids(db)

    for uid in athlete_ids:
        for _ in range(random.randint(min_posts, max_posts)):
            post_id = db.execute(text("""
                INSERT INTO public.posts (author_user_id, sport, caption, visibility)
                VALUES (:uid, 'soccer', :cap, 'public')
                RETURNING id
            """), {
                "uid": uid,
                "cap": random.choice([
                    "New clip from last match ⚽️",
                    "Training highlights — quick feet + first touch",
                    "Game winner and key plays",
                    "Working on speed of play + scanning",
                ])
            }).scalar_one()

            # Always: one ready 30s clip
            db.execute(text("""
                INSERT INTO public.media_assets
                  (owner_user_id, post_id, kind, provider, status, public_url, duration_seconds, meta)
                VALUES
                  (:uid, :pid, 'video', 'local', 'ready', :url, 30, '{}'::jsonb)
            """), {"uid": uid, "pid": post_id, "url": f"https://example.com/videos/{uid}_{post_id}.mp4"})

            # Sometimes: an image
            if random.random() < 0.35:
                db.execute(text("""
                    INSERT INTO public.media_assets
                      (owner_user_id, post_id, kind, provider, status, public_url, meta)
                    VALUES
                      (:uid, :pid, 'image', 'local', 'ready', :url, '{}'::jsonb)
                """), {"uid": uid, "pid": post_id, "url": f"https://example.com/images/{uid}_{post_id}.jpg"})

            # 1–3 tags
            chosen = random.sample(list(tag_ids.keys()), k=random.randint(1, 3))
            for slug in chosen:
                db.execute(text("""
                    INSERT INTO public.post_tags (post_id, tag_id)
                    VALUES (:pid, :tid)
                    ON CONFLICT DO NOTHING
                """), {"pid": post_id, "tid": tag_ids[slug]})

    db.commit()


def seed_statlines(db, athlete_ids, pct=0.6):
    for uid in athlete_ids:
        if random.random() > pct:
            continue
        season = random.choice([2024, 2025])
        matches = random.randint(6, 20)
        minutes = matches * random.randint(30, 90)

        db.execute(text("""
            INSERT INTO public.athlete_statlines_soccer
              (athlete_user_id, season_year, team_name, matches, minutes, goals, assists, source_type)
            VALUES
              (:uid, :yr, :team, :m, :min, :g, :a, :src)
        """), {
            "uid": uid,
            "yr": season,
            "team": random.choice(CLUB_TEAMS),
            "m": matches,
            "min": minutes,
            "g": random.randint(0, 18),
            "a": random.randint(0, 12),
            "src": random.choice(["manual", "upload"])
        })

    db.commit()


def seed_some_interactions(db, coach_ids, athlete_ids):
    # Follows among athletes
    for _ in range(300):
        a = random.choice(athlete_ids)
        b = random.choice(athlete_ids)
        if a == b:
            continue
        db.execute(text("""
            INSERT INTO public.follows (follower_user_id, followee_user_id)
            VALUES (:a, :b)
            ON CONFLICT DO NOTHING
        """), {"a": a, "b": b})

    post_ids = [r[0] for r in db.execute(text("SELECT id FROM public.posts")).all()]

    # Likes (athletes + coaches)
    for _ in range(600):
        db.execute(text("""
            INSERT INTO public.post_likes (post_id, user_id)
            VALUES (:p, :u)
            ON CONFLICT DO NOTHING
        """), {"p": random.choice(post_ids), "u": random.choice(athlete_ids + coach_ids)})

    # Saves (mostly coaches)
    for _ in range(250):
        db.execute(text("""
            INSERT INTO public.post_saves (post_id, user_id)
            VALUES (:p, :u)
            ON CONFLICT DO NOTHING
        """), {"p": random.choice(post_ids), "u": random.choice(coach_ids)})

    # Ensure shortlist list for each coach
    list_ids = {}
    for cid in coach_ids:
        lid = db.execute(text("""
            INSERT INTO public.shortlist_lists (coach_user_id, name)
            VALUES (:c, 'Shortlist')
            RETURNING id
        """), {"c": cid}).scalar_one()
        list_ids[cid] = lid

    for cid in coach_ids:
        lid = list_ids[cid]
        for aid in random.sample(athlete_ids, k=12):
            db.execute(text("""
                INSERT INTO public.shortlist_items (list_id, athlete_user_id, note)
                VALUES (:l, :a, :n)
                ON CONFLICT DO NOTHING
            """), {"l": lid, "a": aid, "n": "Interesting fit — review film."})

    db.commit()


def main():
    random.seed(RANDOM_SEED)
    db = SessionLocal()
    try:
        ensure_roles(db)
        wipe_synthetic(db)

        coach_ids = seed_coaches(db, n=10)
        athlete_ids = seed_athletes(db, n=150)
        seed_tags(db)
        seed_posts_and_media(db, athlete_ids)
        seed_statlines(db, athlete_ids, pct=0.6)
        seed_some_interactions(db, coach_ids, athlete_ids)

        posts = db.execute(text("SELECT count(*) FROM public.posts")).scalar_one()
        print("✅ Seed complete.")
        print(f"Coaches={len(coach_ids)} Athletes={len(athlete_ids)} Posts={posts}")
        print(f"Login example: coach1@{SYN_DOMAIN} / password123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
