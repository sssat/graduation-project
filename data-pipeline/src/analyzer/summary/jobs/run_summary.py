# data-pipeline/src/analyzer/summary/jobs/run_summary.py
# 키워드 AI 요약(LLM 호출) + DB 적재(요약/기사 매핑)까지 한 번에 실행하는 트리거(엔트리포인트)
# - 실행 로그(JSON)는 settings.log_dir_summary 경로로 저장
#   (기본: src/analyzer/summary/logs, .env의 LOG_DIR_SUMMARY로 변경 가능)

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings
from src.analyzer.summary.core.summary import run_keyword_ai_summary_for_run
from src.analyzer.summary.storage.summary_reader import get_latest_trend_run_seq


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _settings_summary_one_line(*, refresh: bool, trend_run_seq: int) -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"summary_log_dir={settings.log_dir_summary} "
        f"ai(model={settings.ai_summary_model},temp={settings.ai_summary_temperature},max_out={settings.ai_summary_max_output_tokens}) "
        f"ai_input(per_media={settings.ai_summary_per_media_limit},clip_max={settings.ai_summary_content_clip_max}) "
        f"ai_keywords(top_n={settings.ai_summary_keyword_top_n},min_articles={settings.ai_summary_min_articles}) "
        f"trend_run_seq={int(trend_run_seq)} "
        f"refresh={int(bool(refresh))}"
    )


def _resolve_trend_run_seq(requested: int) -> int:
    if requested and requested > 0:
        return int(requested)

    conn = get_conn(autocommit=True)
    try:
        latest = get_latest_trend_run_seq(conn=conn)
        if latest is None:
            raise RuntimeError("T_TREND_RUN이 비어 있어 최신 TREND_RUN_SEQ를 찾을 수 없습니다.")
        return int(latest)
    finally:
        conn.close()


def main() -> None:
    parser = argparse.ArgumentParser()

    # CLI는 "필요할 때만 덮어쓰기" 용도로 남겨두고, 기본값은 settings(.env)에서 읽도록 한다.
    parser.add_argument("--trend-run-seq", type=int, default=None, help="대상 TREND_RUN_SEQ (미지정/0이면 최신 run 사용)")

    group = parser.add_mutually_exclusive_group()
    group.add_argument("--refresh", dest="refresh", action="store_true", help="같은 run의 기존 요약/매핑을 삭제 후 재생성")
    group.add_argument("--no-refresh", dest="refresh", action="store_false", help="refresh 비활성화(설정값 무시)")
    parser.set_defaults(refresh=None)

    args = parser.parse_args()

    requested_run = settings.summary_trend_run_seq if args.trend_run_seq is None else int(args.trend_run_seq or 0)
    refresh = settings.summary_refresh if args.refresh is None else bool(args.refresh)

    trend_run_seq = _resolve_trend_run_seq(int(requested_run))

    print(_settings_summary_one_line(refresh=refresh, trend_run_seq=trend_run_seq))

    started_at = _now_in_tz()

    stats = run_keyword_ai_summary_for_run(
        trend_run_seq=trend_run_seq,
        refresh_same_run=refresh,
    )

    ended_at = _now_in_tz()

    result: Dict[str, Any] = {
        "mode": "run_summary",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": _settings_summary_one_line(refresh=refresh, trend_run_seq=trend_run_seq),
        "args": {
            "trend_run_seq": int(trend_run_seq),
            "refresh": bool(refresh),
        },
        "trend_run_seq": int(trend_run_seq),
        "summary": stats,
    }

    print(json.dumps(result, ensure_ascii=False, indent=2))

    logs_dir = Path(settings.log_dir_summary)
    logs_dir.mkdir(parents=True, exist_ok=True)

    ts = ended_at.strftime("%Y%m%d_%H%M%S")
    base_date = str(stats.get("base_date") or "unknown")
    out_path = logs_dir / f"run_summary_{base_date}_run{trend_run_seq}_{ts}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"[saved] {out_path}")


if __name__ == "__main__":
    main()
