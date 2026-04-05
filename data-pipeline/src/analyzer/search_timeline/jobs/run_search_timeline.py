from __future__ import annotations

import argparse
import json
import random
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List
from zoneinfo import ZoneInfo

from src.analyzer.final_rank.storage.final_rank_reader import get_latest_trend_run_seq
from src.analyzer.search_timeline.core.search_timeline import (
    SearchTimelineFetchResult,
    SearchTimelinePoint,
    fetch_search_timeline,
)
from src.analyzer.search_timeline.storage.search_timeline_reader import (
    fetch_keyword_seqs_collected_for_trend_run,
)
from src.analyzer.search_timeline.storage.search_timeline_writer import (
    SearchTimelineRow,
    upsert_search_timeline_rows,
)
from src.common.db import get_conn
from src.config.settings import settings
from src.crawler.news.storage.keyword_reader import fetch_keywords_for_trend_run


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _sleep_between_requests() -> None:
    min_seconds = float(settings.search_timeline_sleep_min_seconds)
    max_seconds = float(settings.search_timeline_sleep_max_seconds)
    if max_seconds <= 0.0:
        return

    time.sleep(random.uniform(min_seconds, max_seconds))


def _resolve_trend_run_seq(requested: int) -> int:
    if requested > 0:
        return int(requested)

    conn = get_conn(autocommit=True)
    try:
        latest = get_latest_trend_run_seq(conn=conn)
        if latest is None:
            raise RuntimeError("T_TREND_RUN is empty, so the latest TREND_RUN_SEQ could not be resolved.")
        return int(latest)
    finally:
        conn.close()


def _ensure_log_dir() -> Path:
    path = Path(settings.log_dir_search_timeline)
    path.mkdir(parents=True, exist_ok=True)
    return path


def _settings_one_line(*, trend_run_seq: int, keyword_limit: int) -> str:
    return (
        "[settings] "
        "source=naver_datalab "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"trend_run_seq={trend_run_seq} "
        f"keyword_top_n={keyword_limit} "
        f"batch_size={settings.search_timeline_batch_size} "
        f"refresh_same_run={1 if settings.search_timeline_refresh else 0} "
        f"timeframe={settings.search_timeline_timeframe} "
        f"device={settings.naver_datalab_device or '(all)'} "
        f"gender={settings.naver_datalab_gender or '(all)'} "
        f"ages={settings.naver_datalab_ages or '(all)'} "
        f"sleep_range={settings.search_timeline_sleep_min_seconds:.1f}~"
        f"{settings.search_timeline_sleep_max_seconds:.1f}s "
        f"skip_if_collected_same_run={0 if settings.search_timeline_refresh else 1}"
    )


def _to_db_rows(points: List[SearchTimelinePoint]) -> List[SearchTimelineRow]:
    return [
        SearchTimelineRow(
            observed_date=point.observed_date,
            interest_score=point.interest_score,
            is_partial=point.is_partial,
        )
        for point in points
    ]


def _append_timeline_item(
    items: List[Dict[str, Any]],
    *,
    keyword_seq: int,
    keyword_name: str,
    trend_rank: int,
    points_fetched: int,
    points_written: int,
    skipped_same_run: bool,
    status: str,
    attempts: int | None = None,
    error: str | None = None,
) -> None:
    item: Dict[str, Any] = {
        "keyword_seq": int(keyword_seq),
        "keyword_name": keyword_name,
        "trend_rank": int(trend_rank),
        "points_fetched": points_fetched,
        "points_written": points_written,
        "skipped_same_run": skipped_same_run,
        "status": status,
    }
    if attempts is not None:
        item["attempts"] = int(attempts)
    if error:
        item["error"] = error
    items.append(item)


