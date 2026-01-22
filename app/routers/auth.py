from fastapi import APIRouter, Depends, HTTPException, status
from datetime import timedelta

from app.schemas.user import UserCreate, UserLogin, StudentRegister, Token, UserResponse
from app.database.models import User, UserRole, RegistrationRequest
from app.core import hash_password, verify_password, create_access_token, get_current_user
from app.core.registration import validate_registration_code, check_user_exists

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.post("/register/teacher")
async def register_teacher(user_data: UserCreate, code: str):
    reg_code = await validate_registration_code(code, "teacher")
    await check_user_exists(user_data.email)

    hashed_password = hash_password(user_data.password)
    req = await RegistrationRequest.objects.create(
        email=user_data.email,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        hashed_password=hashed_password,
        registration_code=reg_code,
        role=UserRole.TEACHER
    )

    return {"message": "Registration request submitted", "request_id": req.id}


@router.post("/register/student")
async def register_student(student_data: StudentRegister, code: str):
    reg_code = await validate_registration_code(code, "student")
    await check_user_exists(student_data.email)

    hashed_password = hash_password(student_data.password)
    req = await RegistrationRequest.objects.create(
        email=student_data.email,
        username=student_data.username,
        first_name=student_data.first_name,
        last_name=student_data.last_name,
        hashed_password=hashed_password,
        registration_code=reg_code,
        role=UserRole.STUDENT
    )

    return {"message": "Registration request submitted", "request_id": req.id}


@router.post("/login", response_model=Token)
async def login(user_credentials: UserLogin):
    user = await User.objects.get_or_none(username=user_credentials.username)

    if not user or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    if not verify_password(user_credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )

    access_token = create_access_token(
        data={"sub": str(user.id), "role": user.role}
    )

    return {"access_token": access_token, "token_type": "bearer"}


# Student login via `/login` now uses username+password (no separate endpoint)


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
