"""
database.py — SQLite schema + connection helpers.

CHANGED FOR FREE-TIER HOSTING:
Render's free instance type has no persistent disk, so the entire SQLite
file is wiped on every redeploy and every time the service spins back up
from an idle sleep. Rather than needing to SSH in and manually re-run
seed.py after every wake-up, init_db() now auto-seeds sample CFPs itself
whenever it finds the cfps table empty. Controlled by AUTO_SEED_DEMO_DATA
in config — flip it to false once this stops being a demo (e.g. after
moving to a paid plan with a persistent disk, or Postgres).
"""

import aiosqlite
from datetime import date, timedelta
from pathlib import Path

from config import generate_token, now_iso, get_settings
from seed_data import SEED_CFPS

DB_PATH = Path(__file__).parent / "cfp_commons.db"


async def get_db() -> aiosqlite.Connection:
    """Dependency: yields an open DB connection with row_factory set."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")   # safe concurrent reads
        await db.execute("PRAGMA foreign_keys=ON")
        yield db


async def init_db():
    """Create all tables on startup if they don't already exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA journal_mode=WAL")
        await db.execute("PRAGMA foreign_keys=ON")

        # ------------------------------------------------------------------ #
        #  Core CFP table                                                      #
        # ------------------------------------------------------------------ #
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cfps (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                title           TEXT    NOT NULL,
                organization    TEXT    NOT NULL,
                contact_email   TEXT    NOT NULL,
                deadline        TEXT    NOT NULL,   -- ISO date: YYYY-MM-DD
                listing_type    TEXT    NOT NULL DEFAULT 'Conference',
                                                    -- Conference | Journal | Announcement
                content         TEXT    NOT NULL,
                posted_at       TEXT    NOT NULL,   -- ISO datetime
                updated_at      TEXT    NOT NULL,
                status          TEXT    NOT NULL DEFAULT 'pending',
                                                    -- pending | approved | rejected | archived
                edit_token      TEXT    NOT NULL UNIQUE,  -- secret sent to submitter
                submitter_ip    TEXT,               -- optional, for spam control
                notes           TEXT,               -- internal mod notes
                featured        INTEGER NOT NULL DEFAULT 0,
                view_count      INTEGER NOT NULL DEFAULT 0,
                extension_count INTEGER NOT NULL DEFAULT 0
            )
        """)

        # ------------------------------------------------------------------ #
        #  Categories (controlled vocabulary)                                  #
        # ------------------------------------------------------------------ #
        await db.execute("""
            CREATE TABLE IF NOT EXISTS categories (
                id   INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT    NOT NULL UNIQUE,
                slug TEXT    NOT NULL UNIQUE
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS cfp_categories (
                cfp_id      INTEGER NOT NULL REFERENCES cfps(id) ON DELETE CASCADE,
                category_id INTEGER NOT NULL REFERENCES categories(id),
                PRIMARY KEY (cfp_id, category_id)
            )
        """)

        # ------------------------------------------------------------------ #
        #  Deadline extensions                                                 #
        # ------------------------------------------------------------------ #
        await db.execute("""
            CREATE TABLE IF NOT EXISTS deadline_extensions (
                id                INTEGER PRIMARY KEY AUTOINCREMENT,
                cfp_id            INTEGER NOT NULL REFERENCES cfps(id) ON DELETE CASCADE,
                original_deadline TEXT    NOT NULL,
                requested_deadline TEXT   NOT NULL,
                reason            TEXT,
                requested_at      TEXT    NOT NULL,
                status            TEXT    NOT NULL DEFAULT 'pending',
                resolved_at       TEXT,
                resolved_by       TEXT
            )
        """)

        # ------------------------------------------------------------------ #
        #  Audit log                                                            #
        # ------------------------------------------------------------------ #
        await db.execute("""
            CREATE TABLE IF NOT EXISTS cfp_history (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                cfp_id      INTEGER NOT NULL REFERENCES cfps(id) ON DELETE CASCADE,
                event       TEXT    NOT NULL,
                detail      TEXT,
                happened_at TEXT    NOT NULL
            )
        """)

        # ------------------------------------------------------------------ #
        #  Site announcements stub                                             #
        # ------------------------------------------------------------------ #
        await db.execute("""
            CREATE TABLE IF NOT EXISTS announcements (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                message     TEXT    NOT NULL,
                severity    TEXT    NOT NULL DEFAULT 'info',
                active      INTEGER NOT NULL DEFAULT 1,
                created_at  TEXT    NOT NULL
            )
        """)

        # ------------------------------------------------------------------ #
        #  Seed categories if table is empty                                   #
        # ------------------------------------------------------------------ #
        cur = await db.execute("SELECT COUNT(*) FROM categories")
        row = await cur.fetchone()
        if row[0] == 0:
            categories = [
                ("African-American", "african-american"),
                ("American", "american"),
                ("Awards", "awards"),
                ("Bibliography & History of the Book", "bibliography-and-history-of-the-book"),
                ("Children's Literature", "childrens-literature"),
                ("Classical Studies", "classical-studies"),
                ("Cultural Studies & Historical Approaches", "cultural-studies-and-historical-approaches"),
                ("Ecocriticism & Environmental Studies", "ecocriticism-and-environmental-studies"),
                ("Eighteenth Century", "eighteenth-century"),
                ("English Education", "english-education"),
                ("Ethnicity & National Identity", "ethnicity-and-national-identity"),
                ("Fan Studies & Fandom", "fan-studies-and-fandom"),
                ("Film & Television", "film-and-television"),
                ("Gender Studies & Sexuality", "gender-studies-and-sexuality"),
                ("General Announcements", "general-announcements"),
                ("Graduate Conferences", "graduate-conferences"),
                ("Humanities Computing & the Internet", "humanities-computing-and-the-internet"),
                ("Interdisciplinary", "interdisciplinary"),
                ("International Conferences", "international-conferences"),
                ("Journals & Collections of Essays", "journals-and-collections-of-essays"),
                ("Medieval", "medieval"),
                ("Modernist Studies", "modernist-studies"),
                ("Online Conferences", "online-conferences"),
                ("Pedagogy", "pedagogy"),
                ("Poetry", "poetry"),
                ("Popular Culture", "popular-culture"),
                ("Postcolonial", "postcolonial"),
                ("Professional Topics", "professional-topics"),
                ("Religion", "religion"),
                ("Renaissance", "renaissance"),
                ("Rhetoric & Composition", "rhetoric-and-composition"),
                ("Romantic", "romantic"),
                ("Science & Culture", "science-and-culture"),
                ("Theatre & Performance Studies", "theatre-and-performance-studies"),
                ("Theory", "theory"),
                ("Translation Studies", "translation-studies"),
                ("Travel Writing", "travel-writing"),
                ("Twentieth Century & Beyond", "twentieth-century-and-beyond"),
                ("Veterans Studies", "veterans-studies"),
                ("Victorian", "victorian"),
                ("World Literatures & Indigenous Studies", "world-literatures-and-indigenous-studies"),
            ]
            await db.executemany(
                "INSERT INTO categories (name, slug) VALUES (?, ?)", categories
            )
            await db.commit()
            print("[startup] Seeded 41 categories (fresh database)")

        # ------------------------------------------------------------------ #
        #  NEW: Auto-seed sample CFPs if the table is empty AND the setting  #
        #  is enabled. This is what makes the free tier self-healing after   #
        #  every cold-start wipe, with no manual re-seeding step required.   #
        # ------------------------------------------------------------------ #
        settings = get_settings()
        if settings.auto_seed_demo_data:
            cur = await db.execute("SELECT COUNT(*) FROM cfps")
            cfp_count = (await cur.fetchone())[0]

            if cfp_count == 0:
                cur = await db.execute("SELECT id, slug FROM categories")
                slug_to_id = {r["slug"]: r["id"] for r in await cur.fetchall()}

                inserted = 0
                for i, (title, org, email, days, ltype, content, slugs) in enumerate(SEED_CFPS):
                    deadline = (date.today() + timedelta(days=days)).isoformat()
                    posted_offset = len(SEED_CFPS) - i
                    posted = (date.today() - timedelta(days=posted_offset)).isoformat() + "T12:00:00+00:00"
                    token = generate_token()

                    cur2 = await db.execute(
                        """INSERT INTO cfps
                           (title, organization, contact_email, deadline, listing_type,
                            content, posted_at, updated_at, status, edit_token)
                           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                        (title, org, email, deadline, ltype, content, posted, posted, "approved", token),
                    )
                    cfp_id = cur2.lastrowid

                    cat_ids = [slug_to_id[s] for s in slugs if s in slug_to_id]
                    await db.executemany(
                        "INSERT INTO cfp_categories (cfp_id, category_id) VALUES (?, ?)",
                        [(cfp_id, cid) for cid in cat_ids],
                    )
                    await db.execute(
                        "INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, ?, ?, ?)",
                        (cfp_id, "submitted", f"Auto-seeded on startup: {title}", posted),
                    )
                    inserted += 1

                await db.commit()
                print(f"[startup] Auto-seeded {inserted} demo CFPs "
                      f"(AUTO_SEED_DEMO_DATA=true — set to false once this is a real site)")

        await db.commit()
