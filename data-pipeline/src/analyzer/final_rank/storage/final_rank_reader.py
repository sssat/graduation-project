# data-pipeline/src/analyzer/final_rank/storage/final_rank_reader.py
# 최종 순위 적재를 위한 읽기 전용(reader)
# - 키워드 목록, 키워드별 기사수 합계, 최신 trend_run 조회 등

from __future__ import annotations

from typing import Dict, List, Optional

from src.analyzer.final_rank.core.final_rank_calc import KeywordRow


def get_latest_trend_run_seq(*, conn) -> Optional[int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT TREND_RUN_SEQ
            FROM T_TREND_RUN
            ORDER BY TREND_RUN_SEQ DESC
            LIMIT 1
            """
        )
        row = cur.fetchone()
    if not row:
        return None
    return int(row["TREND_RUN_SEQ"])


def get_keywords_for_run(*, conn, trend_run_seq: int) -> List[KeywordRow]:
    """
    해당 run의 키워드 목록(T_TREND_KEYWORD_SNAPSHOT) + 키워드명(T_TREND_KEYWORD_MASTER)을 가져온다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              tk.KEYWORD_SEQ,
              k.KEYWORD_NAME
            FROM T_TREND_KEYWORD_SNAPSHOT tk
            JOIN T_TREND_KEYWORD_MASTER k ON k.KEYWORD_SEQ = tk.KEYWORD_SEQ
            WHERE tk.TREND_RUN_SEQ = %s
            ORDER BY tk.TREND_RANK ASC
            """,
            (trend_run_seq,),
        )
        rows = cur.fetchall() or []

    out: List[KeywordRow] = []
    for r in rows:
        out.append(KeywordRow(keyword_seq=int(r["KEYWORD_SEQ"]), keyword_name=str(r["KEYWORD_NAME"])))
    return out


def select_sum_counts_by_keyword(
    *,
    conn,
    trend_run_seq: int,
    period_filter: str,
) -> Dict[int, int]:
    """
    T_ANALYZE_MEDIA_STAT에서 키워드별 전체 기사수를 읽어온다.

    우선순위:
    1) MEDIA_CODE = 0 (전체 합계 행)이 있으면 그 값을 사용
    2) 전체 합계 행이 없는 경우에만 MEDIA_CODE <> 0 합계를 fallback으로 사용

    기존 구현은 MEDIA_CODE 조건 없이 SUM(ARTICLE_COUNT)를 수행해서,
    전체 행(MEDIA_CODE=0) + 언론사별 행(MEDIA_CODE<>0)을 함께 더하는 바람에
    값이 2배로 저장될 수 있었다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              KEYWORD_SEQ,
              COALESCE(
                MAX(CASE WHEN MEDIA_CODE = 0 THEN ARTICLE_COUNT END),
                SUM(CASE WHEN MEDIA_CODE <> 0 THEN ARTICLE_COUNT ELSE 0 END)
              ) AS CNT
            FROM T_ANALYZE_MEDIA_STAT
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
            GROUP BY KEYWORD_SEQ
            """,
            (trend_run_seq, period_filter),
        )
        rows = cur.fetchall() or []

    out: Dict[int, int] = {}
    for r in rows:
        k = int(r["KEYWORD_SEQ"])
        out[k] = int(r["CNT"] or 0)
    return out
