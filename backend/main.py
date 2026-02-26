from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database.database import lifespan
from app.middleware.maintenance import MaintenanceMiddleware

from config import settings

UPLOADS_DIR = Path(__file__).resolve().parent / "static" / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
(UPLOADS_DIR / "questions").mkdir(parents=True, exist_ok=True)

if settings.api_version == "v2":
    from app.routes.v2 import auth, admin, groups, quizzes, attempts, contact, blog
else:
    from app.routes.v1 import auth, admin, groups, quizzes, attempts, contact, blog


app = FastAPI(
    title=str(settings.title),
    version=str(settings.version),
    lifespan=lifespan,
    docs_url="/docs" if settings.env == "dev" else None,
    redoc_url="/redoc" if settings.env == "dev" else None,
    openapi_url="/openapi.json" if settings.env == "dev" else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allow_headers=["*"],
)
app.add_middleware(MaintenanceMiddleware, cache_seconds=5.0)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(quizzes.router)
app.include_router(attempts.router)
app.include_router(contact.router)
app.include_router(blog.router)

app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")


@app.get("/")
async def root():
    return {"version": settings.version, "api": settings.api_version, "title": settings.title}


@app.get("/health")
async def health_check():
    return {"ok": True}
