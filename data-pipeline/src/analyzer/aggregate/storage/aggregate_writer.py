# // data-pipeline/src/analyzer/aggregate/storage/aggregate_writer.py
# 키워드×언론사 집계 통계(T_ANALYZE_MEDIA_STAT) 적재 전용 writer (WRITE ONLY)
#
# 역할(쓰기만):
# - (옵션) 특정 run의 기존 통계 삭제
# - 준비된 upsert rows를 T_ANALYZE_MEDIA_STAT에 UPSERT로 저장
#
# 주의:
# - 이 파일은 DB 조회(reader)나 윈도우/그리드 생성(core)을 하지 않는다.
# - keyword_seqs/media_codes/windows/counts_map/rows 생성은 호출자가 담당한다.

from __future__ import annotations

from typing import Any, Iterable, List, Sequence, Tuple

from src.common.db import get_conn


def _chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def delete_stats_by_run(*, conn, trend_run_seq: int) -> int:
    """
    특정 TREND_RUN_SEQ에 해당하는 집계 통계를 삭제한다.
    """
    with conn.cursor() as cur:
        cur.execute("DELETE FROM T_ANALYZE_MEDIA_STAT WHERE TREND_RUN_SEQ = %s", (int(trend_run_seq),))
        return int(cur.rowcount or 0)


def upsert_media_stat_rows(
    *,
    conn,
    rows: Sequence[Tuple[Any, ...]],
    insert_chunk_size: int = 800,
) -> int:
    """
    준비된 upsert rows를 T_ANALYZE_MEDIA_STAT에 UPSERT 한다.

    rows 스키마(순서 고정):
      (KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER, ARTICLE_COUNT, TREND_RUN_SEQ)

    반환:
      upsert 시도한 row 수(=len(rows))
    """
    if not rows:
        return 0

    upsert_sql = """
        INSERT INTO T_ANALYZE_MEDIA_STAT (
          KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER, ARTICLE_COUNT, TREND_RUN_SEQ
        )
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          ARTICLE_COUNT = VALUES(ARTICLE_COUNT),
          CREATED_AT = CURRENT_TIMESTAMP
    """

    with conn.cursor() as cur:
        for chunk in _chunked(list(rows), int(insert_chunk_size)):
            cur.executemany(upsert_sql, list(chunk))

    return len(rows)


def upsert_media_stat_rows_atomic(
    *,
    trend_run_seq: int,
    rows: Sequence[Tuple[Any, ...]],
    refresh_same_run: bool = False,
    insert_chunk_size: int = 800,
) -> dict[str, Any]:
    """
    (편의 함수) 트랜잭션을 이 writer 내부에서 끝내고 싶을 때 사용.
    - refresh_same_run=True면 해당 run 데이터를 먼저 삭제 후 UPSERT
    - rows는 호출자가 이미 만들어서 넘겨줘야 한다.

    반환: 통계 dict
    """
    conn = get_conn(autocommit=False)
    try:
        deleted = 0
        if refresh_same_run:
            deleted = delete_stats_by_run(conn=conn, trend_run_seq=int(trend_run_seq))

        written = upsert_media_stat_rows(conn=conn, rows=rows, insert_chunk_size=insert_chunk_size)

        conn.commit()
        return {
            "trend_run_seq": int(trend_run_seq),
            "rows_written": int(written),
            "deleted_rows": int(deleted),
            "refresh_same_run": bool(refresh_same_run),
            "insert_chunk_size": int(insert_chunk_size),
        }
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()
