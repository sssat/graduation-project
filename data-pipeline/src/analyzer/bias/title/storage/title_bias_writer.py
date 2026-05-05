# data-pipeline/src/analyzer/bias/title/storage/title_bias_writer.py
# 편향도 결과를 T_ANALYZE_MEDIA_BIAS에 적재(writer)
# - 제목 편향도는 BIAS_SCORE_TITLE 컬럼에 저장(본문은 별도 모듈에서 BIAS_SCORE_CONTENT에 저장)
#
# 중요(모듈 간 refresh 충돌 방지):
# - title 모듈 refresh는 "행 DELETE"를 하면 content 점수까지 같이 날아가므로 금지.
# - 대신 같은 run+period 범위에서 BIAS_SCORE_TITLE만 0으로 reset 한다.
#   (content 점수 유지)
#
# 타임스탬프 정책:
# - CREATED_AT은 "최초 생성 시각"만 기록한다.
# - UPDATE/UPSERT 시 CREATED_AT은 절대 변경하지 않는다.

from __future__ import annotations

from typing import Iterable, List, Sequence, Tuple


def reset_title_bias_for_run_period(*, conn, trend_run_seq: int, period_filter: str) -> int:
    """
    같은 run+period의 제목 편향 점수만 reset(0으로) 한다.
    - 행은 유지하므로 BIAS_SCORE_CONTENT 등 다른 컬럼은 보존된다.
    - CREATED_AT은 최초 생성 시각이므로 변경하지 않는다.
    """
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE T_ANALYZE_MEDIA_BIAS
            SET BIAS_SCORE_TITLE = 0
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


def upsert_title_bias_rows(
    *,
    conn,
    trend_run_seq: int,
    rows: List[Tuple[int, int, str, float]],
    batch: int = 800,
) -> int:
    """
    rows: (keyword_seq, media_code, period_filter, bias_score_title)

    - 이미 존재하는 행이면 BIAS_SCORE_TITLE만 갱신한다.
    - 다른 점수 컬럼(예: BIAS_SCORE_CONTENT)은 건드리지 않는다.
    - CREATED_AT은 최초 생성 시각이므로 UPDATE 시 변경하지 않는다.
    """
    if not rows:
        return 0

    sql = """
        INSERT INTO T_ANALYZE_MEDIA_BIAS (
          TREND_RUN_SEQ, KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER,
          BIAS_SCORE_TITLE
        )
        VALUES (%s, %s, %s, %s, %s)
        ON DUPLICATE KEY UPDATE
          BIAS_SCORE_TITLE = VALUES(BIAS_SCORE_TITLE)
    """

    written = 0
    with conn.cursor() as cur:
        for chunk in _chunked(rows, int(batch)):
            # DECIMAL(5,2)이므로 저장값을 소수 2자리로 정규화
            params = [
                (int(trend_run_seq), int(k), int(m), str(p).upper().strip(), float(round(float(s), 2)))
                for (k, m, p, s) in chunk
            ]
            cur.executemany(sql, params)
            written += len(params)

    return written
