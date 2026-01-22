from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime


class AnswerSubmit(BaseModel):
    question_id: int
    selected_options: List[int]


class QuizStartResponse(BaseModel):
    attempt_id: int
    quiz_id: int
    started_at: datetime
    time_limit: Optional[int]
    questions: List[dict]


class QuizSubmitRequest(BaseModel):
    answers: List[AnswerSubmit]


class AttemptResponse(BaseModel):
    id: int
    quiz_id: int
    student_id: int
    score: float
    max_score: float
    started_at: datetime
    completed_at: Optional[datetime]
    time_spent: Optional[int]
    is_completed: bool
    question_count: int
    correct_answers: int
    
    class Config:
        from_attributes = True


class DetailedAttemptResponse(AttemptResponse):
    answers: List[dict]