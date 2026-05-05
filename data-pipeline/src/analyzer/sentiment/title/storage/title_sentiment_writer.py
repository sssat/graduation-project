# data-pipeline/src/analyzer/sentiment/title/storage/title_sentiment_writer.py
# 제목 기반 감성분석 결과(T_ANALYZE_SENTIMENT) 적재 writer
#
# 테이블 컬럼(너 스키마 기준):
# - POSITIVE_PCT_TITLE / NEUTRAL_PCT_TITLE / NEGATIVE_PCT_TITLE
# - POSITIVE_PCT_CONTENT / NEUTRAL_PCT_CONTENT / NEGATIVE_PCT_CONTENT (본문용)
#
# 전제:
# - (TREND_RUN_SEQ, KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER) 조합에 대해 UNIQUE가 걸려있어야 UPSERT가 의미가 있음
# - SENTIMENT_SEQ는 보통 AUTO_INCREMENT이므로 INSERT 컬럼에서 제외
#
# 중요:
# - 제목/본문이 같은 행을 공유하므로, 제목 refresh에서 행 DELETE를 하면 본문 결과까지 사라진다.
# - 따라서 제목 refresh는 DELETE 대신 TITLE 컬럼만 0으로 초기화(UPDATE)한다.

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Sequence

from src.common.db import get_conn
from src.analyzer.sentiment.title.core.title_sentiment import SentimentProba


@dataclass(frozen=True)
class SentimentAggRow:
    keyword_seq: int
    media_code: int
    period_filter: str
    article_count: int  # 테이블에 저장하진 않지만, 로그/디버깅용으로 유지
    avg_proba: SentimentProba  # (positive/neutral/negative) 0~1


def reset_existing_title_sentiment_rows(*, trend_run_seq: int, periods: Sequence[str]) -> int:
    """
    같은 TREND_RUN에서 특정 PERIOD_FILTER들의 "제목 감성 컬럼"만 0으로 초기화
    - 본문 결과 보호를 위해 DELETE 금지
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
                  POSITIVE_PCT_TITLE = 0,
                  NEUTRAL_PCT_TITLE  = 0,
                  NEGATIVE_PCT_TITLE = 0
                WHERE TREND_RUN_SEQ = %s
                  AND PERIOD_FILTER IN ({placeholders})
            """
            cur.execute(sql, (int(trend_run_seq), *periods))
            return int(cur.rowcount or 0)
    finally:
        conn.close()


def upsert_keyword_sentiment_rows(*, trend_run_seq: int, rows: Iterable[SentimentAggRow]) -> int:
    """
    제목 기반 감성 결과를 T_ANALYZE_SENTIMENT에 UPSERT 저장
    - *_PCT_TITLE 컬럼만 업데이트
    - *_PCT_CONTENT는 건드리지 않음
    """
    rows_list: List[SentimentAggRow] = list(rows)
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
            NEGATIVE_PCT_TITLE
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
            POSITIVE_PCT_TITLE = VALUES(POSITIVE_PCT_TITLE),
            NEUTRAL_PCT_TITLE  = VALUES(NEUTRAL_PCT_TITLE),
            NEGATIVE_PCT_TITLE = VALUES(NEGATIVE_PCT_TITLE)
    """

    def _to_params(r: SentimentAggRow) -> tuple:
        # 0~1 -> 0~100
        pos = float(r.avg_proba.positive) * 100.0
        neu = float(r.avg_proba.neutral) * 100.0
        neg = float(r.avg_proba.negative) * 100.0

        # 테이블이 DECIMAL(5,2)이므로 소수점 2자리 반올림
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
