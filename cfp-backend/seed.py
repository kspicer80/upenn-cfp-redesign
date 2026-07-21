"""
seed.py — Manually populate the database with realistic test data.

For LOCAL dev or paid hosting with persistent storage. On Render's free
tier this isn't needed day-to-day — database.py's init_db() now auto-seeds
on every startup if the cfps table is empty (see AUTO_SEED_DEMO_DATA in
config.py). This script is still useful for local testing or for forcing
a clean re-seed with --force.

Run:
    conda activate cfpcommons
    python seed.py            # skips if data already exists
    python seed.py --force    # wipes and re-seeds
"""

import asyncio
import sys
from datetime import date, timedelta

import aiosqlite

from config import generate_token
from database import DB_PATH, init_db
from seed_data import SEED_CFPS


async def seed():
    force = "--force" in sys.argv

    await init_db()

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        await db.execute("PRAGMA foreign_keys=ON")

        cur = await db.execute("SELECT COUNT(*) FROM cfps")
        count = (await cur.fetchone())[0]

        if count > 0 and not force:
            print(f"Database already has {count} CFP(s). Use --force to wipe and re-seed.")
            print("(Note: init_db() already auto-seeds on first startup if AUTO_SEED_DEMO_DATA=true —")
            print(" this script is mainly for forcing a fresh reset during local testing.)")
            return

        if force and count > 0:
            print(f"--force: deleting {count} existing CFP(s)…")
            await db.execute("DELETE FROM cfp_categories")
            await db.execute("DELETE FROM cfps")
            await db.execute("DELETE FROM sqlite_sequence WHERE name='cfps'")
            await db.commit()

        cur = await db.execute("SELECT id, slug FROM categories")
        slug_to_id = {r["slug"]: r["id"] for r in await cur.fetchall()}

        inserted = 0
        for title, org, email, days, ltype, content, slugs in SEED_CFPS:
            deadline = (date.today() + timedelta(days=days)).isoformat()
            posted_offset = len(SEED_CFPS) - inserted
            posted = (date.today() - timedelta(days=posted_offset)).isoformat() + "T12:00:00+00:00"
            token = generate_token()

            cur = await db.execute(
                """INSERT INTO cfps
                   (title, organization, contact_email, deadline, listing_type,
                    content, posted_at, updated_at, status, edit_token)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (title, org, email, deadline, ltype, content, posted, posted, "approved", token),
            )
            cfp_id = cur.lastrowid

            cat_ids = [slug_to_id[s] for s in slugs if s in slug_to_id]
            missing = [s for s in slugs if s not in slug_to_id]
            if missing:
                print(f"  ⚠  Unknown slug(s) for '{title}': {missing}")

            await db.executemany(
                "INSERT INTO cfp_categories (cfp_id, category_id) VALUES (?,?)",
                [(cfp_id, cid) for cid in cat_ids],
            )
            await db.execute(
                "INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?,?,?,?)",
                (cfp_id, "submitted", f"Seeded: {title}", posted),
            )

            print(f"  ✓  [{ltype:12}]  {title[:60]}")
            print(f"         token: {token}")
            print(f"         id:    {cfp_id}  deadline: {deadline}")
            print()
            inserted += 1

        await db.commit()
        print(f"Done — {inserted} CFPs seeded.")
        print("Tip: copy a token above and use it in the Manage view to test editing/extensions.")


if __name__ == "__main__":
    asyncio.run(seed())
