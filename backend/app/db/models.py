"""SQLAlchemy models. Tables are added with Alembic migrations."""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
