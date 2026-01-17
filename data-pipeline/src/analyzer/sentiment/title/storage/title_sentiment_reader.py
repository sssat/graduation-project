# data-pipeline/src/analyzer/sentiment/title/storage/title_sentiment_reader.py
# 제목 기반 감성분석 대상 기사 조회(Reader)
# - 이번 TREND_RUN_SEQ의 키워드 스냅샷(T_TREND_KEYWORD_SNAPSHOT)에 포함된 "모든 키워드"를 대상으로 한다.
# - 해당 키워드의 기사(T_NEWS_ARTICLE)를 기간(TODAY/D7) 기준으로 조회한다.

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import List, Sequence, Tuple

from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings


@dataclass(frozen=True)
class SentimentArticleRow:
    article_seq: int
    keyword_seq: int
    media_code: int
    title_clean: str


def _fetch_base_date_for_run(trend_run_seq: int) -> date:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT BASE_DATE AS base_date
                FROM T_TREND_RUN
                WHERE TREND_RUN_SEQ = %s
                """,
                (int(trend_run_seq),),
            )
            row = cur.fetchone()
            if not row:
                raise RuntimeError(f"존재하지 않는 TREND_RUN_SEQ 입니다: {trend_run_seq}")
            return row["base_date"]
    finally:
        conn.close()


def _period_range(base_date: date, period_filter: str) -> Tuple[datetime, datetime]:
    """
    기간 필터에 대한 datetime 범위 [start, end)
    - TODAY: base_date 00:00:00 ~ (base_date+1) 00:00:00
    - D7: (base_date-6) 00:00:00 ~ (base_date+1) 00:00:00
    """
    period = (period_filter or "").strip().upper()
    tz = ZoneInfo(settings.tz)

    if period == "TODAY":
        start = datetime.combine(base_date, datetime.min.time(), tzinfo=tz)
        end = start + timedelta(days=1)
        return start, end

    if period == "D7":
        start_date = base_date - timedelta(days=6)
        start = datetime.combine(start_date, datetime.min.time(), tzinfo=tz)
        end = datetime.combine(base_date, datetime.min.time(), tzinfo=tz) + timedelta(days=1)
        return start, end

    raise ValueError(f"지원하지 않는 period_filter: {period_filter}")


def fetch_keyword_seqs_for_trend_run(*, trend_run_seq: int) -> List[int]:
    """
    이번 TREND_RUN_SEQ에 포함된 키워드(KEYWORD_SEQ) 전체 조회
    - 스냅샷 순서(TREND_RANK) 기준으로 정렬
    """
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT KEYWORD_SEQ AS keyword_seq
                FROM T_TREND_KEYWORD_SNAPSHOT
                WHERE TREND_RUN_SEQ = %s
                ORDER BY TREND_RANK ASC
                """,
                (int(trend_run_seq),),
            )
            rows = cur.fetchall() or []
            return [int(r["keyword_seq"]) for r in rows]
    finally:
        conn.close()


def fetch_title_clean_articles_for_sentiment(
    *,
    trend_run_seq: int,
    period_filter: str,
    keyword_seqs: Sequence[int],
) -> List[SentimentArticleRow]:
    """
    감성분석 대상 기사 목록 조회
    - TITLE_CLEAN이 빈 값이면 제외
    - 기간은 PUBLISHED_AT 기준
      (만약 네 스키마에서 컬럼명이 다르면 여기서만 맞춰주면 됨)
    """
    if not keyword_seqs:
        return []

    base_date = _fetch_base_date_for_run(int(trend_run_seq))
    start_dt, end_dt = _period_range(base_date, period_filter)

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(keyword_seqs))

            cur.execute(
                f"""
                SELECT
                  ARTICLE_SEQ AS article_seq,
                  KEYWORD_SEQ AS keyword_seq,
                  MEDIA_CODE  AS media_code,
                  TITLE_CLEAN AS title_clean
                FROM T_NEWS_ARTICLE
                WHERE TREND_RUN_SEQ = %s
                  AND KEYWORD_SEQ IN ({placeholders})
                  AND PUBLISHED_AT >= %s
                  AND PUBLISHED_AT <  %s
                  AND TITLE_CLEAN IS NOT NULL
                  AND TRIM(TITLE_CLEAN) <> ''
                """,
                [int(trend_run_seq), *[int(x) for x in keyword_seqs], start_dt, end_dt],
            )
            rows = cur.fetchall() or []

            out: List[SentimentArticleRow] = []
            for r in rows:
                out.append(
                    SentimentArticleRow(
                        article_seq=int(r["article_seq"]),
                        keyword_seq=int(r["keyword_seq"]),
                        media_code=int(r["media_code"]),
                        title_clean=str(r["title_clean"] or ""),
                    )
                )
            return out
    finally:
        conn.close()
