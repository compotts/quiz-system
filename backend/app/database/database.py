import databases
import sqlalchemy
from fastapi import FastAPI
from ormar import OrmarConfig
from config import settings
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine
from datetime import datetime, timezone
from typing import Optional

metadata = sqlalchemy.MetaData()
database = databases.Database(settings.database_url)


def utc_now() -> datetime:
    """Returns current UTC time as naive datetime (for PostgreSQL compatibility)"""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def to_naive_utc(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert any datetime to naive UTC for asyncpg/PostgreSQL."""
    if dt is None:
        return None
    if dt.tzinfo is not None:
        return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt

base_ormar_config = OrmarConfig(
    metadata=metadata,
    database=database,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async_engine = create_async_engine(settings.database_url)
    async with async_engine.begin() as conn:
        # await conn.run_sync(metadata.drop_all)
        await conn.run_sync(metadata.create_all)

    if not database.is_connected:
        await database.connect()

    yield

    if database.is_connected:
        await database.disconnect()
