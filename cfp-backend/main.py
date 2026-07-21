"""
main.py — CFP Commons API entry point.

Run locally:
    uvicorn main:app --reload

On Render, the Start Command is:
    uvicorn main:app --host 0.0.0.0 --port $PORT
"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

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


@app.get("/", include_in_schema=False)
async def root():
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


@app.get("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}
