# data-pipeline/src/analyzer/aggregate/core/aggregate.py
# 집계 로직(core): 기간 윈도우 구성 + (키워드×언론사) 그리드 생성
# - DB 접근 없음

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Sequence, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7)


@dataclass(frozen=True)
class PeriodWindow:
    period_filter: str
    start_date: date
    end_date: date


def build_windows(*, base_date: date, periods: Sequence[str]) -> List[PeriodWindow]:
    windows: List[PeriodWindow] = []

    for p in periods:
        if p == PERIOD_TODAY:
            windows.append(PeriodWindow(period_filter=PERIOD_TODAY, start_date=base_date, end_date=base_date))
        elif p == PERIOD_D7:
            start = base_date - timedelta(days=6)
            windows.append(PeriodWindow(period_filter=PERIOD_D7, start_date=start, end_date=base_date))
        else:
            raise ValueError(f"지원하지 않는 period_filter: {p}")

    return windows


def build_upsert_rows_for_window(
    *,
    keyword_seqs: Sequence[int],
    media_codes: Sequence[int],
    counts_map: Dict[Tuple[int, int], int],
    trend_run_seq: int,
    period_filter: str,
) -> List[Tuple[Any, ...]]:
    """
    키워드×언론사 전체 조합을 만들고, 없는 건 0으로 채워 upsert rows 생성.
    반환 row 스키마:
      (KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER, ARTICLE_COUNT, TREND_RUN_SEQ)
    """
    rows: List[Tuple[Any, ...]] = []
    for k in keyword_seqs:
        for m in media_codes:
            cnt = int(counts_map.get((k, m), 0))
            rows.append((k, m, period_filter, cnt, trend_run_seq))
    return rows


def chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]
