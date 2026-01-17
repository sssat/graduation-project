# data-pipeline/src/crawler/news/storage/keyword_reader.py
# 뉴스 크롤링 코드 실행 전 DB의 트렌드 데이터를 읽어오는 코드

from __future__ import annotations

from dataclasses import dataclass
from typing import List

from src.common.db import get_conn


@dataclass(frozen=True)
class TrendKeywordRow:
    keyword_seq: int
    keyword_name: str
    trend_rank: int


def fetch_keywords_for_trend_run(trend_run_seq: int) -> List[TrendKeywordRow]:
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  k.KEYWORD_SEQ AS keyword_seq,
                  k.KEYWORD_NAME AS keyword_name,
                  tk.TREND_RANK AS trend_rank
                FROM T_TREND_KEYWORD_SNAPSHOT tk
                JOIN T_TREND_KEYWORD_MASTER k ON k.KEYWORD_SEQ = tk.KEYWORD_SEQ
                WHERE tk.TREND_RUN_SEQ = %s
                ORDER BY tk.TREND_RANK ASC
                """,
                (trend_run_seq,),
            )
            rows = cur.fetchall() or []
            return [
                TrendKeywordRow(
                    keyword_seq=int(r["keyword_seq"]),
                    keyword_name=str(r["keyword_name"]),
                    trend_rank=int(r["trend_rank"]),
                )
                for r in rows
            ]
    finally:
        conn.close()
