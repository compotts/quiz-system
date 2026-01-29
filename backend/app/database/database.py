import databases
import sqlalchemy
from fastapi import FastAPI
from ormar import OrmarConfig
from config import settings
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import create_async_engine

metadata = sqlalchemy.MetaData()
database = databases.Database(settings.database_url)

base_ormar_config = OrmarConfig(
    metadata=metadata,
    database=database,
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    async_engine = create_async_engine(settings.database_url)
    async with async_engine.begin() as conn:
        await conn.run_sync(metadata.drop_all)
        await conn.run_sync(metadata.create_all)

    if not database.is_connected:
        await database.connect()

    yield

    if database.is_connected:
        await database.disconnect()