def run_search_timeline(*, trend_run_seq: int) -> Dict[str, Any]:
    keyword_rows = fetch_keywords_for_trend_run(int(trend_run_seq))
    if not keyword_rows:
        raise RuntimeError("No keywords were found for the specified TREND_RUN_SEQ.")

    keyword_limit = int(settings.search_timeline_keyword_top_n)
    if keyword_limit > 0:
        keyword_rows = keyword_rows[:keyword_limit]

    items: List[Dict[str, Any]] = []
    total_points_written = 0
    skipped_same_run_count = 0
    deferred_batch_count = 0
    success_count = 0
    rate_limited_count = 0
    no_data_count = 0
    error_count = 0

    conn = get_conn(autocommit=False)
    try:
        if settings.search_timeline_refresh:
            collected_for_run_keyword_seqs = set()
        else:
            collected_for_run_keyword_seqs = fetch_keyword_seqs_collected_for_trend_run(
                conn=conn,
                trend_run_seq=int(trend_run_seq),
                keyword_seqs=[row.keyword_seq for row in keyword_rows],
                timeframe_label=settings.search_timeline_timeframe,
            )
        pending_keyword_rows = [
            row for row in keyword_rows
            if row.keyword_seq not in collected_for_run_keyword_seqs
        ]
        batch_size = int(settings.search_timeline_batch_size)
        batch_target_count = len(pending_keyword_rows) if batch_size <= 0 else min(len(pending_keyword_rows), batch_size)
        processed_pending_count = 0

        for idx, keyword_row in enumerate(keyword_rows, start=1):
            did_request = False

            if keyword_row.keyword_seq in collected_for_run_keyword_seqs:
                skipped_same_run_count += 1
                _append_timeline_item(
                    items,
                    keyword_seq=int(keyword_row.keyword_seq),
                    keyword_name=keyword_row.keyword_name,
                    trend_rank=int(keyword_row.trend_rank),
                    points_fetched=0,
                    points_written=0,
                    skipped_same_run=True,
                    status="skipped_same_run",
                )
                continue

            if batch_size > 0 and processed_pending_count >= batch_size:
                deferred_batch_count += 1
                _append_timeline_item(
                    items,
                    keyword_seq=int(keyword_row.keyword_seq),
                    keyword_name=keyword_row.keyword_name,
                    trend_rank=int(keyword_row.trend_rank),
                    points_fetched=0,
                    points_written=0,
                    skipped_same_run=False,
                    status="deferred_batch",
                )
                continue

            try:
                did_request = True
                processed_pending_count += 1
                fetch_result: SearchTimelineFetchResult = fetch_search_timeline(
                    keyword_name=keyword_row.keyword_name,
                    timeframe=settings.search_timeline_timeframe,
                )
                points = fetch_result.points

                written = upsert_search_timeline_rows(
                    conn=conn,
                    keyword_seq=keyword_row.keyword_seq,
                    trend_run_seq=int(trend_run_seq),
                    timeframe_label=settings.search_timeline_timeframe,
                    rows=_to_db_rows(points),
                )

                conn.commit()
                total_points_written += written
                if fetch_result.status == "success":
                    success_count += 1
                elif fetch_result.status == "rate_limited":
                    rate_limited_count += 1
                elif fetch_result.status == "no_data":
                    no_data_count += 1

                _append_timeline_item(
                    items,
                    keyword_seq=int(keyword_row.keyword_seq),
                    keyword_name=keyword_row.keyword_name,
                    trend_rank=int(keyword_row.trend_rank),
                    points_fetched=len(points),
                    points_written=written,
                    skipped_same_run=False,
                    status=fetch_result.status,
                    attempts=fetch_result.attempts,
                )
            except Exception as exc:
                conn.rollback()
                error_count += 1
                _append_timeline_item(
                    items,
                    keyword_seq=int(keyword_row.keyword_seq),
                    keyword_name=keyword_row.keyword_name,
                    trend_rank=int(keyword_row.trend_rank),
                    points_fetched=0,
                    points_written=0,
                    skipped_same_run=False,
                    status="error",
                    error=str(exc),
                )

            if idx < len(keyword_rows) and did_request:
                _sleep_between_requests()
    finally:
        conn.close()

    return {
        "trend_run_seq": int(trend_run_seq),
        "keyword_count": len(keyword_rows),
        "pending_keyword_count": len(pending_keyword_rows),
        "batch_target_count": batch_target_count,
        "total_points_written": total_points_written,
        "skipped_same_run_count": skipped_same_run_count,
        "deferred_batch_count": deferred_batch_count,
        "success_count": success_count,
        "rate_limited_count": rate_limited_count,
        "no_data_count": no_data_count,
        "error_count": error_count,
        "items": items,
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fetch and store Naver DataLab search-interest timeline for the current run keywords."
    )
    parser.add_argument(
        "--trend-run-seq",
        type=int,
        default=None,
        help="Target TREND_RUN_SEQ. If omitted or 0, use the latest run.",
    )
    args = parser.parse_args()

    requested_run = (
        settings.search_timeline_trend_run_seq
        if args.trend_run_seq is None
        else int(args.trend_run_seq or 0)
    )
    trend_run_seq = _resolve_trend_run_seq(int(requested_run))
    keyword_limit = int(settings.search_timeline_keyword_top_n)

    print(_settings_one_line(trend_run_seq=trend_run_seq, keyword_limit=keyword_limit))

    started_at = _now_in_tz()
    stats = run_search_timeline(trend_run_seq=trend_run_seq)
    ended_at = _now_in_tz()

    result: Dict[str, Any] = {
        "mode": "run_search_timeline",
        "source": "naver_datalab",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": _settings_one_line(trend_run_seq=trend_run_seq, keyword_limit=keyword_limit),
        "args": {
            "trend_run_seq": trend_run_seq,
        },
        "timeline": stats,
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

    logs_dir = _ensure_log_dir()
    ts = ended_at.strftime("%Y%m%d_%H%M%S")
    out_path = logs_dir / f"run_search_timeline_run{trend_run_seq}_{ts}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[saved] {out_path}")


if __name__ == "__main__":
    main()
