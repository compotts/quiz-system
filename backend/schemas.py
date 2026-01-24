from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime
from app.database.models.user import UserRole
from app.database.models.quiz import QuizType, TimerMode


# ============ AUTH SCHEMAS ============
class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    message: Optional[str] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    role: str
    is_active: bool
    created_at: datetime


# ============ ADMIN SCHEMAS ============
class AdminInitRequest(BaseModel):
    username: str = Field(..., min_length=3)
    email: EmailStr
    password: str = Field(..., min_length=8)
    first_name: str
    last_name: str


class RegistrationRequestResponse(BaseModel):
    id: int
    username: str
    email: str
    first_name: Optional[str]
    last_name: Optional[str]
    message: Optional[str]
    ip_address: Optional[str]
    user_agent: Optional[str]
    status: str
    created_at: datetime


class ReviewRegistrationRequest(BaseModel):
    approve: bool
    role: Optional[UserRole] = UserRole.STUDENT


# ============ GROUP SCHEMAS ============
class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)


class GroupResponse(BaseModel):
    id: int
    name: str
    code: str
    teacher_id: int
    created_at: datetime
    member_count: Optional[int] = 0


class JoinGroupRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


# ============ QUIZ SCHEMAS ============
class QuizCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    group_id: int
    quiz_type: QuizType = QuizType.SINGLE_CHOICE
    timer_mode: TimerMode = TimerMode.QUIZ_TOTAL
    time_limit: Optional[int] = None


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quiz_type: Optional[QuizType] = None
    timer_mode: Optional[TimerMode] = None
    time_limit: Optional[int] = None
    is_active: Optional[bool] = None


class QuizResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    group_id: int
    teacher_id: int
    quiz_type: str
    timer_mode: str
    time_limit: Optional[int]
    is_active: bool
    created_at: datetime
    question_count: Optional[int] = 0


# ============ QUESTION SCHEMAS ============
class OptionCreate(BaseModel):
    text: str
    is_correct: bool = False
    order: int


class QuestionCreate(BaseModel):
    question_type: QuizType
    text: str
    order: int
    points: float = 1.0
    time_limit: Optional[int] = None
    options: List[OptionCreate]


class QuestionUpdate(BaseModel):
    question_type: Optional[QuizType] = None
    text: Optional[str] = None
    order: Optional[int] = None
    points: Optional[float] = None
    time_limit: Optional[int] = None


class OptionResponse(BaseModel):
    id: int
    text: str
    is_correct: bool
    order: int


class QuestionResponse(BaseModel):
    id: int
    quiz_id: int
    question_type: str
    text: str
    order: int
    points: float
    time_limit: Optional[int]
    options: List[OptionResponse]


# ============ ATTEMPT SCHEMAS ============
class StartQuizAttempt(BaseModel):
    quiz_id: int


class SubmitAnswer(BaseModel):
    question_id: int
    selected_options: List[int]  # IDs выбранных опций


class CompleteQuizAttempt(BaseModel):
    attempt_id: int


class QuizAttemptResponse(BaseModel):
    id: int
    quiz_id: int
    student_id: int
    score: float
    max_score: float
    started_at: datetime
    completed_at: Optional[datetime]
    time_spent: Optional[int]
    is_completed: bool


class QuizResultResponse(BaseModel):
    attempt: QuizAttemptResponse
    answers: List[dict]
    percentage: float