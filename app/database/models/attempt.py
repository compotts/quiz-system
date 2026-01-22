from ormar import Model, Integer, Float, ForeignKey, DateTime, Text, Boolean
from app.database.database import base_ormar_config
from datetime import datetime
from app.database.models.user import User
from app.database.models.quiz import Quiz, Question


class QuizAttempt(Model):
    ormar_config = base_ormar_config.copy(tablename="quiz_attempts")

    id: int = Integer(primary_key=True)
    quiz: Quiz = ForeignKey(Quiz, related_name="attempts")
    student: User = ForeignKey(User, related_name="quiz_attempts")
    score: float = Float(default=0.0)
    max_score: float = Float()
    started_at: datetime = DateTime(default=datetime.utcnow)
    completed_at: datetime = DateTime(nullable=True)
    time_spent: int = Integer(nullable=True)
    is_completed: bool = Boolean(default=False)
    created_at: datetime = DateTime(default=datetime.utcnow)


class Answer(Model):
    ormar_config = base_ormar_config.copy(tablename="answers")

    id: int = Integer(primary_key=True)
    attempt: QuizAttempt = ForeignKey(QuizAttempt, related_name="answers")
    question: Question = ForeignKey(Question)
    selected_options: str = Text()
    is_correct: bool = Boolean(default=False)
    points_earned: float = Float(default=0.0)
    answered_at: datetime = DateTime(default=datetime.utcnow)