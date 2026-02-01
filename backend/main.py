from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database.database import lifespan
from datetime import datetime
from zoneinfo import ZoneInfo
from config import settings

from app.database.models.user import User
from app.routes import auth, admin, groups, quizzes, attempts, contact, blog

app = FastAPI(
    title="Quizz System API",
    description="Educational Quiz Platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.env == "dev" else None,
    redoc_url="/redoc" if settings.env == "dev" else None,
    openapi_url="/openapi.json" if settings.env == "dev" else None
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(groups.router)
app.include_router(quizzes.router)
app.include_router(attempts.router)
app.include_router(contact.router)
app.include_router(blog.router)


@app.get("/")
async def root():
    return {
        "message": "Quizz System API",
        "version": "1.0.3",
        "docs": "/docs"
    }


@app.get("/healtz")
async def health_check():
    count = await User.objects.count()
    return {
        "status": "ok",
        "users_count": count,
        "message": "API is running",
        "timestamp": datetime.now(ZoneInfo("Europe/Vilnius")).isoformat()
    }
