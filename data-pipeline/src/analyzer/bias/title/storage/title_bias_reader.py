# data-pipeline/src/analyzer/bias/title/storage/title_bias_reader.py
# 편향도 계산을 위한 입력 데이터 조회(reader)
# - T_ANALYZE_SENTIMENT에서 제목 기반 비율을 읽는다.
# - overall fallback(전체 row가 없을 때)을 기사수 가중평균으로 만들기 위해
#   T_ANALYZE_MEDIA_STAT에서 (키워드×언론사×기간) 기사수를 함께 조회할 수 있다.

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"
PERIOD_D30 = "D30"

@dataclass(frozen=True)
class SentimentTitleRow:
    keyword_seq: int
    media_code: int
    period_filter: str
    positive_pct_title: float
    neutral_pct_title: float
    negative_pct_title: float


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


def select_media_sentiments_title(*, conn, trend_run_seq: int, period_filter: str) -> List[SentimentTitleRow]:
    """
    언론사별 row만 반환(MEDIA_CODE != 0)
    """
    period_filter = str(period_filter).upper().strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              MEDIA_CODE,
              PERIOD_FILTER,
              POSITIVE_PCT_TITLE,
              NEUTRAL_PCT_TITLE,
              NEGATIVE_PCT_TITLE
            FROM T_ANALYZE_SENTIMENT
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
              AND MEDIA_CODE <> 0
            ORDER BY KEYWORD_SEQ ASC, MEDIA_CODE ASC
            """,
            (int(trend_run_seq), period_filter),
        )
        rows = cur.fetchall() or []

    out: List[SentimentTitleRow] = []
    for r in rows:
        out.append(
            SentimentTitleRow(
                keyword_seq=int(r["KEYWORD_SEQ"]),
                media_code=int(r["MEDIA_CODE"]),
                period_filter=str(r["PERIOD_FILTER"]),
                positive_pct_title=float(r["POSITIVE_PCT_TITLE"]),
                neutral_pct_title=float(r["NEUTRAL_PCT_TITLE"]),
                negative_pct_title=float(r["NEGATIVE_PCT_TITLE"]),
            )
        )
    return out


def select_overall_sentiments_title(*, conn, trend_run_seq: int, period_filter: str) -> Dict[int, Tuple[float, float, float]]:
    """
    전체 집계 row(MEDIA_CODE=0)가 있으면 keyword_seq -> (pos, neu, neg) 맵으로 반환
    """
    period_filter = str(period_filter).upper().strip()
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              POSITIVE_PCT_TITLE,
              NEUTRAL_PCT_TITLE,
              NEGATIVE_PCT_TITLE
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
            float(r["POSITIVE_PCT_TITLE"]),
            float(r["NEUTRAL_PCT_TITLE"]),
            float(r["NEGATIVE_PCT_TITLE"]),
        )
    return out


def select_media_article_counts(
    *,
    conn,
    trend_run_seq: int,
    period_filter: str,
) -> Dict[Tuple[int, int], int]:
    """
    기사수 통계(T_ANALYZE_MEDIA_STAT)에서 (키워드×언론사×기간) 기사수를 조회한다.

    반환:
      (keyword_seq, media_code) -> article_count

    용도:
      전체 집계(MEDIA_CODE=0) row가 없을 때,
      언론사별 감성 비율을 기사수로 가중평균해 overall을 추정하는 fallback에 사용한다.
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
              AND MEDIA_CODE <> 0
            """,
            (int(trend_run_seq), period_filter),
        )
        rows = cur.fetchall() or []

    out: Dict[Tuple[int, int], int] = {}
    for r in rows:
        kseq = int(r["KEYWORD_SEQ"])
        mcode = int(r["MEDIA_CODE"])
        cnt = int(r.get("ARTICLE_COUNT") or 0)
        out[(kseq, mcode)] = cnt

    return out
