from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import Date, cast, func, literal_column

TZ = ZoneInfo("Africa/Nairobi")


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def today_local() -> date:
    return datetime.now(TZ).date()


def age_on(dob: date | None, on: date | None = None) -> int | None:
    if not dob:
        return None
    on = on or today_local()
    return on.year - dob.year - ((on.month, on.day) < (dob.month, dob.day))


def local_day(column):
    """SQL: the Nairobi calendar date of a timestamptz column. The zone is inlined as a
    literal so SELECT and GROUP BY compile to the identical expression."""
    return cast(func.timezone(literal_column("'Africa/Nairobi'"), column), Date)
