# data-pipeline/src/analyzer/bias/content/jobs/run_content_bias.py
# 본문 편향도 지수 계산 + DB 저장(T_ANALYZE_MEDIA_BIAS.BIAS_SCORE_CONTENT) 실행 트리거
#
# 목표:
# - 기본값은 settings(.env)에서 읽고, 필요하면 CLI로 덮어쓴다.
# - (TODAY,D7,D14,D30) 같은 복수 기간을 한 번에 실행할 수 있게 periods를 지원한다.
#
# 사용 예:
# 1) 아무 옵션 없이 실행 (settings 기본값 사용)
#   python -m src.analyzer.bias.content.jobs.run_content_bias
#
# 2) 특정 run만 지정
#   python -m src.analyzer.bias.content.jobs.run_content_bias --trend-run-seq 15
#
# 3) 기간 복수 지정
#   python -m src.analyzer.bias.content.jobs.run_content_bias --periods TODAY,D7,D14,D30
#
# 4) refresh(같은 run+period 재실행 시 본문 점수만 reset 후 재적재)
#   python -m src.analyzer.bias.content.jobs.run_content_bias --refresh

from __future__ import annotations

import argparse
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Sequence
from zoneinfo import ZoneInfo

from src.common.db import get_conn
from src.config.settings import settings

from src.analyzer.bias.content.core.content_bias import (
    PERIOD_D14,
    PERIOD_D7,
    PERIOD_TODAY,
    PERIOD_D30,
    SentimentContentRow as CoreSentimentContentRow,
    compute_content_bias_items,
)
from src.analyzer.bias.content.storage.content_bias_reader import (
    get_latest_trend_run_seq,
    select_keyword_name,
    select_media_article_counts,
    select_media_sentiments_content,
    select_overall_sentiments_content,
)
from src.analyzer.bias.content.storage.content_bias_writer import (
    reset_content_bias_for_run_period,
    upsert_content_bias_rows,
)


def _now_in_tz() -> datetime:
    return datetime.now(tz=ZoneInfo(settings.tz))


def _logs_dir() -> Path:
    # 무조건 settings 통해서만 경로 사용
    return Path(settings.log_dir_bias_content)


def _parse_periods(raw: str) -> List[str]:
    """
    콤마 구분 기간 문자열을 TODAY/D7/D14/D30 리스트로 정규화한다.
    - 허용: TODAY, D7, D14, D30
    - 중복 제거(순서 유지)
    - 비어있으면 기본 ["TODAY", "D7", "D14", "D30"]
      (원하면 settings.bias_content_periods에서 기본을 TODAY,D7,D14,D30로 바꿔도 됨)
    """
    allowed = {PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30}
    raw = (raw or "").strip()
    if not raw:
        return [PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30]

    parts = [p.strip().upper() for p in raw.split(",") if p.strip()]
    if not parts:
        return [PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30]

    seen: set[str] = set()
    out: List[str] = []
    for p in parts:
        if p in seen:
            continue
        seen.add(p)
        out.append(p)

    bad = [p for p in out if p not in allowed]
    if bad:
        raise ValueError(
            f"--periods에는 {PERIOD_TODAY},{PERIOD_D7},{PERIOD_D14},{PERIOD_D30}만 허용됩니다. 잘못된 값: {bad}"
        )

    return out


def _settings_summary_one_line(*, trend_run_seq: int, periods: Sequence[str], refresh: bool) -> str:
    return (
        "[settings] "
        f"env={settings.app_env} "
        f"tz={settings.tz} "
        f"db={settings.db_host}:{settings.db_port}/{settings.db_name} "
        f"log={settings.log_level} "
        f"bias_content_log_dir={settings.log_dir_bias_content} "
        f"trend_run_seq={int(trend_run_seq)} "
        f"periods={','.join(periods)} "
        f"refresh={1 if refresh else 0}"
    )


def _write_json_log(payload: Dict[str, Any]) -> str:
    """
    실행 로그(JSON)를 settings.log_dir_bias_content에 저장한다.
    파일명은 started_at 기반으로 만든다.
    """
    log_dir = _logs_dir()
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

    path = log_dir / f"run_content_bias_{safe_ts}.json"
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return str(path)


def _resolve_trend_run_seq(requested: int) -> int:
    """
    requested:
      - >0 이면 그대로 사용
      - 0 또는 음수면 최신 run 자동 선택
    """
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


def _ensure_keyword_name_map(*, conn, keyword_seqs: Sequence[int]) -> Dict[int, str]:
    # reader에 bulk 쿼리가 없어서 1건씩 조회(캐시 형태로 구성)
    out: Dict[int, str] = {}
    for k in keyword_seqs:
        kseq = int(k)
        if kseq in out:
            continue
        out[kseq] = select_keyword_name(conn=conn, keyword_seq=kseq)
    return out


