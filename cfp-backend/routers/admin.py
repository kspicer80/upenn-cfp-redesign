"""
routers/admin.py — Moderation and administration endpoints.
All routes require the ADMIN_KEY header or query param.
"""

from fastapi import APIRouter, Depends, HTTPException, Header, Query
import aiosqlite

from config import get_settings, now_iso, Settings
from database import get_db
from models import AdminAction, AdminExtensionAction

router = APIRouter()


async def require_admin(
    x_admin_key: str = Header(None, alias="X-Admin-Key"),
    admin_key: str = Query(None),
    settings: Settings = Depends(get_settings),
):
    key = x_admin_key or admin_key
    if not key or key != settings.admin_key:
        raise HTTPException(status_code=401, detail="Invalid or missing admin key")
    return key


@router.get("/queue")
async def moderation_queue(_: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT c.id, c.title, c.organization, c.contact_email, c.deadline,
                  c.listing_type, c.posted_at, c.content,
                  GROUP_CONCAT(cat.name, ' | ') AS categories
           FROM cfps c
           LEFT JOIN cfp_categories cc ON cc.cfp_id = c.id
           LEFT JOIN categories cat ON cat.id = cc.category_id
           WHERE c.status = 'pending'
           GROUP BY c.id
           ORDER BY c.posted_at ASC"""
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/cfps/{cfp_id}/approve")
async def approve_cfp(cfp_id: int, payload: AdminAction, _: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, status, title FROM cfps WHERE id = ?", (cfp_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="CFP not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"CFP is already '{row['status']}'")

    ts = now_iso()
    await db.execute("UPDATE cfps SET status = 'approved', notes = ?, updated_at = ? WHERE id = ?", (payload.notes, ts, cfp_id))
    await db.execute("INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, 'approved', ?, ?)", (cfp_id, payload.notes, ts))
    await db.commit()
    return {"id": cfp_id, "title": row["title"], "status": "approved"}


@router.post("/cfps/{cfp_id}/reject")
async def reject_cfp(cfp_id: int, payload: AdminAction, _: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, status, title FROM cfps WHERE id = ?", (cfp_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="CFP not found")
    if row["status"] not in ("pending",):
        raise HTTPException(status_code=400, detail=f"Cannot reject a CFP with status '{row['status']}'")

    ts = now_iso()
    await db.execute("UPDATE cfps SET status = 'rejected', notes = ?, updated_at = ? WHERE id = ?", (payload.notes, ts, cfp_id))
    await db.execute("INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, 'rejected', ?, ?)", (cfp_id, payload.notes, ts))
    await db.commit()
    return {"id": cfp_id, "title": row["title"], "status": "rejected"}


@router.post("/cfps/{cfp_id}/archive")
async def archive_cfp(cfp_id: int, payload: AdminAction, _: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, status, title FROM cfps WHERE id = ?", (cfp_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="CFP not found")

    ts = now_iso()
    await db.execute("UPDATE cfps SET status = 'archived', updated_at = ? WHERE id = ?", (ts, cfp_id))
    await db.execute("INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, 'archived', ?, ?)", (cfp_id, payload.notes, ts))
    await db.commit()
    return {"id": cfp_id, "title": row["title"], "status": "archived"}


@router.get("/extensions")
async def pending_extensions(_: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute(
        """SELECT de.id, de.cfp_id, c.title AS cfp_title,
                  de.original_deadline, de.requested_deadline,
                  de.reason, de.requested_at, de.status
           FROM deadline_extensions de
           JOIN cfps c ON c.id = de.cfp_id
           WHERE de.status = 'pending'
           ORDER BY de.requested_at ASC"""
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


@router.post("/extensions/{ext_id}/resolve")
async def resolve_extension(ext_id: int, payload: AdminExtensionAction, _: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT * FROM deadline_extensions WHERE id = ?", (ext_id,))
    ext = await cur.fetchone()
    if not ext:
        raise HTTPException(status_code=404, detail="Extension request not found")
    if ext["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Extension is already '{ext['status']}'")

    ts = now_iso()
    new_status = "approved" if payload.approved else "rejected"

    await db.execute(
        "UPDATE deadline_extensions SET status = ?, resolved_at = ?, resolved_by = ? WHERE id = ?",
        (new_status, ts, payload.notes or "admin", ext_id),
    )

    if payload.approved:
        await db.execute(
            "UPDATE cfps SET deadline = ?, updated_at = ?, extension_count = extension_count + 1 WHERE id = ?",
            (ext["requested_deadline"], ts, ext["cfp_id"]),
        )
        await db.execute(
            "INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, 'extended', ?, ?)",
            (ext["cfp_id"], f"Deadline extended from {ext['original_deadline']} to {ext['requested_deadline']}", ts),
        )

    await db.commit()
    return {
        "extension_id": ext_id,
        "cfp_id": ext["cfp_id"],
        "status": new_status,
        "new_deadline": ext["requested_deadline"] if payload.approved else None,
    }


@router.get("/stats")
async def site_stats(_: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    queries = {
        "total_cfps": "SELECT COUNT(*) FROM cfps",
        "pending": "SELECT COUNT(*) FROM cfps WHERE status = 'pending'",
        "approved": "SELECT COUNT(*) FROM cfps WHERE status = 'approved'",
        "rejected": "SELECT COUNT(*) FROM cfps WHERE status = 'rejected'",
        "archived": "SELECT COUNT(*) FROM cfps WHERE status = 'archived'",
        "active": "SELECT COUNT(*) FROM cfps WHERE status = 'approved' AND deadline >= date('now')",
        "closed": "SELECT COUNT(*) FROM cfps WHERE status = 'approved' AND deadline < date('now')",
        "pending_extensions": "SELECT COUNT(*) FROM deadline_extensions WHERE status = 'pending'",
        "total_views": "SELECT COALESCE(SUM(view_count), 0) FROM cfps",
    }
    stats = {}
    for key, query in queries.items():
        cur = await db.execute(query)
        stats[key] = (await cur.fetchone())[0]

    cur = await db.execute(
        """SELECT cat.name, COUNT(*) AS count
           FROM cfp_categories cc
           JOIN categories cat ON cat.id = cc.category_id
           JOIN cfps c ON c.id = cc.cfp_id
           WHERE c.status = 'approved'
           GROUP BY cat.id ORDER BY count DESC LIMIT 10"""
    )
    stats["top_categories"] = [dict(r) for r in await cur.fetchall()]
    return stats


@router.get("/history/{cfp_id}")
async def cfp_history(cfp_id: int, _: str = Depends(require_admin), db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id FROM cfps WHERE id = ?", (cfp_id,))
    if not await cur.fetchone():
        raise HTTPException(status_code=404, detail="CFP not found")

    cur = await db.execute(
        "SELECT event, detail, happened_at FROM cfp_history WHERE cfp_id = ? ORDER BY happened_at ASC",
        (cfp_id,),
    )
    return [dict(r) for r in await cur.fetchall()]
