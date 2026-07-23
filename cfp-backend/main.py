"""
main.py — CFP Commons API entry point.

Run locally:
    uvicorn main:app --reload

On Render, the Start Command is:
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

import shutil
import subprocess
import sys
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from config import get_settings
from database import init_db
from routers.cfps import router as cfps_router
from routers.admin import router as admin_router
from routers.rss import router as rss_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


settings = get_settings()

backend_dir = Path(__file__).resolve().parent
frontend_dir = backend_dir.parent / "cfp-frontend"
frontend_dist_dir = frontend_dir / "dist"
frontend_index_path = frontend_dist_dir / "index.html"


def ensure_frontend_build():
    if frontend_index_path.exists():
        return

    if not shutil.which("npm"):
        return

    print("[startup] Building frontend bundle for deployment…", file=sys.stderr)
    subprocess.run(["npm", "install"], cwd=frontend_dir, check=True)
    subprocess.run(["npm", "run", "build"], cwd=frontend_dir, check=True)


ensure_frontend_build()

app = FastAPI(
    title="CFP Commons API",
    description=(
        "Backend for CFP Commons — a redesigned hub for humanities calls for papers, "
        "conference announcements, and journal listings."
    ),
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cfps_router, prefix="/api/cfps", tags=["CFPs"])
app.include_router(admin_router, prefix="/api/admin", tags=["Admin"])
app.include_router(rss_router, prefix="/rss", tags=["RSS"])

if frontend_index_path.exists():
    assets_dir = frontend_dist_dir / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")


@app.get("/", include_in_schema=False)
async def root():
    if frontend_index_path.exists():
        return FileResponse(frontend_index_path, media_type="text/html")
    return JSONResponse({
        "name": "CFP Commons API",
        "version": "0.2.0",
        "docs": "/docs",
        "rss": {
            "all": "/rss/all",
            "by_category": "/rss/category/{slug}",
            "by_type": "/rss/type/{Conference|Journal|Announcement}",
        },
    })


@app.get("/{path:path}", include_in_schema=False)
async def frontend_fallback(path: str):
    if path.startswith(("api", "rss", "docs", "openapi.json", "health")):
        raise HTTPException(status_code=404, detail="Not Found")
    if frontend_index_path.exists():
        return FileResponse(frontend_index_path, media_type="text/html")
    raise HTTPException(status_code=404, detail="Not Found")


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
