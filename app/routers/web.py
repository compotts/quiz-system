from fastapi import APIRouter, Request
from fastapi.templating import Jinja2Templates

router = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/login")
async def login_page(request: Request):
    return templates.TemplateResponse("auth/login.html", {"request": request})


@router.get("/register")
async def register_page(request: Request):
    return templates.TemplateResponse("auth/register.html", {"request": request})


@router.get("/admin")
async def admin_page(request: Request):
    return templates.TemplateResponse("admin/dashboard.html", {"request": request})


@router.get("/admin/init")
async def admin_init_page(request: Request):
    return templates.TemplateResponse("admin/init.html", {"request": request})


@router.get("/teacher/quizzes")
async def teacher_quizzes_page(request: Request):
    return templates.TemplateResponse("teacher/quizzes.html", {"request": request})


@router.get("/teacher/quizzes/{quiz_id}/edit")
async def teacher_quiz_edit_page(request: Request, quiz_id: int):
    return templates.TemplateResponse("teacher/quiz_edit.html", {"request": request, "quiz_id": quiz_id})


@router.get("/teacher")
async def teacher_page(request: Request):
    return templates.TemplateResponse("teacher/dashboard.html", {"request": request})


@router.get("/student")
async def student_page(request: Request):
    return templates.TemplateResponse("student/dashboard.html", {"request": request})


@router.get("/quiz/{quiz_id}")
async def take_quiz_page(request: Request, quiz_id: int):
    return templates.TemplateResponse("quiz/take.html", {"request": request, "quiz_id": quiz_id})
