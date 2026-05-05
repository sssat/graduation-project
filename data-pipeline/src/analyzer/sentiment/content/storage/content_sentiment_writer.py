# data-pipeline/src/analyzer/sentiment/content/storage/content_sentiment_writer.py
# 본문 기반 감성분석 결과(T_ANALYZE_SENTIMENT) 적재 writer
#
# 테이블 컬럼(너 스키마 기준):
# - POSITIVE_PCT_TITLE / NEUTRAL_PCT_TITLE / NEGATIVE_PCT_TITLE (제목용)
# - POSITIVE_PCT_CONTENT / NEUTRAL_PCT_CONTENT / NEGATIVE_PCT_CONTENT (본문용)
#
# 주의:
# - 제목/본문이 같은 행을 공유할 수 있으므로, 본문 refresh에서 행 DELETE를 하면 제목 결과까지 사라질 수 있다.
# - 따라서 본문 refresh는 DELETE 대신 CONTENT 컬럼만 0으로 초기화(UPDATE)한다.

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence

from src.common.db import get_conn
from src.analyzer.sentiment.content.core.content_sentiment import SentimentProba


@dataclass(frozen=True)
class ContentSentimentAggRow:
    keyword_seq: int
    media_code: int
    period_filter: str
    article_count: int  # 로그/디버깅용
    avg_proba: SentimentProba  # (positive/neutral/negative) 0~1


def reset_existing_content_sentiment_rows(*, trend_run_seq: int, periods: Sequence[str]) -> int:
    """
    같은 TREND_RUN에서 특정 PERIOD_FILTER들의 본문 감성 컬럼만 0으로 초기화
    - 제목 결과 보호를 위해 DELETE 금지
    """
    periods = [str(p).strip().upper() for p in periods if str(p).strip()]
    if not periods:
        return 0

    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            placeholders = ",".join(["%s"] * len(periods))
            sql = f"""
                UPDATE T_ANALYZE_SENTIMENT
                SET
                  POSITIVE_PCT_CONTENT = 0,
                  NEUTRAL_PCT_CONTENT  = 0,
                  NEGATIVE_PCT_CONTENT = 0
                WHERE TREND_RUN_SEQ = %s
                  AND PERIOD_FILTER IN ({placeholders})
            """
            cur.execute(sql, (int(trend_run_seq), *periods))
            return int(cur.rowcount or 0)
    finally:
        conn.close()


def upsert_keyword_content_sentiment_rows(*, trend_run_seq: int, rows: Iterable[ContentSentimentAggRow]) -> int:
    """
    본문 기반 감성 결과를 T_ANALYZE_SENTIMENT에 UPSERT 저장
    - *_PCT_CONTENT 컬럼만 업데이트
    - *_PCT_TITLE는 건드리지 않음
    """
    rows_list: List[ContentSentimentAggRow] = list(rows)
    if not rows_list:
        return 0

    sql = """
        INSERT INTO T_ANALYZE_SENTIMENT (
            TREND_RUN_SEQ,
            KEYWORD_SEQ,
            MEDIA_CODE,
            PERIOD_FILTER,
            POSITIVE_PCT_TITLE,
            NEUTRAL_PCT_TITLE,
            NEGATIVE_PCT_TITLE,
            POSITIVE_PCT_CONTENT,
            NEUTRAL_PCT_CONTENT,
            NEGATIVE_PCT_CONTENT
        )
        VALUES (%s, %s, %s, %s, 0, 0, 0, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            POSITIVE_PCT_CONTENT = VALUES(POSITIVE_PCT_CONTENT),
            NEUTRAL_PCT_CONTENT  = VALUES(NEUTRAL_PCT_CONTENT),
            NEGATIVE_PCT_CONTENT = VALUES(NEGATIVE_PCT_CONTENT)
    """

    def _to_params(r: ContentSentimentAggRow) -> tuple:
        # 0~1 -> 0~100
        pos = float(r.avg_proba.positive) * 100.0
        neu = float(r.avg_proba.neutral) * 100.0
        neg = float(r.avg_proba.negative) * 100.0

        # 테이블이 DECIMAL(5,2)이라면 소수점 2자리 반올림
        pos = round(pos, 2)
        neu = round(neu, 2)
        neg = round(neg, 2)

        return (
            int(trend_run_seq),
            int(r.keyword_seq),
            int(r.media_code),
            str(r.period_filter).strip().upper(),
            pos,
            neu,
            neg,
        )

    params = [_to_params(r) for r in rows_list]

    conn = get_conn(autocommit=True)
    try:
        with conn.cursor() as cur:
            cur.executemany(sql, params)
            return len(params)
    finally:
        conn.close()
