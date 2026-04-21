from __future__ import annotations

from typing import Any, Dict, Iterable, List, Sequence

from src.common.db import get_conn
from src.crawler.news.storage.article_writer import CrawledArticle


def _chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def fetch_articles_for_run(
    *,
    trend_run_seq: int,
    keyword_names: Sequence[str] | None = None,
    keyword_in_query_batch_size: int = 500,
) -> List[CrawledArticle]:
    names = [str(name).strip() for name in (keyword_names or []) if str(name).strip()]

    conn = get_conn()
    try:
        rows: List[Dict[str, Any]] = []
        with conn.cursor() as cur:
            if not names:
                cur.execute(
                    """
                    SELECT
                      k.KEYWORD_NAME AS keyword_name,
                      a.TREND_RUN_SEQ AS trend_run_seq,
                      a.MEDIA_CODE AS media_code,
                      a.SOURCE_URL AS source_url,
                      a.PUBLISHED_AT AS published_at,
                      a.TITLE AS title,
                      a.CONTENT_TEXT AS content_text,
                      a.TITLE_CLEAN AS title_clean,
                      a.CONTENT_CLEAN AS content_clean,
                      a.PREPROCESSED_AT AS preprocessed_at
                    FROM T_NEWS_ARTICLE a
                    JOIN T_TREND_KEYWORD_MASTER k ON k.KEYWORD_SEQ = a.KEYWORD_SEQ
                    WHERE a.TREND_RUN_SEQ = %s
                    ORDER BY a.MEDIA_CODE ASC, k.KEYWORD_NAME ASC, a.ARTICLE_SEQ ASC
                    """,
                    (int(trend_run_seq),),
                )
                rows = list(cur.fetchall() or [])
            else:
                for chunk in _chunked(names, max(1, int(keyword_in_query_batch_size))):
                    placeholders = ",".join(["%s"] * len(chunk))
                    cur.execute(
                        f"""
                        SELECT
                          k.KEYWORD_NAME AS keyword_name,
                          a.TREND_RUN_SEQ AS trend_run_seq,
                          a.MEDIA_CODE AS media_code,
                          a.SOURCE_URL AS source_url,
                          a.PUBLISHED_AT AS published_at,
                          a.TITLE AS title,
                          a.CONTENT_TEXT AS content_text,
                          a.TITLE_CLEAN AS title_clean,
                          a.CONTENT_CLEAN AS content_clean,
                          a.PREPROCESSED_AT AS preprocessed_at
                        FROM T_NEWS_ARTICLE a
                        JOIN T_TREND_KEYWORD_MASTER k ON k.KEYWORD_SEQ = a.KEYWORD_SEQ
                        WHERE a.TREND_RUN_SEQ = %s
                          AND k.KEYWORD_NAME IN ({placeholders})
                        ORDER BY a.MEDIA_CODE ASC, k.KEYWORD_NAME ASC, a.ARTICLE_SEQ ASC
                        """,
                        [int(trend_run_seq), *list(chunk)],
                    )
                    rows.extend(cur.fetchall() or [])

        return [
            CrawledArticle(
                keyword_name=str(row["keyword_name"]),
                trend_run_seq=int(row["trend_run_seq"]),
                media_code=int(row["media_code"]),
                source_url=str(row["source_url"]),
                published_at=row["published_at"],
                title=str(row["title"] or ""),
                content_text=str(row["content_text"] or ""),
                title_clean=row["title_clean"],
                content_clean=row["content_clean"],
                preprocessed_at=row["preprocessed_at"],
            )
            for row in rows
        ]
    finally:
        conn.close()
