# data-pipeline/src/analyzer/final_rank/storage/final_rank_writer.py
# 키워드×기간필터 최종 순위(T_TREND_KEYWORD_FINAL_RANK) 적재 전용 writer
#
# 역할:
# - reader로 원천데이터 조회
# - core(calc)로 필터링/랭킹 계산
# - 결과를 T_TREND_KEYWORD_FINAL_RANK에 UPSERT로 저장
#
# 필터링 정책(최종 순위에서만 적용):
# - 숫자만(예: "2026") 키워드는 제외
# - 영문만(예: "new year's day") 키워드는 기본 제외
#   단, 화이트리스트(환경변수 KEYWORD_ENGLISH_WHITELIST)에 포함되면 허용

from __future__ import annotations
from src.config.settings import settings
from typing import Any, Dict, Iterable, List, Sequence, Tuple

from src.common.db import get_conn
from src.analyzer.final_rank.core.final_rank_calc import (
    SUPPORTED_PERIODS,
    FilterStats,
    parse_english_whitelist,
    filter_keywords_for_final_rank,
    rank_by_article_count,
)
from src.analyzer.final_rank.storage.final_rank_reader import (
    get_keywords_for_run,
    select_sum_counts_by_keyword,
)


def _chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]


def _delete_by_run(*, conn, trend_run_seq: int) -> int:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM T_TREND_KEYWORD_FINAL_RANK WHERE TREND_RUN_SEQ = %s", (trend_run_seq,))
        return int(cur.rowcount or 0)


def _delete_excluded_for_period(
    *,
    conn,
    trend_run_seq: int,
    period_filter: str,
    excluded_keyword_seqs: List[int],
) -> int:
    """
    refresh가 아니더라도, 이번 정책으로 제외된 키워드가 과거에 적재된 행을 남겨두면
    UI에서 계속 보일 수 있으므로 해당 period에 대해서만 제거한다.
    """
    if not excluded_keyword_seqs:
        return 0

    total = 0
    with conn.cursor() as cur:
        for chunk in _chunked(excluded_keyword_seqs, 500):
            placeholders = ",".join(["%s"] * len(chunk))
            sql = f"""
                DELETE FROM T_TREND_KEYWORD_FINAL_RANK
                WHERE TREND_RUN_SEQ = %s
                  AND PERIOD_FILTER = %s
                  AND KEYWORD_SEQ IN ({placeholders})
            """
            cur.execute(sql, (trend_run_seq, period_filter, *list(chunk)))
            total += int(cur.rowcount or 0)
    return total


def upsert_TREND_keyword_final_rank_for_run(
    *,
    trend_run_seq: int,
    periods: Sequence[str] = SUPPORTED_PERIODS,
    refresh_same_run: bool = False,
) -> Dict[str, Any]:
    """
    T_TREND_KEYWORD_FINAL_RANK 적재(UPSERT)

    - trend_run_seq: 대상 회차
    - periods: ["TODAY","D7"] 등
    - refresh_same_run=True면 해당 run의 기존 최종순위 데이터를 먼저 삭제 후 재적재

    반환: 실행 통계(dict)
    """
    for p in periods:
        if p not in SUPPORTED_PERIODS:
            raise ValueError(f"지원하지 않는 period_filter: {p}")

    whitelist = parse_english_whitelist(getattr(settings, "keyword_english_whitelist", ""))

    conn = get_conn(autocommit=False)
    try:
        keywords = get_keywords_for_run(conn=conn, trend_run_seq=trend_run_seq)

        if not keywords:
            return {
                "trend_run_seq": trend_run_seq,
                "periods": list(periods),
                "keywords": 0,
                "rows_written": 0,
                "deleted_rows": 0,
                "excluded": {"total": 0, "numeric_only": 0, "english_only": 0, "kept_by_whitelist": 0},
                "note": "해당 run에 키워드가 없습니다(T_TREND_KEYWORD 비어있음).",
            }

        deleted_rows = 0
        if refresh_same_run:
            deleted_rows = _delete_by_run(conn=conn, trend_run_seq=trend_run_seq)

        upsert_sql = """
            INSERT INTO T_TREND_KEYWORD_FINAL_RANK (
              TREND_RUN_SEQ, KEYWORD_SEQ, PERIOD_FILTER, ARTICLE_COUNT, FINAL_RANK
            )
            VALUES (%s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
              ARTICLE_COUNT = VALUES(ARTICLE_COUNT),
              FINAL_RANK = VALUES(FINAL_RANK),
              CREATED_AT = CURRENT_TIMESTAMP
        """

        rows_written = 0

        excluded_total = 0
        excluded_numeric = 0
        excluded_english = 0
        kept_by_whitelist = 0

        for period in periods:
            # 1) period별 기사수 합계 맵
            sum_map = select_sum_counts_by_keyword(conn=conn, trend_run_seq=trend_run_seq, period_filter=period)

            # 2) 키워드 필터링(최종순위에서만)
            included, excluded_keyword_seqs, stats = filter_keywords_for_final_rank(
                keywords=keywords,
                english_whitelist=whitelist,
            )

            excluded_total += stats.excluded_total
            excluded_numeric += stats.excluded_numeric
            excluded_english += stats.excluded_english
            kept_by_whitelist += stats.kept_by_whitelist

            # refresh가 아니더라도 이번 정책으로 제외된 키워드가 기존에 남아있으면 제거
            deleted_rows += _delete_excluded_for_period(
                conn=conn,
                trend_run_seq=trend_run_seq,
                period_filter=period,
                excluded_keyword_seqs=excluded_keyword_seqs,
            )

            # 3) 랭킹 계산
            ranked_rows = rank_by_article_count(included=included, sum_map=sum_map)

            # 4) UPSERT (executemany)
            params: List[Tuple[int, int, str, int, int]] = []
            for (kseq, cnt, final_rank) in ranked_rows:
                params.append((trend_run_seq, kseq, period, int(cnt), int(final_rank)))

            with conn.cursor() as cur:
                if params:
                    cur.executemany(upsert_sql, params)
            rows_written += len(params)

        conn.commit()
        return {
            "trend_run_seq": trend_run_seq,
            "periods": list(periods),
            "keywords": len(keywords),
            "rows_written": rows_written,
            "deleted_rows": deleted_rows,
            "excluded": {
                "total": excluded_total,
                "numeric_only": excluded_numeric,
                "english_only": excluded_english,
                "kept_by_whitelist": kept_by_whitelist,
                "english_whitelist_size": len(whitelist),
            },
            "note": "숫자-only 제외, 영문-only는 whitelist만 허용(최종순위에서만 적용).",
        }

    except Exception:
        try:
            conn.rollback()
        except Exception:
            pass
        raise
    finally:
        conn.close()
