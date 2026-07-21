"""
routers/cfps.py — Public-facing CFP endpoints.

Routes
------
GET  /api/cfps                    Browse & search (NOW supports deadline_from/deadline_to)
GET  /api/cfps/{id}               Full detail (increments view_count)
POST /api/cfps                    Submit a new CFP
PATCH /api/cfps/{id}              Edit own CFP (requires token)
DELETE /api/cfps/{id}             Delete own CFP (requires token)
POST /api/cfps/{id}/extend-deadline   Request a deadline extension
GET  /api/categories              List all categories
"""

import json
from datetime import date
from typing import Optional

import aiosqlite
from fastapi import APIRouter, Depends, HTTPException, Query, Request

from config import Settings, generate_token, get_settings, now_iso, send_submission_email
from database import get_db
from models import (
    CFPBrief, CFPDetail, CFPEdit, CFPSubmit, CFPSubmitResponse,
    CategoryOut, DeadlineExtensionRequest,
)

router = APIRouter()


# ─────────────────────────────────────────────────────────────────────────────
#  Helpers
# ─────────────────────────────────────────────────────────────────────────────

async def _get_cfp_or_404(db: aiosqlite.Connection, cfp_id: int) -> aiosqlite.Row:
    cur = await db.execute("SELECT * FROM cfps WHERE id = ?", (cfp_id,))
    row = await cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="CFP not found")
    return row


async def _get_categories_for_cfp(db: aiosqlite.Connection, cfp_id: int, full: bool = False):
    if full:
        cur = await db.execute(
            """SELECT c.id, c.name, c.slug FROM categories c
               JOIN cfp_categories cc ON cc.category_id = c.id
               WHERE cc.cfp_id = ?""",
            (cfp_id,),
        )
    else:
        cur = await db.execute(
            """SELECT c.name FROM categories c
               JOIN cfp_categories cc ON cc.category_id = c.id
               WHERE cc.cfp_id = ?""",
            (cfp_id,),
        )
    return await cur.fetchall()


