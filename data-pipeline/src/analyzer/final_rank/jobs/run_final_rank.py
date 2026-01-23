# data-pipeline/src/analyzer/final_rank/jobs/run_final_rank.py
# 최종 순위 집계 실행 엔트리포인트
# - T_ANALYZE_MEDIA_STAT -> T_TREND_KEYWORD_FINAL_RANK
#
# 목표:
# - 기본 실행을 "python -m src.analyzer.final_rank.jobs.run_final_rank" 한 줄로 가능하게
# - 옵션을 주면 옵션 우선, 옵션이 없으면 settings(.env) 기본값 사용

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence
from zoneinfo import ZoneInfo

from src.config.settings import settings
from src.analyzer.final_rank.core.final_rank_calc import SUPPORTED_PERIODS
from src.analyzer.final_rank.storage.final_rank_reader import get_latest_trend_run_seq
from src.analyzer.final_rank.storage.final_rank_writer import upsert_TREND_keyword_final_rank_for_run


def _now_iso() -> str:
    return datetime.now(tz=ZoneInfo(settings.tz)).isoformat()


def _parse_periods(raw: str) -> List[str]:
    """
    "TODAY,D7,D14" 형태를 ["TODAY","D7","D14]로 파싱한다.
    - 공백 제거, 대문자 정규화
    - SUPPORTED_PERIODS 외 값은 에러 처리
    """
    s = (raw or "").strip()
    if not s:
        return ["TODAY", "D7", "D14"]

    items: List[str] = []
    for part in s.split(","):
        p = (part or "").strip().upper()
        if not p:
            continue
        items.append(p)

    if not items:
        return ["TODAY", "D7", "D14"]

    for p in items:
        if p not in SUPPORTED_PERIODS:
            raise ValueError(f"지원하지 않는 period_filter: {p} (지원: {', '.join(SUPPORTED_PERIODS)})")

    return items


def _resolve_trend_run_seq(requested: Optional[int]) -> int:
    """
    우선순위:
      1) CLI에서 지정한 값(requested)이 있으면 사용
      2) 없으면 settings.final_rank_trend_run_seq 사용
         - 그 값이 0이면 DB에서 최신 trend_run_seq 조회
    """
    base = requested if requested is not None else int(getattr(settings, "final_rank_trend_run_seq", 0))
    base = int(base)

    if base != 0:
        return base

    # 0이면 최신 자동
    from src.common.db import get_conn  # 지연 import(순환/부하 회피)

    conn = get_conn(autocommit=True)
    try:
        latest = get_latest_trend_run_seq(conn=conn)
    finally:
        conn.close()

    if latest is None:
        raise RuntimeError("T_TREND_RUN에 데이터가 없습니다. run_trend를 먼저 실행하세요.")
    return int(latest)


def _resolve_refresh(cli_refresh: bool) -> bool:
    """
    argparse에서 --refresh가 없으면 False로 들어오므로,
    '옵션 미지정 시 settings 값'을 적용하려면 default를 None으로 분리하는 방식이 필요하다.
    여기서는 간단히:
      - CLI에 --refresh가 있으면 True
      - 없으면 settings.final_rank_refresh 사용
    """
    if cli_refresh:
        return True
    return bool(getattr(settings, "final_rank_refresh", False))


def _settings_summary_one_line(*, trend_run_seq: int, periods: Sequence[str], refresh: bool) -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"final_rank_log_dir={settings.log_dir_final_rank} "
        f"trend_run_seq={trend_run_seq} "
        f"periods={','.join(periods)} "
        f"refresh={1 if refresh else 0} "
        f"english_whitelist={getattr(settings, 'keyword_english_whitelist', '')}"
    )


def _write_json_log(payload: Dict[str, Any]) -> Optional[str]:
    """
    settings.log_dir_final_rank 아래에 실행 로그(JSON)를 저장한다.
    """
    log_dir = (settings.log_dir_final_rank or "").strip()
    if not log_dir:
        return None

    p = Path(log_dir)
    p.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(tz=ZoneInfo(settings.tz)).strftime("%Y%m%d_%H%M%S")
    out_path = p / f"final_rank_{ts}.json"
    out_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description="최종 순위 집계(run_final_rank)")
    parser.add_argument(
        "--trend-run-seq",
        type=int,
        default=None,
        help="대상 TREND_RUN_SEQ (0이면 최신 자동). 미지정 시 .env(FINAL_RANK_TREND_RUN_SEQ) 사용",
    )
    parser.add_argument(
        "--periods",
        type=str,
        default=None,
        help='기간 필터 목록(콤마 구분) 예: "TODAY,D7,D14". 미지정 시 .env(FINAL_RANK_PERIODS) 사용',
    )
    parser.add_argument(
        "--refresh",
        action="store_true",
        help="같은 run의 기존 최종순위 삭제 후 재적재(미지정 시 .env(FINAL_RANK_REFRESH) 사용)",
    )

    args = parser.parse_args()

    # 1) 옵션/환경변수 해석
    trend_run_seq = _resolve_trend_run_seq(args.trend_run_seq)

    periods_raw = args.periods if args.periods is not None else str(getattr(settings, "final_rank_periods", "TODAY,D7,D14"))
    periods = _parse_periods(periods_raw)

    refresh = _resolve_refresh(bool(args.refresh))

    started_at = _now_iso()
    settings_summary = _settings_summary_one_line(trend_run_seq=trend_run_seq, periods=periods, refresh=refresh)
    print(settings_summary)

    # 2) 실행
    try:
        result = upsert_TREND_keyword_final_rank_for_run(
            trend_run_seq=trend_run_seq,
            periods=periods,
            refresh_same_run=refresh,
        )

        ended_at = _now_iso()
        payload: Dict[str, Any] = {
            "mode": "final_rank",
            "started_at": started_at,
            "ended_at": ended_at,
            "settings_summary": settings_summary,
            "trend_run_seq": trend_run_seq,
            "periods": list(periods),
            "refresh": bool(refresh),
            "result": result,
        }

        log_path = _write_json_log(payload)
        if log_path:
            payload["log_path"] = log_path

        print(json.dumps(payload, ensure_ascii=False, indent=2))

    except Exception as e:
        ended_at = _now_iso()
        payload = {
            "mode": "final_rank",
            "started_at": started_at,
            "ended_at": ended_at,
            "settings_summary": settings_summary,
            "trend_run_seq": trend_run_seq,
            "periods": list(periods),
            "refresh": bool(refresh),
            "error": {"type": type(e).__name__, "message": str(e)},
        }

        log_path = _write_json_log(payload)
        if log_path:
            payload["log_path"] = log_path

        print(json.dumps(payload, ensure_ascii=False, indent=2))
        raise


if __name__ == "__main__":
    main()
