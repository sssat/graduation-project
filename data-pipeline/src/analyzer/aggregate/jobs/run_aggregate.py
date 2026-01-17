# data-pipeline/src/analyzer/aggregate/jobs/run_aggregate.py
# 키워드×언론사 집계 통계 적재 실행 엔트리포인트
# - T_NEWS_ARTICLE -> T_ANALYZE_MEDIA_STAT
#
# 목표:
# - 기본 실행은 .env(settings) 값으로만 동작:
#     python -m src.analyzer.aggregate.jobs.run_aggregate
# - 필요하면 CLI로도 일시 오버라이드 가능(옵션 제공)

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, List, Tuple
from zoneinfo import ZoneInfo

from src.analyzer.aggregate.core.aggregate import SUPPORTED_PERIODS, build_windows, build_upsert_rows_for_window
from src.analyzer.aggregate.storage.aggregate_reader import (
    get_base_date_for_run,
    get_keyword_seqs_for_run,
    get_media_codes_present_in_run,
    select_counts_map,
)
from src.analyzer.aggregate.storage.aggregate_writer import upsert_media_stat_rows_atomic
from src.analyzer.final_rank.storage.final_rank_reader import get_latest_trend_run_seq
from src.common.db import get_conn
from src.config.settings import settings


def _settings_summary_one_line() -> str:
    return (
        "[settings] "
        f"env={getattr(settings, 'app_env', 'unknown')} "
        f"tz={getattr(settings, 'tz', 'unknown')} "
        f"db={getattr(settings, 'db_host', 'unknown')}:{getattr(settings, 'db_port', 'unknown')}/{getattr(settings, 'db_name', 'unknown')} "
        f"log={getattr(settings, 'log_level', 'INFO')} "
        f"aggregate_log_dir={getattr(settings, 'log_dir_aggregate', '')} "
        f"agg_insert_chunk_size={getattr(settings, 'agg_insert_chunk_size', 800)} "
        f"agg_trend_run_seq={getattr(settings, 'agg_trend_run_seq', 0)} "
        f"agg_periods={getattr(settings, 'agg_periods', 'TODAY,D7')} "
        f"agg_refresh={1 if getattr(settings, 'agg_refresh', False) else 0}"
    )


def _parse_periods(raw: str | None) -> List[str]:
    if not raw:
        return list(SUPPORTED_PERIODS)

    parts = [p.strip().upper() for p in raw.split(",") if p.strip()]
    if not parts:
        return list(SUPPORTED_PERIODS)

    for p in parts:
        if p not in SUPPORTED_PERIODS:
            raise ValueError(f"지원하지 않는 period_filter: {p} (supported={list(SUPPORTED_PERIODS)})")

    return parts


def _resolve_trend_run_seq(requested: int) -> int:
    if requested and requested > 0:
        return requested

    conn = get_conn(autocommit=True)
    try:
        latest = get_latest_trend_run_seq(conn=conn)
        if latest is None:
            raise RuntimeError("T_TREND_RUN이 비어 있어 최신 TREND_RUN_SEQ를 찾을 수 없습니다.")
        return int(latest)
    finally:
        conn.close()


def _default_logs_dir() -> Path:
    raw = str(getattr(settings, "log_dir_aggregate", "") or "").strip()
    if raw:
        return Path(raw)
    return Path("src/analyzer/aggregate/logs")


