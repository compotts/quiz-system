"""add last_activity_at to users

Revision ID: add_last_activity
Revises: 8e141f037bd5
Create Date: 2026-02-02

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "add_last_activity"
down_revision: Union[str, Sequence[str], None] = "8e141f037bd5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("last_activity_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "last_activity_at")
