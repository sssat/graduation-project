from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

from src.config.settings import settings

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"
PERIOD_D30 = "D30"
SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30)
_ALLOWED_PERIODS = set(SUPPORTED_PERIODS)


@dataclass(frozen=True)
class SentimentContentRow:
    keyword_seq: int
    media_code: int
    period_filter: str
    positive_pct_content: float
    neutral_pct_content: float
    negative_pct_content: float


@dataclass(frozen=True)
class ContentBiasItem:
    keyword_seq: int
    keyword_name: str
    media_code: int
    period_filter: str
    bias_score_content: float  # -10 .. +10 continuous score vs overall


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _to_prob3(pos_pct: float, neu_pct: float, neg_pct: float) -> Tuple[float, float, float]:
    """Normalize percent-like sentiment values into a probability triplet."""
    pos = max(0.0, float(pos_pct))
    neu = max(0.0, float(neu_pct))
    neg = max(0.0, float(neg_pct))

    total = pos + neu + neg
    if total <= 0.0:
        return (0.0, 0.0, 0.0)

    return (pos / total, neu / total, neg / total)


def _bias_score_content_continuous(
    *,
    media_pos: float,
    media_neu: float,
    media_neg: float,
    base_pos: float,
    base_neu: float,
    base_neg: float,
    delta_scale: float,
) -> float:
    """
    Convert content sentiment into a continuous bias score.

    The formula intentionally mirrors title-bias behavior, but is implemented
    locally in the content-bias module:
      media_net = pos - neg
      base_net = pos - neg
      delta_net = media_net - base_net
      score = clamp(delta_net * delta_scale, -10, +10)
    """
    media_prob = _to_prob3(media_pos, media_neu, media_neg)
    base_prob = _to_prob3(base_pos, base_neu, base_neg)

    media_net = media_prob[0] - media_prob[2]
    base_net = base_prob[0] - base_prob[2]
    delta_net = media_net - base_net

    return float(_clamp(delta_net * max(0.0, float(delta_scale)), -10.0, 10.0))


def _avg_overall_from_media(rows: Sequence[SentimentContentRow]) -> Optional[Tuple[float, float, float]]:
    if not rows:
        return None
    pos = sum(float(r.positive_pct_content) for r in rows) / len(rows)
    neu = sum(float(r.neutral_pct_content) for r in rows) / len(rows)
    neg = sum(float(r.negative_pct_content) for r in rows) / len(rows)
    return (pos, neu, neg)


def _weighted_overall_from_media(
    rows: Sequence[SentimentContentRow],
    *,
    counts: Dict[Tuple[int, int], int],
) -> Optional[Tuple[float, float, float]]:
    """Estimate the overall baseline from media rows using article counts."""
    if not rows:
        return None

    sum_w = 0.0
    sum_pos = 0.0
    sum_neu = 0.0
    sum_neg = 0.0

    for r in rows:
        weight = float(max(0, int(counts.get((int(r.keyword_seq), int(r.media_code)), 0))))
        if weight <= 0.0:
            continue
        sum_w += weight
        sum_pos += float(r.positive_pct_content) * weight
        sum_neu += float(r.neutral_pct_content) * weight
        sum_neg += float(r.negative_pct_content) * weight

    if sum_w <= 0.0:
        return None

    return (sum_pos / sum_w, sum_neu / sum_w, sum_neg / sum_w)


def compute_content_bias_items(
    *,
    trend_run_seq: int,
    period_filter: str,
    media_rows: Sequence[SentimentContentRow],
    overall_map: Dict[int, Tuple[float, float, float]],
    article_count_map: Dict[Tuple[int, int], int],
    keyword_name_map: Dict[int, str],
    delta_scale: Optional[float] = None,
) -> Tuple[List[ContentBiasItem], Dict[str, int]]:
    """
    Compute content-bias rows for a single period.

    Each media row is compared against the overall baseline for the same keyword.
    If an explicit overall row is missing, we fall back to a weighted average of
    media rows, then a simple average.
    """
    period = str(period_filter).upper().strip()
    resolved_delta_scale = max(
        0.0,
        float(settings.bias_content_delta_scale if delta_scale is None else delta_scale),
    )
    if period not in _ALLOWED_PERIODS:
        raise ValueError(f"period_filter must be one of {', '.join(SUPPORTED_PERIODS)}: {period_filter}")

    if not media_rows:
        return (
            [],
            {
                "trend_run_seq": int(trend_run_seq),
                "keywords": 0,
                "items": 0,
                "filtered_out_period_mismatch": 0,
                "missing_keyword_name": 0,
                "missing_baseline": 0,
            },
        )

    filtered_out = 0
    rows_filtered: List[SentimentContentRow] = []
    by_keyword: Dict[int, List[SentimentContentRow]] = {}

    for row in media_rows:
        if str(row.period_filter).upper().strip() != period:
            filtered_out += 1
            continue
        rows_filtered.append(row)
        by_keyword.setdefault(int(row.keyword_seq), []).append(row)

    if not rows_filtered:
        return (
            [],
            {
                "trend_run_seq": int(trend_run_seq),
                "keywords": 0,
                "items": 0,
                "filtered_out_period_mismatch": int(filtered_out),
                "missing_keyword_name": 0,
                "missing_baseline": 0,
            },
        )

    missing_keyword_name = 0
    missing_baseline = 0
    items: List[ContentBiasItem] = []

    for row in rows_filtered:
        keyword_seq = int(row.keyword_seq)
        media_code = int(row.media_code)

        base = overall_map.get(keyword_seq)
        if base is None:
            rows_same_keyword = by_keyword.get(keyword_seq, [])
            weighted_avg = _weighted_overall_from_media(rows_same_keyword, counts=article_count_map)
            if weighted_avg is not None:
                base = weighted_avg
            else:
                simple_avg = _avg_overall_from_media(rows_same_keyword)
                if simple_avg is None:
                    missing_baseline += 1
                    continue
                base = simple_avg

        base_pos, base_neu, base_neg = base
        score = _bias_score_content_continuous(
            media_pos=float(row.positive_pct_content),
            media_neu=float(row.neutral_pct_content),
            media_neg=float(row.negative_pct_content),
            base_pos=float(base_pos),
            base_neu=float(base_neu),
            base_neg=float(base_neg),
            delta_scale=resolved_delta_scale,
        )

        keyword_name = keyword_name_map.get(keyword_seq)
        if not keyword_name:
            missing_keyword_name += 1
            keyword_name = f"keyword_seq={keyword_seq}"

        items.append(
            ContentBiasItem(
                keyword_seq=keyword_seq,
                keyword_name=str(keyword_name),
                media_code=media_code,
                period_filter=period,
                bias_score_content=score,
            )
        )

    stats = {
        "trend_run_seq": int(trend_run_seq),
        "keywords": len(by_keyword),
        "items": len(items),
        "filtered_out_period_mismatch": int(filtered_out),
        "missing_keyword_name": int(missing_keyword_name),
        "missing_baseline": int(missing_baseline),
    }
    return (items, stats)


calc_content_bias_items = compute_content_bias_items
