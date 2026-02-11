import time
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse
from app.database.models.system_setting import SystemSetting



ALLOWED_PATH_PREFIXES_MAINTENANCE = ("/admin",)
ALLOWED_PATHS_MAINTENANCE = {
    ("GET", "/auth/registration-settings"),
    ("GET", "/auth/me"),
    ("POST", "/auth/login"),
    ("POST", "/auth/refresh"),
    ("GET", "/health"),
    ("GET", "/"),
}


async def _is_maintenance_mode() -> bool:
    s = await SystemSetting.objects.get_or_none(key="maintenance_mode")
    return s is not None and s.value.lower() == "true"


class MaintenanceMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, cache_seconds: float = 5.0):
        super().__init__(app)
        self.cache_seconds = cache_seconds
        self._cached = False
        self._cached_at = 0.0

    async def _get_maintenance(self, request: Request) -> bool:
        if request.scope.get("type") != "http":
            return False
        now = time.monotonic()
        if self._cached and (now - self._cached_at) < self.cache_seconds:
            return self._maintenance_value
        self._maintenance_value = await _is_maintenance_mode()
        self._cached = True
        self._cached_at = now
        return self._maintenance_value

    async def dispatch(self, request: Request, call_next):
        path = request.scope.get("path", "")
        method = request.scope.get("method", "GET")
        if method == "OPTIONS":
            return await call_next(request)
        key = (method, path)
        if key in ALLOWED_PATHS_MAINTENANCE:
            return await call_next(request)
        if path.startswith(ALLOWED_PATH_PREFIXES_MAINTENANCE):
            return await call_next(request)
        try:
            maintenance = await self._get_maintenance(request)
        except Exception:
            return await call_next(request)
        if maintenance:
            return JSONResponse(
                status_code=503,
                content={"detail": "Service temporarily unavailable (maintenance)"},
            )
        return await call_next(request)
