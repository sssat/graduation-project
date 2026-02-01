# data-pipeline/src/analyzer/aggregate/core/aggregate.py
# 집계 로직(core): 기간 윈도우 구성 + (키워드×언론사) 그리드 생성
# - DB 접근 없음

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from typing import Any, Dict, Iterable, List, Sequence, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"
PERIOD_D30 = "D30"
SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30)

MEDIA_TOTAL = 0  # 전체 집계용 MEDIA_CODE


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
        elif p == PERIOD_D14:
            start = base_date - timedelta(days=13)
            windows.append(PeriodWindow(period_filter=PERIOD_D14, start_date=start, end_date=base_date))
        elif p == PERIOD_D30:
            start = base_date - timedelta(days=29)
            windows.append(PeriodWindow(period_filter=PERIOD_D30, start_date=start, end_date=base_date))
        else:
            raise ValueError(f"지원하지 않는 period_filter: {p}")

    return windows


def _dedupe_keep_order(seq: Sequence[int]) -> List[int]:
    seen = set()
    out: List[int] = []
    for x in seq:
        xi = int(x)
        if xi in seen:
            continue
        seen.add(xi)
        out.append(xi)
    return out


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
    + 정책:
      - MEDIA_CODE=0(전체) 행을 항상 생성한다.
      - (키워드, 0) 카운트가 counts_map에 없으면, (키워드, 매체별) 합으로 자동 계산해 채운다.
        (단, media_codes에 들어있는 매체들만 합산한다)

    반환 row 스키마:
      (KEYWORD_SEQ, MEDIA_CODE, PERIOD_FILTER, ARTICLE_COUNT, TREND_RUN_SEQ)
    """
    # 1) media_codes 정규화 + 중복 제거(순서 유지)
    normalized_media_codes = _dedupe_keep_order([int(m) for m in media_codes])

    # 2) 전체(0) 강제 포함 (검증/프론트 요구사항이 '전체' 행을 기대한다면 필수)
    if MEDIA_TOTAL not in normalized_media_codes:
        normalized_media_codes = [MEDIA_TOTAL] + normalized_media_codes

    # 3) counts_map 복사본에서 (k,0) 자동 채우기(없을 때만)
    local_counts_map: Dict[Tuple[int, int], int] = dict(counts_map)

    # 전체 합을 만들 때는 0을 제외한 매체들만 합산
    non_total_media = [m for m in normalized_media_codes if m != MEDIA_TOTAL]

    for k in keyword_seqs:
        kk = int(k)
        key_total = (kk, MEDIA_TOTAL)
        if key_total not in local_counts_map:
            total_cnt = 0
            for m in non_total_media:
                total_cnt += int(local_counts_map.get((kk, int(m)), 0))
            local_counts_map[key_total] = int(total_cnt)

    # 4) 그리드 rows 생성
    rows: List[Tuple[Any, ...]] = []
    for k in keyword_seqs:
        kk = int(k)
        for m in normalized_media_codes:
            mm = int(m)
            cnt = int(local_counts_map.get((kk, mm), 0))
            rows.append((kk, mm, period_filter, cnt, int(trend_run_seq)))

    return rows


def chunked(seq: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        yield seq
        return
    for i in range(0, len(seq), size):
        yield seq[i : i + size]
