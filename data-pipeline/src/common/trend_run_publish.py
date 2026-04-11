from __future__ import annotations

from datetime import datetime
from zoneinfo import ZoneInfo

from src.config.settings import settings


def get_latest_trend_run_seq(*, conn) -> int | None:
    with conn.cursor() as cur:
        cur.execute("SELECT MAX(TREND_RUN_SEQ) AS mx FROM T_TREND_RUN")
        row = cur.fetchone() or {}

    value = row.get("mx")
    return None if value is None else int(value)


def publish_trend_run(*, conn, trend_run_seq: int, published_at: datetime | None = None) -> int:
    tz = ZoneInfo(settings.tz)
    if published_at is None:
        resolved_published_at = datetime.now(tz)
    elif published_at.tzinfo is None:
        resolved_published_at = published_at.replace(tzinfo=tz)
    else:
        resolved_published_at = published_at.astimezone(tz)

    local_published_at = resolved_published_at.replace(tzinfo=None)

    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE T_TREND_RUN
               SET IS_PUBLISHED = 1,
                   PUBLISHED_AT = %s
             WHERE TREND_RUN_SEQ = %s
            """,
            (local_published_at, int(trend_run_seq)),
        )
        return int(cur.rowcount or 0)
