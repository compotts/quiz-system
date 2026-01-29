from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database.database import lifespan
from datetime import datetime
from config import settings

from app.routes import auth, admin, groups, quizzes, attempts, contact

app = FastAPI(
    title="Quizz System API",
    description="Educational Quiz Platform",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
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


@app.get("/")
async def root():
    return {
        "message": "Quizz System API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/healtz")
async def health_check():
    return {
        "status": "ok",
        "message": "API is running",
        "timestamp": datetime.now().isoformat()
    }
