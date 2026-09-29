"""Keyset (cursor) pagination. OFFSET scans every skipped row, which falls over at
millions of rows; a (created_at, id) cursor stays O(page) at any depth."""
import base64
import json
from datetime import datetime
from typing import Any, Generic, TypeVar

from pydantic import BaseModel
from sqlalchemy import Select, and_, or_

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    next_cursor: str | None = None
    total: int | None = None


def encode_cursor(ts: datetime, id_: str) -> str:
    return base64.urlsafe_b64encode(json.dumps([ts.isoformat(), id_]).encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, str] | None:
    try:
        ts, id_ = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        return datetime.fromisoformat(ts), str(id_)
    except Exception:
        return None


def keyset(stmt: Select, model: Any, cursor: str | None, limit: int, ts_col=None) -> Select:
    """Newest-first page after `cursor`. Fetch limit+1 to know whether more exist."""
    col = ts_col if ts_col is not None else model.created_at
    if cursor and (c := decode_cursor(cursor)):
        ts, id_ = c
        stmt = stmt.where(or_(col < ts, and_(col == ts, model.id < id_)))
    return stmt.order_by(col.desc(), model.id.desc()).limit(limit + 1)


def finish(rows: list, limit: int, ts_attr: str = "created_at") -> tuple[list, str | None]:
    if len(rows) <= limit:
        return rows, None
    rows = rows[:limit]
    last = rows[-1]
    return rows, encode_cursor(getattr(last, ts_attr), last.id)
