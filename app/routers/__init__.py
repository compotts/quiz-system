from .admin import router as admin_router
from .auth import router as auth_router
from .teacher import router as teacher_router
from .student import router as student_router

__all__ = ["admin_router", "auth_router", "teacher_router", "student_router"]