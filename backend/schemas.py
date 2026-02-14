from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional, List
from datetime import datetime, timezone
from app.database.models.user import UserRole


def _naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


class UserRegisterRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=6)
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    message: Optional[str] = None
    role: Optional[str] = None

    @field_validator("role")
    @classmethod
    def role_only_student_or_teacher(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if v not in ("student", "teacher"):
            raise ValueError("Role must be student or teacher")
        return v


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
    registration_ip: Optional[str] = None
    created_at: datetime


class AdminUpdateUserRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    email: Optional[EmailStr] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class ProfileUpdate(BaseModel):
    first_name: Optional[str] = Field(None, max_length=100)
    last_name: Optional[str] = Field(None, max_length=100)
    email: Optional[EmailStr] = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=6)


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


class RegisterResponse(BaseModel):
    auto_approved: bool = False
    access_token: Optional[str] = None
    refresh_token: Optional[str] = None
    token_type: str = "bearer"
    id: Optional[int] = None
    username: Optional[str] = None
    email: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    message: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    status: Optional[str] = None
    created_at: Optional[datetime] = None


class ReviewRegistrationRequest(BaseModel):
    approve: bool
    role: Optional[UserRole] = UserRole.STUDENT


class AdminSettingsResponse(BaseModel):
    auto_registration_enabled: bool
    registration_enabled: bool = True
    maintenance_mode: bool = False
    contact_enabled: bool = True
    home_banner_text: Optional[dict] = None
    home_banner_style: Optional[str] = None


class AdminSettingsUpdate(BaseModel):
    auto_registration_enabled: Optional[bool] = None
    registration_enabled: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    contact_enabled: Optional[bool] = None
    home_banner_text: Optional[dict] = None 
    home_banner_style: Optional[str] = None


class AdminStatsResponse(BaseModel):
    users_total: int = 0
    users_admin: int = 0
    users_developer: int = 0
    users_teacher: int = 0
    users_student: int = 0
    groups_count: int = 0
    quizzes_count: int = 0
    pending_requests_count: int = 0
    unread_messages_count: int = 0
    total_messages_count: int = 0
    recent_logs: List["AuditLogResponse"] = []


class AuditLogResponse(BaseModel):
    id: int
    created_at: datetime
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    resource_type: Optional[str] = None
    resource_id: Optional[str] = None
    details: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None

    class Config:
        from_attributes = True


AdminStatsResponse.model_rebuild()


class GroupCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class GroupUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    subject: Optional[str] = Field(None, min_length=1, max_length=255)
    color: Optional[str] = Field(None, pattern=r'^#[0-9A-Fa-f]{6}$')


class GroupResponse(BaseModel):
    id: int
    name: str
    subject: Optional[str] = None
    code: str
    color: Optional[str] = None
    teacher_id: int
    teacher_name: Optional[str] = None
    created_at: datetime
    member_count: Optional[int] = 0
    incomplete_assignments: Optional[int] = 0


class JoinGroupRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)


class QuizCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    group_id: int
    timer_mode: str = "none" 
    time_limit: Optional[int] = None    
    question_time_limit: Optional[int] = None
    available_until: Optional[datetime] = None
    manual_close: bool = False 
    allow_show_answers: bool = True
    show_results: bool = True
    question_display_mode: str = "all_on_page"
    anti_cheating_mode: bool = False

    @field_validator("available_until", mode="after")
    @classmethod
    def available_until_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _naive_utc(v)


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    timer_mode: Optional[str] = None
    time_limit: Optional[int] = None
    question_time_limit: Optional[int] = None
    is_active: Optional[bool] = None
    available_until: Optional[datetime] = None
    manual_close: Optional[bool] = None
    allow_show_answers: Optional[bool] = None
    show_results: Optional[bool] = None
    question_display_mode: Optional[str] = None
    anti_cheating_mode: Optional[bool] = None

    @field_validator("available_until", mode="after")
    @classmethod
    def available_until_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _naive_utc(v)


class QuizResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    group_id: int
    teacher_id: int
    timer_mode: str = "none"
    time_limit: Optional[int]
    question_time_limit: Optional[int] = None
    is_active: bool
    available_until: Optional[datetime] = None
    manual_close: bool = False
    allow_show_answers: bool = True
    show_results: bool = True
    question_display_mode: str = "all_on_page"
    anti_cheating_mode: bool = False
    created_at: datetime
    question_count: Optional[int] = 0
    is_expired: Optional[bool] = False


class OptionCreate(BaseModel):
    text: str
    is_correct: bool = False
    order: int


class QuestionCreate(BaseModel):
    text: str
    order: int
    points: float = 1.0
    input_type: str = "select"
    options: List[OptionCreate] = []  
    correct_text_answer: Optional[str] = None


class QuestionsBatchCreate(BaseModel):
    questions: List[QuestionCreate] 


class QuestionUpdate(BaseModel):
    text: Optional[str] = None
    order: Optional[int] = None
    points: Optional[float] = None
    input_type: Optional[str] = None
    correct_text_answer: Optional[str] = None
    options: Optional[List[OptionCreate]] = None


class OptionResponse(BaseModel):
    id: int
    text: str
    is_correct: bool
    order: int


class QuestionResponse(BaseModel):
    id: int
    quiz_id: int
    input_type: str = "select"
    text: str
    order: int
    points: float
    correct_text_answer: Optional[str] = None
    options: List[OptionResponse]
    is_multiple_choice: bool = False 


class StartQuizAttempt(BaseModel):
    quiz_id: int


class SubmitAnswer(BaseModel):
    question_id: int
    selected_options: List[int] = []
    text_answer: Optional[str] = None
    time_spent: Optional[int] = None


class SubmitAnswersBatch(BaseModel):
    attempt_id: int
    answers: List[SubmitAnswer]
    complete: bool = True


class SubmitAnswersBatchResponse(BaseModel):
    submitted_count: int
    skipped_count: int
    score: float
    max_score: float
    percentage: float
    is_completed: bool


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
    status: str = "opened"
    questions_order: Optional[List[int]] = None


class QuizResultResponse(BaseModel):
    attempt: QuizAttemptResponse
    answers: List[dict]
    percentage: float
    allow_show_answers: bool = True
    show_results: bool = True


class StudentAttemptStatus(BaseModel):
    student_id: int
    student_name: str
    status: str 
    score: Optional[float] = None
    max_score: Optional[float] = None
    answered_count: int = 0
    total_questions: int = 0
    avg_time_per_answer: Optional[float] = None 


class AntiCheatingEventCreate(BaseModel):
    event_type: str = "tab_switch"  # 'tab_switch' or other
    details: Optional[dict] = None


class AntiCheatingEventResponse(BaseModel):
    id: int
    attempt_id: int
    event_type: str
    details: Optional[str] = None
    created_at: datetime
    student_id: Optional[int] = None
    student_name: Optional[str] = None


class IdenticalAnswersGroup(BaseModel):
    attempt_ids: List[int]
    student_names: List[str]
    completed_at: Optional[datetime] = None


class AntiCheatingLogResponse(BaseModel):
    events: List[AntiCheatingEventResponse]
    identical_answers_groups: List[IdenticalAnswersGroup]


class ReissueQuizRequest(BaseModel):
    student_ids: List[int]
    new_available_until: Optional[datetime] = None
    
    @field_validator("new_available_until", mode="after")
    @classmethod
    def new_available_until_naive_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        return _naive_utc(v)


class ContactMessageCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)


class ContactMessageResponse(BaseModel):
    id: int
    message: str
    user_id: Optional[int]
    username: Optional[str]
    email: Optional[str]
    ip_address: str
    user_agent: Optional[str]
    is_read: bool
    created_at: datetime


class BlogPostCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: str = Field(..., min_length=1)
    is_published: bool = True


class BlogPostUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    content: Optional[str] = Field(None, min_length=1)
    is_published: Optional[bool] = None


class BlogPostResponse(BaseModel):
    id: int
    title: str
    content: str
    author_id: int
    author_name: Optional[str] = None
    is_published: bool
    created_at: datetime
    updated_at: datetime