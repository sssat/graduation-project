from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Sequence

NAVER_DATALAB_SOURCE = "NAVER_DATALAB"


@dataclass(frozen=True)
class SearchTimelineRow:
    observed_date: date
    interest_score: int
    is_partial: bool


def upsert_search_timeline_rows(
    *,
    conn,
    keyword_seq: int,
    last_trend_run_seq: int,
    timeframe_label: str,
    rows: Sequence[SearchTimelineRow],
) -> int:
    if not rows:
        return 0

    payload = []
    for row in rows:
        payload.append(
            (
                int(keyword_seq),
                int(last_trend_run_seq),
                row.observed_date,
                "KR",
                "",
                str(timeframe_label).strip(),
                NAVER_DATALAB_SOURCE,
                max(0, min(100, int(row.interest_score))),
                1 if bool(row.is_partial) else 0,
            )
        )

    with conn.cursor() as cur:
        cur.executemany(
            """
            INSERT INTO T_ANALYZE_SEARCH_TIMELINE (
              KEYWORD_SEQ,
              LAST_TREND_RUN_SEQ,
              OBSERVED_DATE,
              GEO_CODE,
              SEARCH_PROPERTY,
              TIMEFRAME_LABEL,
              DATA_SOURCE,
              INTEREST_SCORE,
              IS_PARTIAL
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              LAST_TREND_RUN_SEQ = VALUES(LAST_TREND_RUN_SEQ),
              TIMEFRAME_LABEL = VALUES(TIMEFRAME_LABEL),
              DATA_SOURCE = VALUES(DATA_SOURCE),
              INTEREST_SCORE = VALUES(INTEREST_SCORE),
              IS_PARTIAL = VALUES(IS_PARTIAL),
              FETCHED_AT = CURRENT_TIMESTAMP
            """,
            payload,
        )

    return len(payload)
