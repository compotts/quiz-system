from fastapi import Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.core.auth import get_current_user_web
from app.database.models import UserRole


class AdminWebAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        public_admin_paths = ["/admin/login", "/admin/init"]
        
        if path.startswith("/static/") or path.startswith("/api/"):
            response = await call_next(request)
            return response
        
        
        if path in public_admin_paths:
            request.state.current_user = None
            response = await call_next(request)
            return response
        
        if path.startswith("/admin/"):
            current_user = await get_current_user_web(request)
            if not current_user or current_user.role != UserRole.ADMIN:
                return RedirectResponse(url="/admin/login", status_code=302)
            request.state.current_user = current_user
        
        response = await call_next(request)
        return response


class APIAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        public_paths = [
            "/api", 
            "/api/auth/login", 
            "/api/auth/register/teacher", 
            "/api/auth/register/student", 
            "/api/auth/login/student",
            "/api/auth/me",
            "/api/admin/init"
        ]
        if path.startswith("/api/") and path not in public_paths and not path.startswith("/api/auth"):
            token = request.headers.get("Authorization")
            if not token:
                return JSONResponse(
                    {"detail": "Token required"},
                    status_code=status.HTTP_401_UNAUTHORIZED
                )
        
        response = await call_next(request)
        return response
