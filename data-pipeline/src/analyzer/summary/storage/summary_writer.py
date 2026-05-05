# data-pipeline/src/analyzer/summary/storage/summary_writer.py
# 키워드 AI 요약 적재 전용(DB write) 모듈
# - T_ANALYZE_AI_SUMMARY (헤더)
# - T_ANALYZE_AI_SUMMARY_ARTICLE (사용 기사 매핑)

from __future__ import annotations

from typing import Sequence


def delete_summary_for_keyword(*, conn, trend_run_seq: int, keyword_seq: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM T_ANALYZE_AI_SUMMARY
            WHERE TREND_RUN_SEQ = %s
              AND KEYWORD_SEQ = %s
            """,
            (trend_run_seq, keyword_seq),
        )
        return int(cur.rowcount or 0)


def upsert_summary_header(*, conn, trend_run_seq: int, keyword_seq: int, summary_text: str) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO T_ANALYZE_AI_SUMMARY (
              TREND_RUN_SEQ, KEYWORD_SEQ, SUMMARY_TEXT
            )
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE
              SUMMARY_TEXT = VALUES(SUMMARY_TEXT),
              CREATED_AT = CURRENT_TIMESTAMP
            """,
            (trend_run_seq, keyword_seq, summary_text),
        )

    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT SUMMARY_SEQ
            FROM T_ANALYZE_AI_SUMMARY
            WHERE TREND_RUN_SEQ = %s
              AND KEYWORD_SEQ = %s
            """,
            (trend_run_seq, keyword_seq),
        )
        row = cur.fetchone() or {}
        seq = row.get("SUMMARY_SEQ")
        if seq is None:
            raise RuntimeError("요약 헤더 UPSERT 후 SUMMARY_SEQ를 찾지 못했습니다.")
        return int(seq)


def delete_mapping_by_summary(*, conn, summary_seq: int) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            DELETE FROM T_ANALYZE_AI_SUMMARY_ARTICLE
            WHERE SUMMARY_SEQ = %s
            """,
            (summary_seq,),
        )
        return int(cur.rowcount or 0)


def insert_mapping_rows(*, conn, summary_seq: int, article_seqs_in_order: Sequence[int]) -> int:
    if not article_seqs_in_order:
        return 0

    with conn.cursor() as cur:
        sql = """
            INSERT INTO T_ANALYZE_AI_SUMMARY_ARTICLE (
              SUMMARY_SEQ, ARTICLE_SEQ, INPUT_ORDER
            )
            VALUES (%s, %s, %s)
        """
        rows = [(summary_seq, int(article_seq), idx) for idx, article_seq in enumerate(article_seqs_in_order, start=1)]
        cur.executemany(sql, rows)
        return len(rows)


def replace_mapping_rows(*, conn, summary_seq: int, article_seqs_in_order: Sequence[int]) -> int:
    delete_mapping_by_summary(conn=conn, summary_seq=summary_seq)
    return insert_mapping_rows(conn=conn, summary_seq=summary_seq, article_seqs_in_order=article_seqs_in_order)
