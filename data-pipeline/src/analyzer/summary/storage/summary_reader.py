# data-pipeline/src/analyzer/summary/storage/summary_reader.py
# 키워드 AI 요약을 위한 DB 조회 전용(reader)
# - 최신 TREND_RUN_SEQ
# - BASE_DATE
# - 요약 대상 키워드 목록(우선 FINAL_RANK(D7), 없으면 TREND_KEYWORD)
# - 키워드명
# - D7 윈도우에서 키워드별 기사 입력 후보(언론사별 최신 N)

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List

PERIOD_D7 = "D7"


@dataclass(frozen=True)
class ArticleInput:
    article_seq: int
    media_code: int
    published_at: datetime
    title_clean: str
    content_clean: str


def get_latest_trend_run_seq(*, conn) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT MAX(TREND_RUN_SEQ) AS mx FROM T_TREND_RUN")
        row = cur.fetchone() or {}
        mx = row.get("mx")
        if mx is None:
            raise RuntimeError("T_TREND_RUN이 비어있습니다. 먼저 run_crawl을 실행해 주세요.")
        return int(mx)


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


def select_keywords_for_summary(*, conn, trend_run_seq: int, top_n: int) -> List[int]:
    """
    우선순위:
    1) T_TREND_KEYWORD_FINAL_RANK (D7 기준) 상위 N
       - top_n <= 0 이면 LIMIT 없이 전체
    2) 없으면 T_TREND_KEYWORD_SNAPSHOT (TREND_RANK 기준) 상위 N
       - top_n <= 0 이면 LIMIT 없이 전체
    """
    top_n = int(top_n)

    # 1) FINAL_RANK(D7) 우선
    sql1 = """
        SELECT KEYWORD_SEQ
        FROM T_TREND_KEYWORD_FINAL_RANK
        WHERE TREND_RUN_SEQ = %s
          AND PERIOD_FILTER = 'D7'
        ORDER BY FINAL_RANK ASC
    """
    params1 = [trend_run_seq]
    if top_n > 0:
        sql1 += " LIMIT %s"
        params1.append(top_n)

    with conn.cursor() as cur:
        cur.execute(sql1, tuple(params1))
        rows = cur.fetchall() or []
        out = [int(r["KEYWORD_SEQ"]) for r in rows]

    if out:
        return out

    # 2) FINAL_RANK가 없으면 TREND_RANK로 폴백
    sql2 = """
        SELECT KEYWORD_SEQ
        FROM T_TREND_KEYWORD_SNAPSHOT
        WHERE TREND_RUN_SEQ = %s
        ORDER BY TREND_RANK ASC
    """
    params2 = [trend_run_seq]
    if top_n > 0:
        sql2 += " LIMIT %s"
        params2.append(top_n)

    with conn.cursor() as cur:
        cur.execute(sql2, tuple(params2))
        rows = cur.fetchall() or []
        return [int(r["KEYWORD_SEQ"]) for r in rows]


def select_keyword_name(*, conn, keyword_seq: int) -> str:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT KEYWORD_NAME
            FROM T_TREND_KEYWORD_MASTER
            WHERE KEYWORD_SEQ = %s
            """,
            (keyword_seq,),
        )
        row = cur.fetchone() or {}
        return str(row.get("KEYWORD_NAME") or "")


def select_articles_for_keyword_d7(
    *,
    conn,
    trend_run_seq: int,
    keyword_seq: int,
    start_date: date,
    end_date: date,
    per_media_limit: int,
    content_min_chars: int,
) -> List[ArticleInput]:
    """
    D7 윈도우에서
    - 해당 키워드/런
    - media별 최신 N개
    - TITLE_CLEAN, CONTENT_CLEAN 기반(둘 중 하나라도 없으면 제외)
    - CONTENT_CLEAN 길이가 너무 짧으면 제외(content_min_chars)
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              ARTICLE_SEQ,
              MEDIA_CODE,
              PUBLISHED_AT,
              TITLE_CLEAN,
              CONTENT_CLEAN
            FROM (
              SELECT
                a.ARTICLE_SEQ,
                a.MEDIA_CODE,
                a.PUBLISHED_AT,
                a.TITLE_CLEAN,
                a.CONTENT_CLEAN,
                ROW_NUMBER() OVER (
                  PARTITION BY a.MEDIA_CODE
                  ORDER BY a.PUBLISHED_AT DESC, a.ARTICLE_SEQ DESC
                ) AS rn
              FROM T_NEWS_ARTICLE a
              WHERE a.TREND_RUN_SEQ = %s
                AND a.KEYWORD_SEQ = %s
                AND a.PUBLISHED_AT IS NOT NULL
                AND DATE(a.PUBLISHED_AT) BETWEEN %s AND %s
                AND a.TITLE_CLEAN IS NOT NULL
                AND a.CONTENT_CLEAN IS NOT NULL
                AND CHAR_LENGTH(a.CONTENT_CLEAN) >= %s
            ) x
            WHERE x.rn <= %s
            ORDER BY x.MEDIA_CODE ASC, x.PUBLISHED_AT DESC, x.ARTICLE_SEQ DESC
            """,
            (trend_run_seq, keyword_seq, start_date, end_date, content_min_chars, per_media_limit),
        )
        rows = cur.fetchall() or []

    out: List[ArticleInput] = []
    for r in rows:
        out.append(
            ArticleInput(
                article_seq=int(r["ARTICLE_SEQ"]),
                media_code=int(r["MEDIA_CODE"]),
                published_at=r["PUBLISHED_AT"],
                title_clean=str(r["TITLE_CLEAN"] or "").strip(),
                content_clean=str(r["CONTENT_CLEAN"] or "").strip(),
            )
        )
    return out
