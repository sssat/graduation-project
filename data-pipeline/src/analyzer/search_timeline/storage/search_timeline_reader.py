from __future__ import annotations

from datetime import date
from typing import Iterable, Set

NAVER_DATALAB_SOURCE = "NAVER_DATALAB"


def fetch_keyword_seqs_collected_for_observed_date(
    *,
    conn,
    keyword_seqs: Iterable[int],
    observed_date: date,
    timeframe_label: str,
) -> Set[int]:
    seqs = sorted({int(seq) for seq in keyword_seqs if int(seq) > 0})
    if not seqs:
        return set()

    placeholders = ", ".join(["%s"] * len(seqs))
    with conn.cursor() as cur:
        cur.execute(
            f"""
            SELECT DISTINCT KEYWORD_SEQ AS keyword_seq
            FROM T_ANALYZE_SEARCH_TIMELINE
            WHERE OBSERVED_DATE = %s
              AND DATA_SOURCE = %s
              AND GEO_CODE = 'KR'
              AND SEARCH_PROPERTY = ''
              AND TIMEFRAME_LABEL = %s
              AND KEYWORD_SEQ IN ({placeholders})
            """,
            (observed_date, NAVER_DATALAB_SOURCE, str(timeframe_label).strip(), *seqs),
        )
        rows = cur.fetchall() or []

    return {int(row["keyword_seq"]) for row in rows}
