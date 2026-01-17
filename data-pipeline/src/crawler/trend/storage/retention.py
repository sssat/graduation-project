# data-pipeline/src/crawler/trend/storage/retention.py
# 오래된 트렌드 실행(T_TREND_RUN) 데이터를 정리하는 모듈
# 최근 N회차만 유지하고, 나머지는 삭제
# FK ON DELETE CASCADE로 연결된 하위 테이블들이 연쇄 삭제된다.


from __future__ import annotations

from src.common.db import get_conn
from src.config.settings import settings


def prune_old_trend_runs() -> int:
    keep_last_n = int(settings.retention_keep_last_n)

    # settings.__post_init__에서 이미 최소 1로 보정되지만, 방어적으로 한 번 더 체크
    if keep_last_n <= 0:
        return 0

    conn = get_conn(autocommit=False)
    try:
        with conn.cursor() as cur:
            # 전체 회차 수 확인
            cur.execute("SELECT COUNT(*) AS cnt FROM T_TREND_RUN")
            total = int((cur.fetchone() or {}).get("cnt", 0))

            if total <= keep_last_n:
                return 0

            # 최근 N개를 제외한 나머지 삭제
            # MySQL에서 같은 테이블을 서브쿼리로 바로 삭제하면 에러가 날 수 있어 derived table로 감싼다.
            cur.execute(
                """
                DELETE FROM T_TREND_RUN
                WHERE TREND_RUN_SEQ NOT IN (
                  SELECT TREND_RUN_SEQ FROM (
                    SELECT TREND_RUN_SEQ
                    FROM T_TREND_RUN
                    ORDER BY RUN_AT DESC, TREND_RUN_SEQ DESC
                    LIMIT %s
                  ) t
                )
                """,
                (keep_last_n,),
            )
            deleted = cur.rowcount

        conn.commit()
        return int(deleted)

    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise

    finally:
        conn.close()