"""SQLAlchemy engine/session management (SQLite first, extensible later)."""
from __future__ import annotations

import uuid
from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


def _fk_pragma_on_connect(dbapi_con, _con_record):  # SQLite FK enforcement
    if hasattr(dbapi_con, "execute"):
        dbapi_con.execute("pragma foreign_keys=ON")


def make_engine(url: str | None = None) -> Engine:
    url = url or settings.database_url
    engine = create_engine(
        url,
        connect_args={"check_same_thread": False} if url.startswith("sqlite") else {},
    )
    event.listen(engine, "connect", _fk_pragma_on_connect)
    return engine


engine = make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def new_id() -> str:
    return uuid.uuid4().hex
