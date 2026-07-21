# CFP Commons — Redesign Prototype

A full-stack redesign prototype for call-for-papers.sas.upenn.edu, built as a
demo to propose to the site owners. Stack: **FastAPI + SQLite** (backend) and
**React + Vite** (frontend).

---

## Folder structure

Place the entire project inside your `upenn_cfp_redesign` folder on the Desktop:

```
upenn_cfp_redesign/
│
├── start.sh                 ← Run this to launch everything locally
├── admin.html               ← Admin panel (open directly in browser)
├── README.md                ← This file
├── .gitignore
│
├── cfp-backend/             ── Python / FastAPI ──────────────────────────────
│   ├── main.py
│   ├── database.py          ← Auto-seeds sample CFPs on empty DB (see below)
│   ├── models.py
│   ├── config.py            ← Settings, incl. AUTO_SEED_DEMO_DATA
│   ├── seed_data.py         ← Shared sample-CFP data (NEW — see note below)
│   ├── seed.py               ← Manual re-seed script, imports from seed_data.py
│   ├── requirements.txt
│   ├── .env.example
│   ├── .env                  ← Your secrets (auto-created; never commit)
│   ├── cfp_commons.db        ← Auto-created on first run
│   └── routers/
│       ├── __init__.py
│       ├── cfps.py           ← Now supports deadline_from / deadline_to filters
│       ├── admin.py
│       └── rss.py
│
└── cfp-frontend/             ── React / Vite ──────────────────────────────────
    ├── index.html
    ├── vite.config.js
    ├── package.json
    ├── public/
    │   └── favicon.svg
    └── src/
        ├── main.jsx
        ├── api.js
        └── App.jsx           ← Now includes a cold-start loading screen + deadline filter UI
```

> `node_modules/` and `__pycache__/` appear after first run — both are
> gitignored already.

---

## What's new in this version

**Deadline range filter.** You can now filter the browse list to a specific
window (e.g. "what's due between March 1 and April 15?"), independent of
sort order and the "include past" toggle. Backend: `GET /api/cfps` accepts
`deadline_from` and `deadline_to` (both `YYYY-MM-DD`, both optional).
Frontend: two date inputs in the sidebar, above the category filters.

**Free-tier hosting support.** Render's free instance type has no persistent
disk, so the whole SQLite file resets on every redeploy and every cold-start
wake-up. `database.py` now auto-seeds sample CFPs on any startup where the
`cfps` table is empty, controlled by `AUTO_SEED_DEMO_DATA` in `.env` (default
`true`). This means the demo never looks empty/broken after a reset — no
manual re-seeding step required. Flip it to `false` once you're on paid
hosting with real persistence, or once real submissions start coming in.

**Cold-start loading screen.** Free-tier instances spin down after 15 minutes
of inactivity and take 30–60s to wake back up. The frontend now shows a
friendly "waking up the demo server" message during that window instead of
a blank/broken-looking shell.

**Shared seed data.** The 15 sample CFPs now live in one place —
`seed_data.py` — imported by both the manual `seed.py` script and the new
automatic startup seeding in `database.py`. Edit the sample content there if
you want to change what the demo shows.

---

## Letting stakeholders test the "add a post" flow

By default, `REQUIRE_APPROVAL=true` means new submissions land in a
moderation queue and won't appear on the public browse page until approved
via `admin.html`. If you want a Penn stakeholder to submit a test CFP and
see it show up immediately (rather than needing you to separately approve
it), set for that deployment:

```
REQUIRE_APPROVAL=false
```

Everything else about the submission (validation, edit token, categories)
works identically either way.

---

## First-time setup (local)

### 1 — Prerequisites
Anaconda/Miniconda (`conda --version`) and Node.js ≥ 18 (`node --version`).

### 2 — Set your admin key
```bash
cd upenn_cfp_redesign/cfp-backend
cp .env.example .env
```
Edit `.env` and set `ADMIN_KEY` to something secret. Generate one:
```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 3 — Launch
```bash
cd upenn_cfp_redesign
chmod +x start.sh
./start.sh
```
Visit **http://localhost:5173** for the site, open `admin.html` directly in
your browser for the admin panel (enter your admin key + `http://localhost:8000`).

---

## Deploying to Render

1. **Push to GitHub first** — Render deploys are Git-native; it rebuilds
   automatically on every push to the linked branch.
   ```bash
   cd upenn_cfp_redesign
   git init && git add . && git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin main
   ```

2. **Create the backend Web Service** — dashboard.render.com → New +
   → Web Service → connect the repo.
   - **Root Directory:** `cfp-backend` (this is a monorepo)
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
   - Under **Advanced**, add your env vars (same keys as `.env`)
   - For the demo, set `REQUIRE_APPROVAL=false` and `AUTO_SEED_DEMO_DATA=true`

3. **The SQLite reality on Free:** no persistent disk, so data resets on
   every redeploy/restart — this is exactly what `AUTO_SEED_DEMO_DATA`
   papers over. Fine for a demo link; if this becomes permanent, either
   upgrade to Starter (~$7/mo) + attach a disk, or move to Render Postgres.

4. **Frontend:** update `api.js`'s `BASE` (or set an env-driven API URL) to
   point at your `onrender.com` backend URL, then either deploy the built
   frontend to GitHub Pages, or as a second Render Static Site from the same
   repo (Root Directory `cfp-frontend`, Build Command
   `npm install && npm run build`, Publish Directory `dist`).

---

## API reference (updated)

### Browse & search
```
GET /api/cfps
    ?q=              full-text search (title, org, content)
    ?category=       filter by category slug
    ?listing_type=   Conference | Journal | Announcement
    ?deadline_from=  YYYY-MM-DD — only CFPs due on/after this date   [NEW]
    ?deadline_to=    YYYY-MM-DD — only CFPs due on/before this date  [NEW]
    ?sort=           recent (default) | deadline
    ?include_closed= false (default)
    ?page=1
    ?page_size=20
```

All other endpoints (submit, edit, delete, extend-deadline, admin routes,
RSS feeds) are unchanged from the original design — see inline docstrings
in each router file for full details.

---

## Configuration (cfp-backend/.env)

| Variable | Default | Description |
|----------|---------|-------------|
| `ADMIN_KEY` | `change-me` | Password for `/api/admin/*` endpoints |
| `REQUIRE_APPROVAL` | `true` | Moderate new submissions before publish |
| `REQUIRE_EXTENSION_APPROVAL` | `true` | Moderate deadline extensions |
| `MAX_EXTENSION_MONTHS` | `6` | Cap on extension window |
| `AUTO_SEED_DEMO_DATA` | `true` | **[NEW]** Auto-populate sample CFPs on empty DB |
| `SMTP_*` | empty | If unset, emails print to console log |
| `SITE_URL` | `http://localhost:8000` | Used in email links and RSS |

---

## Future feature hooks

| Feature | How it's already supported |
|---------|---------------------------|
| Featured listings | `cfps.featured` column |
| Site banners | `announcements` table |
| Spam control | `cfps.submitter_ip` stored on submit |
| Audit trail | `cfp_history` logs every action already |
| Analytics | `cfps.view_count` increments on detail fetch |
| Auto-archiving | Cron: `UPDATE cfps SET status='archived' WHERE deadline < date('now', '-30 days')` |
