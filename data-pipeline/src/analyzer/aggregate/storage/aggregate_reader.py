# data-pipeline/src/analyzer/aggregate/storage/aggregate_reader.py
# 키워드×언론사 집계 통계 적재를 위한 읽기 전용(reader)
# - BASE_DATE 조회
# - 해당 run의 키워드 목록(SEQ) 조회
# - 해당 run에서 실제 기사에 등장한 MEDIA_CODE 조회(B안)
# - 기간 윈도우별 (KEYWORD_SEQ, MEDIA_CODE) 기사 수 집계 맵 조회

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Tuple


@dataclass(frozen=True)
class PeriodWindow:
    period_filter: str
    start_date: date
    end_date: date


def get_base_date_for_run(*, conn, trend_run_seq: int) -> date:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT BASE_DATE
            FROM T_TREND_RUN
            WHERE TREND_RUN_SEQ = %s
            """,
            (trend_run_seq,),
        )
        row = cur.fetchone()
        if not row or not row.get("BASE_DATE"):
            raise RuntimeError(f"T_TREND_RUN에서 BASE_DATE를 찾지 못했습니다. trend_run_seq={trend_run_seq}")
        return row["BASE_DATE"]


def get_keyword_seqs_for_run(*, conn, trend_run_seq: int) -> List[int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT KEYWORD_SEQ
            FROM T_TREND_KEYWORD_SNAPSHOT
            WHERE TREND_RUN_SEQ = %s
            """,
            (trend_run_seq,),
        )
        rows = cur.fetchall() or []
        return [int(r["KEYWORD_SEQ"]) for r in rows]


def get_media_codes_present_in_run(*, conn, trend_run_seq: int) -> List[int]:
    """
    B안: 해당 run에서 실제 기사에 등장한 MEDIA_CODE만 집계 대상으로 사용한다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT DISTINCT MEDIA_CODE
            FROM T_NEWS_ARTICLE
            WHERE TREND_RUN_SEQ = %s
            ORDER BY MEDIA_CODE ASC
            """,
            (trend_run_seq,),
        )
        rows = cur.fetchall() or []
        return [int(r["MEDIA_CODE"]) for r in rows]


def select_counts_map(
    *,
    conn,
    trend_run_seq: int,
    start_date: date,
    end_date: date,
) -> Dict[Tuple[int, int], int]:
    """
    (KEYWORD_SEQ, MEDIA_CODE) -> 기사 수
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              MEDIA_CODE,
              COUNT(*) AS CNT
            FROM T_NEWS_ARTICLE
            WHERE TREND_RUN_SEQ = %s
              AND PUBLISHED_AT IS NOT NULL
              AND DATE(PUBLISHED_AT) BETWEEN %s AND %s
            GROUP BY KEYWORD_SEQ, MEDIA_CODE
            """,
            (trend_run_seq, start_date, end_date),
        )
        rows = cur.fetchall() or []

    out: Dict[Tuple[int, int], int] = {}
    for r in rows:
        k = int(r["KEYWORD_SEQ"])
        m = int(r["MEDIA_CODE"])
        out[(k, m)] = int(r["CNT"] or 0)
    return out
