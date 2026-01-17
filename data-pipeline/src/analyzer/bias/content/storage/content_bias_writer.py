# data-pipeline/src/analyzer/bias/content/storage/content_bias_writer.py
# 본문 편향도 결과를 T_ANALYZE_MEDIA_BIAS에 적재(writer)
# - "적재만" 담당(조회/계산 로직 없음)
# - 본문 편향도는 BIAS_SCORE_CONTENT 컬럼에 저장한다.
#
# 중요(모듈 간 refresh 충돌 방지):
# - title/content가 같은 테이블(T_ANALYZE_MEDIA_BIAS)을 공유하므로 DELETE는 금지.
# - refresh는 "해당 컬럼만" UPDATE로 0 초기화한다.
#
# 타임스탬프 정책(일관성):
# - CREATED_AT은 "최초 생성 시각"만 기록한다.
# - content refresh/UPSERT가 CREATED_AT을 덮어쓰면 title 모듈 정책과 충돌하므로,
#   CREATED_AT은 절대 변경하지 않는다.

from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple


def reset_content_bias_for_run_period(*, conn, trend_run_seq: int, period_filter: str) -> int:
    """
    본문 점수만 초기화(제목 점수 보존).
    - DELETE를 하면 제목(BIAS_SCORE_TITLE)도 같이 사라질 수 있으므로 UPDATE로 처리한다.
    - CREATED_AT은 최초 생성 시각이므로 변경하지 않는다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE T_ANALYZE_MEDIA_BIAS
            SET
              BIAS_SCORE_CONTENT = 0
            WHERE TREND_RUN_SEQ = %s
              AND PERIOD_FILTER = %s
            """,
            (int(trend_run_seq), str(period_filter).upper().strip()),
        )
        return int(cur.rowcount or 0)


def _chunked(seq: Sequence[Tuple[int, int, str, float]], size: int) -> Iterable[Sequence[Tuple[int, int, str, float]]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def upsert_content_bias_rows(
    *,
    conn,
    trend_run_seq: int,
    rows: List[Tuple[int, int, str, float]],
    batch: int = 800,
) -> int:
    """
    본문 편향도 UPSERT 적재.
    - rows: (keyword_seq, media_code, period_filter, bias_score_content)

    정책:
    - 이미 존재하는 행이면 BIAS_SCORE_CONTENT만 갱신한다.
    - 다른 점수 컬럼(예: BIAS_SCORE_TITLE)은 건드리지 않는다.
    - CREATED_AT은 최초 생성 시각이므로 UPDATE/UPSERT에서 변경하지 않는다.
    """
    if not rows:
        return 0

    sql = """
        INSERT INTO T_ANALYZE_MEDIA_BIAS (
          TREND_RUN_SEQ, KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER,
          BIAS_SCORE_CONTENT
        )
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          BIAS_SCORE_CONTENT = VALUES(BIAS_SCORE_CONTENT)
    """

    written = 0
    with conn.cursor() as cur:
        for chunk in _chunked(rows, int(batch)):
            params = [
                (int(trend_run_seq), int(k), int(m), str(p).upper().strip(), float(s))
                for (k, m, p, s) in chunk
            ]
            cur.executemany(sql, params)
            written += len(params)

    return written
