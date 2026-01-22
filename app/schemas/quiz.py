from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.database.models import QuizType, TimerMode


class QuizBase(BaseModel):
    title: str
    description: Optional[str] = None
    quiz_type: QuizType = QuizType.SINGLE_CHOICE
    timer_mode: TimerMode = TimerMode.QUIZ_TOTAL
    time_limit: Optional[int] = None


class QuizCreate(QuizBase):
    group_id: int


class QuizUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    quiz_type: Optional[QuizType] = None
    timer_mode: Optional[TimerMode] = None
    time_limit: Optional[int] = None
    is_active: Optional[bool] = None


class QuizResponse(QuizBase):
    id: int
    group_id: int
    teacher_id: int
    is_active: bool
    created_at: datetime
    question_count: int = 0
    
    class Config:
        from_attributes = True


class OptionCreate(BaseModel):
    text: str
    is_correct: bool = False
    order: int = 0


class QuestionCreate(BaseModel):
    text: str
    question_type: QuizType
    order: int
    points: float = 1.0
    time_limit: Optional[int] = None
    options: List[OptionCreate]


class QuestionResponse(BaseModel):
    id: int
    quiz_id: int
    question_type: QuizType
    text: str
    order: int
    points: float
    time_limit: Optional[int]
    options: List[OptionCreate]
    created_at: datetime
    
    class Config:
        from_attributes = True