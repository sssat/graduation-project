# data-pipeline/src/preprocess/storage/preprocess_writer.py
# 전처리된 데이터를 DB에 적재(writer)하는 모듈


from __future__ import annotations

from typing import Any, Iterable, List, Sequence, Tuple


def _chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def update_articles(
    *,
    conn,
    update_rows: List[Tuple[Any, ...]],
    batch: int,
    refresh: bool,
) -> int:
    if not update_rows:
        return 0

    if refresh:
        sql = """
            UPDATE T_NEWS_ARTICLE
            SET
              TITLE_CLEAN = %s,
              CONTENT_CLEAN = %s,
              PREPROCESSED_AT = %s
            WHERE ARTICLE_SEQ = %s
        """
    else:
        sql = """
            UPDATE T_NEWS_ARTICLE
            SET
              TITLE_CLEAN = %s,
              CONTENT_CLEAN = %s,
              PREPROCESSED_AT = %s
            WHERE ARTICLE_SEQ = %s
              AND PREPROCESSED_AT IS NULL
        """

    updated = 0
    with conn.cursor() as cur:
        for chunk in _chunked(update_rows, batch):
            cur.executemany(sql, list(chunk))
            updated += int(cur.rowcount or 0)
    return updated


def update_comments(
    *,
    conn,
    update_rows: List[Tuple[Any, ...]],
    batch: int,
    refresh: bool,
) -> int:
    if not update_rows:
        return 0

    if refresh:
        sql = """
            UPDATE T_NEWS_COMMENT
            SET
              COMMENT_CLEAN = %s,
              PREPROCESSED_AT = %s
            WHERE COMMENT_SEQ = %s
        """
    else:
        sql = """
            UPDATE T_NEWS_COMMENT
            SET
              COMMENT_CLEAN = %s,
              PREPROCESSED_AT = %s
            WHERE COMMENT_SEQ = %s
              AND PREPROCESSED_AT IS NULL
        """

    updated = 0
    with conn.cursor() as cur:
        for chunk in _chunked(update_rows, batch):
            cur.executemany(sql, list(chunk))
            updated += int(cur.rowcount or 0)
    return updated
