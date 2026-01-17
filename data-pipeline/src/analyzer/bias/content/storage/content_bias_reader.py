# data-pipeline/src/analyzer/bias/content/storage/content_bias_reader.py
# 본문 편향도 계산을 위한 입력 데이터 조회(reader)
# - T_ANALYZE_SENTIMENT에서 본문 기반 비율(*_PCT_CONTENT)을 읽는다.
# - overall(MEDIA_CODE=0)이 없을 때 가중평균을 위해 T_ANALYZE_MEDIA_STAT의 ARTICLE_COUNT를 읽는다.

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"


@dataclass(frozen=True)
class SentimentContentRow:
    keyword_seq: int
    media_code: int
    period_filter: str
    positive_pct_content: float
    neutral_pct_content: float
    negative_pct_content: float


def get_latest_trend_run_seq(*, conn) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute("SELECT MAX(TREND_RUN_SEQ) AS MX FROM T_TREND_RUN")
        row = cur.fetchone() or {}
        mx = row.get("MX")
        return int(mx) if mx is not None else None


def select_keyword_name(*, conn, keyword_seq: int) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT KEYWORD_NAME
            FROM T_TREND_KEYWORD_MASTER
            WHERE KEYWORD_SEQ = %s
            """,
            (int(keyword_seq),),
        )
        row = cur.fetchone() or {}
        name = row.get("KEYWORD_NAME")
        return str(name) if name is not None else f"keyword_seq={keyword_seq}"


def select_media_sentiments_content(*, conn, trend_run_seq: int, period_filter: str) -> List[SentimentContentRow]:
    """
    언론사별 row만 반환(MEDIA_CODE != 0), 본문 기반 비율 사용.
    """
    period_filter = str(period_filter).upper().strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              MEDIA_CODE,
              PERIOD_FILTER,
              POSITIVE_PCT_CONTENT,
              NEUTRAL_PCT_CONTENT,
              NEGATIVE_PCT_CONTENT
            FROM T_ANALYZE_SENTIMENT
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
              AND MEDIA_CODE <> 0
            ORDER BY KEYWORD_SEQ ASC, MEDIA_CODE ASC
            """,
            (int(trend_run_seq), period_filter),
        )
        rows = cur.fetchall() or []

    out: List[SentimentContentRow] = []
    for r in rows:
        out.append(
            SentimentContentRow(
                keyword_seq=int(r["KEYWORD_SEQ"]),
                media_code=int(r["MEDIA_CODE"]),
                period_filter=str(r["PERIOD_FILTER"]),
                positive_pct_content=float(r["POSITIVE_PCT_CONTENT"]),
                neutral_pct_content=float(r["NEUTRAL_PCT_CONTENT"]),
                negative_pct_content=float(r["NEGATIVE_PCT_CONTENT"]),
            )
        )
    return out


def select_overall_sentiments_content(*, conn, trend_run_seq: int, period_filter: str) -> Dict[int, Tuple[float, float, float]]:
    """
    전체 집계 row(MEDIA_CODE=0)가 있으면 keyword_seq -> (pos, neu, neg) 맵으로 반환 (본문 기반).
    """
    period_filter = str(period_filter).upper().strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              POSITIVE_PCT_CONTENT,
              NEUTRAL_PCT_CONTENT,
              NEGATIVE_PCT_CONTENT
            FROM T_ANALYZE_SENTIMENT
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
              AND MEDIA_CODE = 0
            """,
            (int(trend_run_seq), period_filter),
        )
        rows = cur.fetchall() or []

    out: Dict[int, Tuple[float, float, float]] = {}
    for r in rows:
        kseq = int(r["KEYWORD_SEQ"])
        out[kseq] = (
            float(r["POSITIVE_PCT_CONTENT"]),
            float(r["NEUTRAL_PCT_CONTENT"]),
            float(r["NEGATIVE_PCT_CONTENT"]),
        )
    return out


def select_media_article_counts(*, conn, trend_run_seq: int, period_filter: str) -> Dict[Tuple[int, int], int]:
    """
    가중평균(overall 추정)을 위한 기사 수 맵:
      (keyword_seq, media_code) -> article_count
    """
    period_filter = str(period_filter).upper().strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              MEDIA_CODE,
              ARTICLE_COUNT
            FROM T_ANALYZE_MEDIA_STAT
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
            """,
            (int(trend_run_seq), period_filter),
        )
        rows = cur.fetchall() or []

    out: Dict[Tuple[int, int], int] = {}
    for r in rows:
        kseq = int(r["KEYWORD_SEQ"])
        mcode = int(r["MEDIA_CODE"])
        out[(kseq, mcode)] = int(r["ARTICLE_COUNT"] or 0)
    return out
