"""
routers/rss.py — RSS 2.0 feeds.
"""

from datetime import datetime, timezone
from xml.etree.ElementTree import Element, SubElement, tostring
import xml.dom.minidom

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
import aiosqlite

from config import get_settings, Settings
from database import get_db

router = APIRouter()


def _rss_date(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
        return dt.strftime("%a, %d %b %Y %H:%M:%S +0000")
    except Exception:
        return iso_str


def _build_feed(title: str, description: str, link: str, rows: list, settings: Settings) -> str:
    rss = Element("rss", version="2.0")
    rss.set("xmlns:atom", "http://www.w3.org/2005/Atom")
    channel = SubElement(rss, "channel")

    SubElement(channel, "title").text = title
    SubElement(channel, "link").text = link
    SubElement(channel, "description").text = description
    SubElement(channel, "language").text = "en-us"
    SubElement(channel, "lastBuildDate").text = _rss_date(datetime.now(timezone.utc).isoformat())

    atom_link = SubElement(channel, "atom:link")
    atom_link.set("href", link)
    atom_link.set("rel", "self")
    atom_link.set("type", "application/rss+xml")

    for row in rows:
        item = SubElement(channel, "item")
        SubElement(item, "title").text = row["title"]
        SubElement(item, "link").text = f"{settings.site_url}/cfp/{row['id']}"
        SubElement(item, "guid").text = f"{settings.site_url}/cfp/{row['id']}"
        SubElement(item, "pubDate").text = _rss_date(row["posted_at"])
        SubElement(item, "description").text = (
            f"<![CDATA["
            f"<p><strong>Organization:</strong> {row['organization']}</p>"
            f"<p><strong>Deadline:</strong> {row['deadline']}</p>"
            f"<p><strong>Type:</strong> {row['listing_type']}</p>"
            f"<p>{row['content'][:500]}{'...' if len(row['content']) > 500 else ''}</p>"
            f"]]>"
        )
        if row.get("categories"):
            for cat in row["categories"].split(" | "):
                SubElement(item, "category").text = cat.strip()

    raw = tostring(rss, encoding="unicode", xml_declaration=False)
    pretty = xml.dom.minidom.parseString('<?xml version="1.0" encoding="UTF-8"?>' + raw).toprettyxml(indent="  ")
    return "\n".join(pretty.split("\n"))


async def _fetch_cfps(db: aiosqlite.Connection, extra_where: str = "", params: list = None):
    params = params or []
    cur = await db.execute(
        f"""SELECT c.id, c.title, c.organization, c.deadline, c.listing_type,
                   c.content, c.posted_at,
                   GROUP_CONCAT(cat.name, ' | ') AS categories
            FROM cfps c
            LEFT JOIN cfp_categories cc ON cc.cfp_id = c.id
            LEFT JOIN categories cat ON cat.id = cc.category_id
            WHERE c.status = 'approved' AND c.deadline >= date('now')
            {'AND ' + extra_where if extra_where else ''}
            GROUP BY c.id
            ORDER BY c.posted_at DESC
            LIMIT 50""",
        params,
    )
    return await cur.fetchall()


@router.get("/all", response_class=Response)
async def rss_all(db: aiosqlite.Connection = Depends(get_db), settings: Settings = Depends(get_settings)):
    rows = await _fetch_cfps(db)
    feed = _build_feed(
        title=f"{settings.site_name} — All Listings",
        description="Calls for papers, conference announcements, and journal listings in the humanities.",
        link=f"{settings.site_url}/rss/all",
        rows=[dict(r) for r in rows],
        settings=settings,
    )
    return Response(content=feed, media_type="application/rss+xml")


@router.get("/category/{slug}", response_class=Response)
async def rss_category(slug: str, db: aiosqlite.Connection = Depends(get_db), settings: Settings = Depends(get_settings)):
    cur = await db.execute("SELECT name FROM categories WHERE slug = ?", (slug,))
    cat = await cur.fetchone()
    if not cat:
        raise HTTPException(status_code=404, detail=f"Category '{slug}' not found")

    rows = await _fetch_cfps(
        db,
        extra_where="""EXISTS (
            SELECT 1 FROM cfp_categories cc2
            JOIN categories cat2 ON cat2.id = cc2.category_id
            WHERE cc2.cfp_id = c.id AND cat2.slug = ?
        )""",
        params=[slug],
    )
    feed = _build_feed(
        title=f"{settings.site_name} — {cat['name']}",
        description=f"Calls for papers and announcements in: {cat['name']}",
        link=f"{settings.site_url}/rss/category/{slug}",
        rows=[dict(r) for r in rows],
        settings=settings,
    )
    return Response(content=feed, media_type="application/rss+xml")


@router.get("/type/{listing_type}", response_class=Response)
async def rss_type(listing_type: str, db: aiosqlite.Connection = Depends(get_db), settings: Settings = Depends(get_settings)):
    if listing_type not in ("Conference", "Journal", "Announcement"):
        raise HTTPException(status_code=400, detail="listing_type must be Conference, Journal, or Announcement")

    rows = await _fetch_cfps(db, extra_where="c.listing_type = ?", params=[listing_type])
    feed = _build_feed(
        title=f"{settings.site_name} — {listing_type}s",
        description=f"Humanities {listing_type.lower()} listings from {settings.site_name}.",
        link=f"{settings.site_url}/rss/type/{listing_type}",
        rows=[dict(r) for r in rows],
        settings=settings,
    )
    return Response(content=feed, media_type="application/rss+xml")
