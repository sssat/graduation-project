# data-pipeline/src/analyzer/bias/title/jobs/run_title_bias.py
# 제목 편향도 지수 계산 + DB 저장(T_ANALYZE_MEDIA_BIAS.BIAS_SCORE_TITLE) 실행 트리거
#
# 목표:
# - .env/settings 기본값만으로 아래 명령 1줄로 실행
#   python -m src.analyzer.bias.title.jobs.run_title_bias
#
# 하위호환 CLI:
# - --trend-run-seq 15
# - --period TODAY | D7 | D14 | D30
# - --periods TODAY,D7,D14,D30
# - --refresh

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings
from src.analyzer.bias.title.core.title_bias import (
    PERIOD_D7,
    PERIOD_D14,
    PERIOD_D30,
    PERIOD_TODAY,
    SUPPORTED_PERIODS,
    run_title_bias_for_run,
)
from src.analyzer.bias.title.storage.title_bias_reader import get_latest_trend_run_seq


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _parse_periods(raw: str) -> List[str]:
    """
    콤마 구분 기간 문자열을 TODAY/D7/D14/D30 리스트로 정규화한다.
    - 허용: TODAY, D7, D14, D30
    - 중복 제거(순서 유지)
    - 결과가 비면 기본 ["TODAY", "D7", "D14", "D30"]
    """
    allowed = set(SUPPORTED_PERIODS)

    raw = (raw or "").strip()
    if not raw:
        return [PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30]

    out: List[str] = []
    seen: set[str] = set()
    for part in raw.split(","):
        pf = part.strip().upper()
        if not pf:
            continue
        if pf not in allowed:
            continue
        if pf in seen:
            continue
        seen.add(pf)
        out.append(pf)

    return out if out else [PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30]


def _settings_one_line(*, trend_run_seq: int, periods: List[str], refresh: bool) -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"bias_title_log_dir={settings.log_dir_bias_title} "
        f"trend_run_seq={trend_run_seq} "
        f"periods={','.join(periods)} "
        f"refresh={1 if refresh else 0} "
        f"delta_scale={float(settings.bias_title_delta_scale)}"
    )


def _write_json_log(payload: Dict[str, Any]) -> str:
    """
    실행 로그(JSON)를 settings.log_dir_bias_title에 저장한다.
    파일명은 started_at 기반으로 만든다.
    """
    log_dir = Path(settings.log_dir_bias_title)
    log_dir.mkdir(parents=True, exist_ok=True)

    started_at = payload.get("started_at") or _now_in_tz().isoformat()
    safe_ts = (
        str(started_at)
        .replace(":", "")
        .replace("-", "")
        .replace(".", "")
        .replace("+", "p")
        .replace("T", "_")
    )
    path = log_dir / f"run_title_bias_{safe_ts}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="제목 편향도(Title Bias) 계산 + DB 저장")

    # trend_run_seq:
    # - 미지정 시 settings.bias_title_trend_run_seq 사용
    # - 0이면 최신 run 자동
    parser.add_argument("--trend-run-seq", type=int, default=None, help="대상 TREND_RUN_SEQ (0이면 최신 자동)")

    # periods:
    # - 미지정 시 settings.bias_title_periods 사용
    parser.add_argument("--periods", type=str, default=None, help="기간 목록(콤마 구분) 예: TODAY,D7,D14,D30")

    # 하위호환: 단일 period
    parser.add_argument("--period", type=str, default=None, help="단일 기간(TODAY 또는 D7 또는 D14 또는 D30)")

    # refresh:
    # - 옵션 미지정 시 settings.bias_title_refresh 사용
    parser.add_argument("--refresh", action="store_true", help="같은 run 재실행 시 제목 점수만 reset 후 재적재")

    args = parser.parse_args()

    # trend_run_seq 결정
    trend_run_seq = args.trend_run_seq if args.trend_run_seq is not None else int(settings.bias_title_trend_run_seq)

    # periods 결정: --periods > --period > settings
    raw_periods: str
    if args.periods is not None and str(args.periods).strip() != "":
        raw_periods = str(args.periods)
    elif args.period is not None and str(args.period).strip() != "":
        raw_periods = str(args.period)
    else:
        raw_periods = str(settings.bias_title_periods)

    periods = _parse_periods(raw_periods)

    # refresh 결정: CLI에 --refresh가 있으면 True, 없으면 settings 기준
    refresh = bool(args.refresh) if args.refresh else bool(settings.bias_title_refresh)

    # trend_run_seq=0이면 최신 run으로 치환
    resolved_run_seq: Optional[int] = None
    if int(trend_run_seq) == 0:
        conn = get_conn(autocommit=True)
        try:
            resolved_run_seq = get_latest_trend_run_seq(conn=conn)
        finally:
            conn.close()

        if resolved_run_seq is None:
            raise RuntimeError("T_TREND_RUN에 데이터가 없습니다. 먼저 run_trend를 실행하세요.")

        trend_run_seq = int(resolved_run_seq)

    started_at = _now_in_tz()
    settings_summary = _settings_one_line(trend_run_seq=int(trend_run_seq), periods=periods, refresh=refresh)
    print(settings_summary)

    results: List[Dict[str, Any]] = []
    for pf in periods:
        r = run_title_bias_for_run(
            trend_run_seq=int(trend_run_seq),
            period_filter=str(pf).upper().strip(),
            refresh_same_run=bool(refresh),
        )
        results.append(r)

    ended_at = _now_in_tz()

    payload: Dict[str, Any] = {
        "mode": "run_title_bias",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": settings_summary,
        "trend_run_seq": int(trend_run_seq),
        "periods": periods,
        "refresh": bool(refresh),
        "results": results,
    }

    log_path = _write_json_log(payload)
    payload["log_path"] = log_path

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
