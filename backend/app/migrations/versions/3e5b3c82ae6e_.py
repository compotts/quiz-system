"""Add new quiz features: color, time limits, text input, statuses

Revision ID: 3e5b3c82ae6e
Revises: 
Create Date: 2026-02-05 20:38:36.816671

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3e5b3c82ae6e'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column('groups', sa.Column('color', sa.String(length=7), nullable=True, server_default='#6366f1'))
    op.add_column('quizzes', sa.Column('has_quiz_time_limit', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('quizzes', sa.Column('manual_close', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('quizzes', sa.Column('allow_show_answers', sa.Boolean(), nullable=True, server_default='1'))
    op.add_column('questions', sa.Column('input_type', sa.String(length=20), nullable=True, server_default='select'))
    op.add_column('questions', sa.Column('has_time_limit', sa.Boolean(), nullable=True, server_default='0'))
    op.add_column('questions', sa.Column('correct_text_answer', sa.Text(), nullable=True))
    op.alter_column('questions', 'question_type', existing_type=sa.String(length=20), nullable=True)
    op.add_column('attempts', sa.Column('status', sa.String(length=20), nullable=True, server_default='opened'))
    op.add_column('attempts', sa.Column('questions_order', sa.Text(), nullable=True))
    op.add_column('answers', sa.Column('text_answer', sa.Text(), nullable=True))
    op.add_column('answers', sa.Column('time_spent', sa.Integer(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('questions', 'question_type', existing_type=sa.String(length=20), nullable=False)
    op.drop_column('answers', 'time_spent')
    op.drop_column('answers', 'text_answer')
    op.drop_column('attempts', 'questions_order')
    op.drop_column('attempts', 'status')
    op.drop_column('questions', 'correct_text_answer')
    op.drop_column('questions', 'has_time_limit')
    op.drop_column('questions', 'input_type')
    op.drop_column('quizzes', 'allow_show_answers')
    op.drop_column('quizzes', 'manual_close')
    op.drop_column('quizzes', 'has_quiz_time_limit')
    op.drop_column('groups', 'color')