def main() -> None:
    parser = argparse.ArgumentParser(description="키워드×언론사 집계 통계(T_ANALYZE_MEDIA_STAT) 적재")

    # 기본은 settings(.env)로 실행하고, CLI 인자가 들어오면 그 값으로 오버라이드한다.
    parser.add_argument("--trend-run-seq", type=int, default=None, help="대상 TREND_RUN_SEQ (미지정 시 .env의 AGG_TREND_RUN_SEQ 사용)")
    parser.add_argument(
        "--periods",
        type=str,
        default=None,
        help="대상 PERIOD_FILTER 목록(콤마 구분). 미지정 시 .env의 AGG_PERIODS 사용. 예: TODAY,D7",
    )
    parser.add_argument(
        "--refresh",
        type=int,
        choices=[0, 1],
        default=None,
        help="같은 run의 기존 통계를 삭제 후 재적재(0/1). 미지정 시 .env의 AGG_REFRESH 사용",
    )
    parser.add_argument(
        "--insert-chunk-size",
        type=int,
        default=None,
        help="UPSERT executemany chunk size. 미지정/0 이하이면 settings.agg_insert_chunk_size 사용",
    )

    args = parser.parse_args()

    print(_settings_summary_one_line())

    # 1) 실행 옵션 결정: CLI > settings(.env)
    requested_trend_run_seq = (
        int(args.trend_run_seq)
        if args.trend_run_seq is not None
        else int(getattr(settings, "agg_trend_run_seq", 0))
    )
    trend_run_seq = _resolve_trend_run_seq(requested_trend_run_seq)

    raw_periods = args.periods if args.periods is not None else str(getattr(settings, "agg_periods", "TODAY,D7"))
    periods = _parse_periods(raw_periods)

    refresh_same_run = (
        bool(int(args.refresh))
        if args.refresh is not None
        else bool(getattr(settings, "agg_refresh", False))
    )

    insert_chunk_size = (
        int(args.insert_chunk_size)
        if args.insert_chunk_size is not None
        else int(getattr(settings, "agg_insert_chunk_size", 800))
    )
    if insert_chunk_size <= 0:
        insert_chunk_size = int(getattr(settings, "agg_insert_chunk_size", 800))
    insert_chunk_size = max(1, insert_chunk_size)

    # 2) reader로 원천 데이터 조회 + 3) core로 rows 생성 (DB write 없음)
    conn = get_conn(autocommit=True)
    try:
        base_date = get_base_date_for_run(conn=conn, trend_run_seq=trend_run_seq)
        keyword_seqs = get_keyword_seqs_for_run(conn=conn, trend_run_seq=trend_run_seq)
        media_codes = get_media_codes_present_in_run(conn=conn, trend_run_seq=trend_run_seq)

        if not keyword_seqs:
            result: dict[str, Any] = {
                "trend_run_seq": trend_run_seq,
                "base_date": str(base_date),
                "periods": periods,
                "keywords": 0,
                "media": len(media_codes),
                "rows_prepared": 0,
                "rows_written": 0,
                "deleted_rows": 0,
                "note": "해당 run에 키워드가 없습니다(T_TREND_KEYWORD_SNAPSHOT 비어있음).",
            }
        elif not media_codes:
            result = {
                "trend_run_seq": trend_run_seq,
                "base_date": str(base_date),
                "periods": periods,
                "keywords": len(keyword_seqs),
                "media": 0,
                "rows_prepared": 0,
                "rows_written": 0,
                "deleted_rows": 0,
                "note": "해당 run에 기사(T_NEWS_ARTICLE)가 없어서 MEDIA_CODE를 찾지 못했습니다.",
            }
        else:
            windows = build_windows(base_date=base_date, periods=periods)

            all_rows: List[Tuple[Any, ...]] = []
            for w in windows:
                counts_map = select_counts_map(
                    conn=conn,
                    trend_run_seq=trend_run_seq,
                    start_date=w.start_date,
                    end_date=w.end_date,
                )
                rows = build_upsert_rows_for_window(
                    keyword_seqs=keyword_seqs,
                    media_codes=media_codes,
                    counts_map=counts_map,
                    trend_run_seq=trend_run_seq,
                    period_filter=w.period_filter,
                )
                all_rows.extend(rows)

            # 4) writer(write-only)로 저장
            write_stats = upsert_media_stat_rows_atomic(
                trend_run_seq=trend_run_seq,
                rows=all_rows,
                refresh_same_run=refresh_same_run,
                insert_chunk_size=insert_chunk_size,
            )

            result = {
                "trend_run_seq": trend_run_seq,
                "base_date": str(base_date),
                "periods": [
                    {"filter": w.period_filter, "start": str(w.start_date), "end": str(w.end_date)} for w in windows
                ],
                "keywords": len(keyword_seqs),
                "media": len(media_codes),
                "rows_prepared": len(all_rows),
                "rows_written": int(write_stats.get("rows_written", 0)),
                "deleted_rows": int(write_stats.get("deleted_rows", 0)),
                "refresh_same_run": bool(refresh_same_run),
                "insert_chunk_size": int(insert_chunk_size),
            }

    finally:
        conn.close()

    # 콘솔 출력
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 로그 저장
    logs_dir = _default_logs_dir()
    logs_dir.mkdir(parents=True, exist_ok=True)

    now = datetime.now(tz=ZoneInfo(getattr(settings, "tz", "Asia/Seoul")))
    ts = now.strftime("%Y%m%d_%H%M%S")

    out_payload = {
        "mode": "aggregate_media_stat",
        "ran_at": now.isoformat(),
        "settings_summary": _settings_summary_one_line(),
        "cli_args": {
            "trend_run_seq": args.trend_run_seq,
            "periods": args.periods,
            "refresh": args.refresh,
            "insert_chunk_size": args.insert_chunk_size,
        },
        "resolved": {
            "trend_run_seq": int(trend_run_seq),
            "periods": periods,
            "refresh": bool(refresh_same_run),
            "insert_chunk_size": int(insert_chunk_size),
        },
        "result": result,
    }

    out_path = logs_dir / f"run_aggregate_media_stat_run{trend_run_seq}_{ts}.json"
    out_path.write_text(json.dumps(out_payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[saved] {out_path}")


if __name__ == "__main__":
    main()