def _run_one_period(
    *,
    conn,
    trend_run_seq: int,
    period_filter: str,
    refresh_same_run: bool,
) -> Dict[str, Any]:
    period = str(period_filter).upper().strip()
    if period not in (PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30):
        raise ValueError(f"period_filter는 {PERIOD_TODAY}/{PERIOD_D7}/{PERIOD_D14}/{PERIOD_D30} 중 하나여야 합니다: {period}")

    # 1) 입력 조회
    media_rows_db = select_media_sentiments_content(conn=conn, trend_run_seq=trend_run_seq, period_filter=period)
    overall_map = select_overall_sentiments_content(conn=conn, trend_run_seq=trend_run_seq, period_filter=period)
    article_count_map = select_media_article_counts(conn=conn, trend_run_seq=trend_run_seq, period_filter=period)

    # 2) core 타입으로 변환(모듈 간 dataclass 타입이 다를 수 있어 안전하게 재구성)
    media_rows: List[CoreSentimentContentRow] = [
        CoreSentimentContentRow(
            keyword_seq=int(r.keyword_seq),
            media_code=int(r.media_code),
            period_filter=str(r.period_filter),
            positive_pct_content=float(r.positive_pct_content),
            neutral_pct_content=float(r.neutral_pct_content),
            negative_pct_content=float(r.negative_pct_content),
        )
        for r in (media_rows_db or [])
    ]

    keyword_seqs = sorted({int(r.keyword_seq) for r in media_rows})
    keyword_name_map = _ensure_keyword_name_map(conn=conn, keyword_seqs=keyword_seqs)

    # 3) 계산
    items, calc_stats = compute_content_bias_items(
        trend_run_seq=trend_run_seq,
        period_filter=period,
        media_rows=media_rows,
        overall_map=overall_map,
        article_count_map=article_count_map,
        keyword_name_map=keyword_name_map,
    )

    # 4) 적재 (refresh 시 본문 점수만 reset)
    reset_count = 0
    if bool(refresh_same_run):
        reset_count = reset_content_bias_for_run_period(conn=conn, trend_run_seq=trend_run_seq, period_filter=period)

    upsert_rows = [
        (int(it.keyword_seq), int(it.media_code), str(it.period_filter), float(it.bias_score_content))
        for it in items
    ]
    written = upsert_content_bias_rows(conn=conn, trend_run_seq=trend_run_seq, rows=upsert_rows, batch=800)

    return {
        "period_filter": period,
        "input_rows_media": int(len(media_rows_db or [])),
        "overall_rows": int(len(overall_map or {})),
        "items": int(len(items)),
        "reset_rows": int(reset_count),
        "written_rows": int(written),
        "calc_stats": calc_stats,
    }


def main() -> None:
    # settings(.env) 기본값: BIAS_CONTENT_* 에서 읽는다.
    default_trend_run_seq = int(settings.bias_content_trend_run_seq)
    default_periods_raw = str(settings.bias_content_periods)
    default_refresh = bool(settings.bias_content_refresh)

    parser = argparse.ArgumentParser(description="본문 편향도(Content Bias) 계산 + DB 저장")

    parser.add_argument(
        "--trend-run-seq",
        type=int,
        default=default_trend_run_seq,
        help="대상 TREND_RUN_SEQ (0이면 최신 run 사용)",
    )

    # 하위호환: --period (단일 or 콤마구분도 허용)
    parser.add_argument(
        "--period",
        type=str,
        default="",
        help=f"(deprecated) 기간 필터({PERIOD_TODAY}/{PERIOD_D7}/{PERIOD_D14}/{PERIOD_D30}). 가능하면 --periods 사용",
    )

    # 권장: --periods TODAY,D7,D14,D30
    parser.add_argument(
        "--periods",
        type=str,
        default=default_periods_raw,
        help=f"기간 필터 목록(예: {PERIOD_TODAY} 또는 {PERIOD_TODAY},{PERIOD_D7},{PERIOD_D14}, {PERIOD_D30})",
    )

    parser.add_argument(
        "--refresh",
        action="store_true",
        help="같은 run+period의 기존 본문 편향도 점수를 초기화 후 재계산(기본값은 settings.bias_content_refresh)",
    )

    args = parser.parse_args()

    # refresh: CLI에 --refresh가 있으면 True, 없으면 settings 기본값
    refresh = bool(args.refresh) if args.refresh else bool(default_refresh)

    # periods: --period(하위호환) > --periods > settings(default로 이미 반영됨)
    if str(args.period or "").strip():
        periods = _parse_periods(str(args.period).strip())
    else:
        periods = _parse_periods(str(args.periods).strip())

    trend_run_seq = _resolve_trend_run_seq(int(args.trend_run_seq))

    started_at = _now_in_tz()
    settings_summary = _settings_summary_one_line(trend_run_seq=trend_run_seq, periods=periods, refresh=refresh)
    print(settings_summary)

    # period별 수행
    per_period_results: List[Dict[str, Any]] = []

    conn = get_conn(autocommit=False)
    try:
        for p in periods:
            per_period_results.append(
                _run_one_period(
                    conn=conn,
                    trend_run_seq=trend_run_seq,
                    period_filter=p,
                    refresh_same_run=refresh,
                )
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

    ended_at = _now_in_tz()

    payload: Dict[str, Any] = {
        "mode": "run_content_bias",
        "started_at": started_at.isoformat(),
        "ended_at": ended_at.isoformat(),
        "settings_summary": settings_summary,
        "trend_run_seq": int(trend_run_seq),
        "periods": periods,
        "refresh": bool(refresh),
        "results": per_period_results,
    }

    log_path = _write_json_log(payload)
    payload["log_path"] = log_path

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