async def _log_event(db: aiosqlite.Connection, cfp_id: int, event: str, detail: dict = None):
    await db.execute(
        "INSERT INTO cfp_history (cfp_id, event, detail, happened_at) VALUES (?, ?, ?, ?)",
        (cfp_id, event, json.dumps(detail) if detail else None, now_iso()),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Categories
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/categories", response_model=list[CategoryOut])
async def list_categories(db: aiosqlite.Connection = Depends(get_db)):
    cur = await db.execute("SELECT id, name, slug FROM categories ORDER BY name")
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
#  Browse / search
# ─────────────────────────────────────────────────────────────────────────────

@router.get("", response_model=dict)
async def browse_cfps(
    q: Optional[str] = Query(None, description="Full-text search across title, org, content"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    listing_type: Optional[str] = Query(None, description="Conference | Journal | Announcement"),
    deadline_from: Optional[date] = Query(None, description="Only show CFPs with deadline on or after this date"),
    deadline_to: Optional[date] = Query(None, description="Only show CFPs with deadline on or before this date"),
    sort: str = Query("recent", description="recent | deadline"),
    include_closed: bool = Query(False, description="Include CFPs past their deadline"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: aiosqlite.Connection = Depends(get_db),
):
    """
    Browse approved CFPs with optional filtering, search, and pagination.

    NEW: deadline_from / deadline_to let callers filter to a specific
    submission-deadline window (e.g. "what's due between March 1 and
    April 15?"), independent of the include_closed toggle and independent
    of sort order. Both are optional and can be used together or alone.
    """
    conditions = ["c.status = 'approved'"]
    params: list = []

    if not include_closed:
        conditions.append("c.deadline >= date('now')")

    if q:
        conditions.append("(c.title LIKE ? OR c.organization LIKE ? OR c.content LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]

    if listing_type:
        conditions.append("c.listing_type = ?")
        params.append(listing_type)

    if category:
        conditions.append(
            """EXISTS (
                SELECT 1 FROM cfp_categories cc
                JOIN categories cat ON cat.id = cc.category_id
                WHERE cc.cfp_id = c.id AND cat.slug = ?
            )"""
        )
        params.append(category)

    if deadline_from:
        conditions.append("c.deadline >= ?")
        params.append(deadline_from.isoformat())

    if deadline_to:
        conditions.append("c.deadline <= ?")
        params.append(deadline_to.isoformat())

    where = " AND ".join(conditions)
    order = "c.posted_at DESC" if sort == "recent" else "c.deadline ASC"

    count_cur = await db.execute(f"SELECT COUNT(*) FROM cfps c WHERE {where}", params)
    total = (await count_cur.fetchone())[0]

    offset = (page - 1) * page_size
    cur = await db.execute(
        f"""SELECT c.id, c.title, c.organization, c.deadline, c.listing_type,
                   c.posted_at, c.updated_at, c.status, c.extension_count, c.view_count
            FROM cfps c WHERE {where}
            ORDER BY {order} LIMIT ? OFFSET ?""",
        params + [page_size, offset],
    )
    rows = await cur.fetchall()

    results = []
    for row in rows:
        cats = await _get_categories_for_cfp(db, row["id"], full=False)
        results.append(
            CFPBrief(
                **{k: row[k] for k in ["id","title","organization","deadline",
                                        "listing_type","posted_at","updated_at",
                                        "status","extension_count","view_count"]},
                categories=[r["name"] for r in cats],
            )
        )

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "pages": max(1, -(-total // page_size)),
        "results": [r.model_dump() for r in results],
    }


# ─────────────────────────────────────────────────────────────────────────────
#  Detail
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/{cfp_id}", response_model=CFPDetail)
async def get_cfp(cfp_id: int, db: aiosqlite.Connection = Depends(get_db)):
    row = await _get_cfp_or_404(db, cfp_id)

    if row["status"] not in ("approved", "archived"):
        raise HTTPException(status_code=404, detail="CFP not found")

    await db.execute("UPDATE cfps SET view_count = view_count + 1 WHERE id = ?", (cfp_id,))
    await db.commit()

    cats = await _get_categories_for_cfp(db, cfp_id, full=True)
    return CFPDetail(
        **{k: row[k] for k in ["id","title","organization","contact_email","deadline",
                                 "listing_type","content","posted_at","updated_at",
                                 "status","extension_count","view_count"]},
        categories=[dict(c) for c in cats],
        featured=bool(row["featured"]),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Submit
# ─────────────────────────────────────────────────────────────────────────────

@router.post("", response_model=CFPSubmitResponse, status_code=201)
async def submit_cfp(
    payload: CFPSubmit,
    request: Request,
    db: aiosqlite.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    """
    Submit a new CFP.

    NOTE for demo/stakeholder testing: whether this appears immediately in
    the public browse list depends on REQUIRE_APPROVAL. If true (the safe
    default), it lands in the moderation queue as 'pending' and needs an
    admin approval via admin.html before it's visible. If you want
    stakeholders to see their own test submissions show up instantly while
    trying out the "add a post" flow, set REQUIRE_APPROVAL=false for that
    deployment.
    """
    for cat_id in payload.category_ids:
        cur = await db.execute("SELECT id FROM categories WHERE id = ?", (cat_id,))
        if not await cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Unknown category id: {cat_id}")

    token = generate_token()
    ts = now_iso()
    status = "pending" if settings.require_approval else "approved"

    cur = await db.execute(
        """INSERT INTO cfps
           (title, organization, contact_email, deadline, listing_type, content,
            posted_at, updated_at, status, edit_token, submitter_ip)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            payload.title, payload.organization, str(payload.contact_email),
            payload.deadline.isoformat(), payload.listing_type, payload.content,
            ts, ts, status, token,
            request.client.host if request.client else None,
        ),
    )
    cfp_id = cur.lastrowid

    await db.executemany(
        "INSERT INTO cfp_categories (cfp_id, category_id) VALUES (?, ?)",
        [(cfp_id, cat_id) for cat_id in payload.category_ids],
    )

    await _log_event(db, cfp_id, "submitted", {"title": payload.title})
    await db.commit()

    await send_submission_email(str(payload.contact_email), payload.title, token, cfp_id, settings)

    return CFPSubmitResponse(
        id=cfp_id,
        title=payload.title,
        status=status,
        edit_token=token,
        message=(
            "Your CFP is pending review. You'll receive a confirmation email with "
            "your edit token — keep it safe!"
            if settings.require_approval
            else "Your CFP is now live. Keep your edit token safe!"
        ),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Edit
# ─────────────────────────────────────────────────────────────────────────────

@router.patch("/{cfp_id}", response_model=dict)
async def edit_cfp(cfp_id: int, payload: CFPEdit, db: aiosqlite.Connection = Depends(get_db)):
    row = await _get_cfp_or_404(db, cfp_id)

    if row["edit_token"] != payload.edit_token:
        raise HTTPException(status_code=403, detail="Invalid edit token")

    if row["status"] == "archived":
        raise HTTPException(status_code=400, detail="Archived CFPs cannot be edited")

    updates: dict = {}
    if payload.title is not None:
        updates["title"] = payload.title.strip()
    if payload.organization is not None:
        updates["organization"] = payload.organization.strip()
    if payload.contact_email is not None:
        updates["contact_email"] = str(payload.contact_email)
    if payload.listing_type is not None:
        updates["listing_type"] = payload.listing_type
    if payload.content is not None:
        updates["content"] = payload.content.strip()

    if updates:
        updates["updated_at"] = now_iso()
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        await db.execute(f"UPDATE cfps SET {set_clause} WHERE id = ?", list(updates.values()) + [cfp_id])

    if payload.category_ids is not None:
        for cat_id in payload.category_ids:
            cur = await db.execute("SELECT id FROM categories WHERE id = ?", (cat_id,))
            if not await cur.fetchone():
                raise HTTPException(status_code=400, detail=f"Unknown category id: {cat_id}")
        await db.execute("DELETE FROM cfp_categories WHERE cfp_id = ?", (cfp_id,))
        await db.executemany(
            "INSERT INTO cfp_categories (cfp_id, category_id) VALUES (?, ?)",
            [(cfp_id, cid) for cid in payload.category_ids],
        )

    await _log_event(db, cfp_id, "edited", {"fields_changed": list(updates.keys())})
    await db.commit()

    return {"id": cfp_id, "message": "CFP updated successfully"}


# ─────────────────────────────────────────────────────────────────────────────
#  Delete
# ─────────────────────────────────────────────────────────────────────────────

@router.delete("/{cfp_id}", response_model=dict)
async def delete_cfp(
    cfp_id: int,
    edit_token: str = Query(..., description="Your edit token"),
    db: aiosqlite.Connection = Depends(get_db),
):
    row = await _get_cfp_or_404(db, cfp_id)

    if row["edit_token"] != edit_token:
        raise HTTPException(status_code=403, detail="Invalid edit token")

    await _log_event(db, cfp_id, "deleted", {"title": row["title"]})
    await db.execute("DELETE FROM cfps WHERE id = ?", (cfp_id,))
    await db.commit()

    return {"message": f"CFP '{row['title']}' has been deleted"}


# ─────────────────────────────────────────────────────────────────────────────
#  Deadline extension
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/{cfp_id}/extend-deadline", response_model=dict, status_code=202)
async def request_extension(
    cfp_id: int,
    payload: DeadlineExtensionRequest,
    db: aiosqlite.Connection = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    row = await _get_cfp_or_404(db, cfp_id)

    if row["edit_token"] != payload.edit_token:
        raise HTTPException(status_code=403, detail="Invalid edit token")

    if row["status"] == "archived":
        raise HTTPException(status_code=400, detail="Cannot extend deadline on an archived CFP")

    current_deadline = date.fromisoformat(row["deadline"])
    new_deadline = payload.new_deadline

    if new_deadline <= current_deadline:
        raise HTTPException(
            status_code=400,
            detail=f"New deadline ({new_deadline}) must be after current deadline ({current_deadline})"
        )

    from dateutil.relativedelta import relativedelta
    posted = date.fromisoformat(row["posted_at"][:10])
    max_date = posted + relativedelta(months=settings.max_extension_months)
    if new_deadline > max_date:
        raise HTTPException(
            status_code=400,
            detail=(
                f"New deadline exceeds the maximum allowed extension "
                f"({settings.max_extension_months} months from original post date: {max_date})"
            ),
        )

    ts = now_iso()

    cur = await db.execute(
        """INSERT INTO deadline_extensions
           (cfp_id, original_deadline, requested_deadline, reason, requested_at, status)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (
            cfp_id, row["deadline"], new_deadline.isoformat(),
            payload.reason, ts,
            "pending" if settings.require_extension_approval else "approved",
        ),
    )
    ext_id = cur.lastrowid

    if not settings.require_extension_approval:
        await db.execute(
            "UPDATE cfps SET deadline = ?, updated_at = ?, extension_count = extension_count + 1 WHERE id = ?",
            (new_deadline.isoformat(), ts, cfp_id),
        )
        await db.execute(
            "UPDATE deadline_extensions SET status = 'approved', resolved_at = ? WHERE id = ?",
            (ts, ext_id),
        )
        await _log_event(db, cfp_id, "extended", {
            "from": row["deadline"], "to": new_deadline.isoformat(), "auto_approved": True
        })
        await db.commit()
        return {
            "status": "approved",
            "message": f"Deadline extended to {new_deadline}",
            "new_deadline": new_deadline.isoformat(),
        }

    await _log_event(db, cfp_id, "extension_requested", {
        "requested_deadline": new_deadline.isoformat(),
        "reason": payload.reason,
    })
    await db.commit()

    return {
        "status": "pending",
        "extension_id": ext_id,
        "message": "Your extension request has been submitted for review. You'll be notified once it's processed.",
    }


@router.get("/{cfp_id}/extensions", response_model=list[dict])
async def get_cfp_extensions(
    cfp_id: int,
    edit_token: str = Query(..., description="Your edit token"),
    db: aiosqlite.Connection = Depends(get_db),
):
    row = await _get_cfp_or_404(db, cfp_id)

    if row["edit_token"] != edit_token:
        raise HTTPException(status_code=403, detail="Invalid edit token")

    cur = await db.execute(
        """SELECT id, original_deadline, requested_deadline, reason,
                  requested_at, status, resolved_at
           FROM deadline_extensions WHERE cfp_id = ? ORDER BY requested_at DESC""",
        (cfp_id,),
    )
    rows = await cur.fetchall()
    return [dict(r) for r in rows]
