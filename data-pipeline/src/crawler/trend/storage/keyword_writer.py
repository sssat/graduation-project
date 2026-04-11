# data-pipeline/src/crawler/trend/storage/keyword_writer.py
# 구글 트렌드에서 크롤링한 실시간 검색어 데이터를 DB에 저장(적재)하는 역할

from __future__ import annotations

from datetime import date, datetime
from typing import Iterable
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings


# save_trend_snapshot_with_run(): 구글 트렌드에서 크롤링한 실시간 검색어 데이터를 DB에 저장(적재)하는 함수
def save_trend_snapshot_with_run(
    keywords: Iterable[str],
    *,
    base_date: date | None = None,
    run_at: datetime | None = None,
) -> tuple[int, int]:
    tz = ZoneInfo(settings.tz)
    now_local = datetime.now(tz)
    run_at = (run_at or now_local).replace(tzinfo=None)
    base_date = base_date or now_local.date()

    cleaned: list[tuple[str, int]] = []
    for rank, kw in enumerate(keywords, start=1):
        kw = (kw or "").strip()
        if kw:
            cleaned.append((kw, rank))

    if not cleaned:
        return (0, 0)

    conn = get_conn(autocommit=False)
    try:
        with conn.cursor() as cur:
            # 1) 이번 실행(run) 생성
            top_n = len(cleaned)
            cur.execute(
                """
                INSERT INTO T_TREND_RUN (BASE_DATE, RUN_AT, TOP_N, IS_PUBLISHED, PUBLISHED_AT)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (base_date, run_at, top_n, 0, None),
            )
            run_seq = int(cur.lastrowid)

            # 2) 키워드 사전에 upsert(없으면 insert)
            cur.executemany(
                """
                INSERT INTO T_TREND_KEYWORD_MASTER (KEYWORD_NAME)
                VALUES (%s)
                ON DUPLICATE KEY UPDATE
                  KEYWORD_NAME = VALUES(KEYWORD_NAME)
                """,
                [(kw,) for kw, _rank in cleaned],
            )

            # 3) 이번 run에 해당하는 키워드의 KEYWORD_SEQ 조회
            names = [kw for kw, _rank in cleaned]
            placeholders = ",".join(["%s"] * len(names))
            cur.execute(
                f"""
                SELECT KEYWORD_SEQ, KEYWORD_NAME
                FROM T_TREND_KEYWORD_MASTER
                WHERE KEYWORD_NAME IN ({placeholders})
                """,
                names,
            )
            rows = cur.fetchall()
            name_to_seq = {r["KEYWORD_NAME"]: r["KEYWORD_SEQ"] for r in rows}

            # 4) 스냅샷 저장
            items: list[tuple[int, int, int]] = []
            for kw, rank in cleaned:
                keyword_seq = name_to_seq.get(kw)
                if keyword_seq is None:
                    continue
                items.append((run_seq, keyword_seq, rank))

            cur.executemany(
                """
                INSERT INTO T_TREND_KEYWORD_SNAPSHOT (TREND_RUN_SEQ, KEYWORD_SEQ, TREND_RANK)
                VALUES (%s, %s, %s)
                ON DUPLICATE KEY UPDATE
                  TREND_RANK = VALUES(TREND_RANK)
                """,
                items,
            )

        conn.commit()
        return (run_seq, len(cleaned))
    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()
