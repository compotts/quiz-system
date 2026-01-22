import os
from fastapi import FastAPI, Request
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from app.config import settings
from app.database import lifespan
from app.routers import admin_router, auth_router, teacher_router, student_router
from app.core.middleware import AdminWebAuthMiddleware, APIAuthMiddleware


app = FastAPI(
    title=settings.app_name,
    debug=settings.debug,
    lifespan=lifespan
)

app.add_middleware(AdminWebAuthMiddleware)
app.add_middleware(APIAuthMiddleware)

app.mount("/static", StaticFiles(directory="static"), name="static")
app.state.templates = Jinja2Templates(directory="templates")

app.include_router(admin_router, prefix=settings.api_prefix)
app.include_router(auth_router, prefix=settings.api_prefix)
app.include_router(teacher_router, prefix=settings.api_prefix)
app.include_router(student_router, prefix=settings.api_prefix)


@app.get(f"{settings.api_prefix}")
async def health_check():
    return {"status": "healthy", "app_name": settings.app_name, "version": settings.app_version}


@app.get("/")
async def root(request: Request):
    templates = Jinja2Templates(directory="templates")
    return templates.TemplateResponse("index.html", {"request": request})


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
