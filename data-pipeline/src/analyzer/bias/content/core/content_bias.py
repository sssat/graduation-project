# data-pipeline/src/analyzer/bias/content/core/content_bias.py
# 본문 감성분석 결과(T_ANALYZE_SENTIMENT의 CONTENT 비율 컬럼 등)를 이용해
# 언론사별 본문 편향도 지수를 계산하는 "순수 로직" 모듈
# - DB I/O(조회/적재), 트랜잭션, get_conn 호출을 하지 않는다.
# - 필요한 입력(media 분포, overall 분포, 기사수 가중치, 키워드명)은 호출자가 주입한다.
#
# 편향도 지수(Content Bias Score) 정의(단일 값, -10 ~ +10, 3방향 인코딩):
# - 분포 P(media) = (pos, neu, neg), Q(overall) = (pos, neu, neg) 를 확률(합=1)로 만든다.
# - 델타: d = P - Q
#     d_pos = p_pos - q_pos
#     d_neu = p_neu - q_neu
#     d_neg = p_neg - q_neg
#
# - 점수는 "방향(긍정/중립/부정)"을 값 구간으로 인코딩하여 단일 숫자만으로 해석 가능하게 만든다.
#   NEG(부정 쏠림):  [-10 .. -4]  (부정 비중이 전체 대비 증가)
#   NEU(중립 쏠림):  [-3  .. +3]  (중립 비중 증감: +는 중립 증가, -는 중립 감소=양극화)
#   POS(긍정 쏠림):  [+4  .. +10] (긍정 비중이 전체 대비 증가)
#
# - dominant(가장 크게 변한 축, 절대값 기준)를 기준으로 방향을 결정하되,
#   dominant 축이 "감소(d<0)"로 잡히는 경우(예: pos가 많이 감소)에는
#   확률합=1 특성상 증가(d>0)하는 축(neg/neu 또는 pos/neu) 중 더 큰 쪽으로 방향을 재결정한다.
#
# - 스케일(확률 차이를 점수 구간에 매핑):
#   - POS/NEG 구간: score = 4 + min(6, delta * 10)  -> 4..10 (delta는 증가량, 0..1)
#   - NEU 구간:     score = sign(delta) * min(3, |delta| * 5) -> -3..+3
#
# overall 기준(키워드별):
# - media_code=0(전체 집계) row가 있으면 overall_map에 들어온 값을 사용
# - 없으면 기사수 가중평균(ARTICLE_COUNT)으로 overall 추정
# - 가중치가 없거나 합이 0이면 단순 평균으로 overall 추정
#
# 주의:
# - 본 모듈은 "period_filter 단일값"을 기준으로 계산한다.
#   period_filter가 다른 row가 섞여 들어오면 안전하게 무시한다.

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"  # 필요 시 확장용(다른 모듈도 함께 지원해야 실제 사용 가능)
SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14)
_ALLOWED_PERIODS = set(SUPPORTED_PERIODS)


@dataclass(frozen=True)
class SentimentContentRow:
    """
    언론사별 본문 감성 분포(퍼센트, 0~100)
    - 보통 MEDIA_CODE != 0 인 row만 전달된다고 가정
    """
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
    bias_score_content: float  # -10 .. +10 (단일 값 3방향 인코딩)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _to_prob3(pos_pct: float, neu_pct: float, neg_pct: float) -> Tuple[float, float, float]:
    """
    (pos, neu, neg) 퍼센트(0~100)를 확률(합=1)로 정규화한다.
    - 반올림/집계 오차로 합이 100이 아닐 수 있으므로 안전하게 정규화.
    - 음수는 0으로 보정한다.
    """
    p = max(0.0, float(pos_pct))
    n = max(0.0, float(neu_pct))
    g = max(0.0, float(neg_pct))

    s = p + n + g
    if s <= 0.0:
        return (0.0, 0.0, 0.0)

    return (p / s, n / s, g / s)


def _bias_score_content_signed_3dir(
    *,
    media_pos: float,
    media_neu: float,
    media_neg: float,
    base_pos: float,
    base_neu: float,
    base_neg: float,
) -> float:
    """
    단일 값( -10 .. +10 ) 3방향 편향 점수.

    구간 의미:
      -10..-4 : 부정(NEG) 쏠림 (부정 비중이 전체 대비 증가)
       -3..+3 : 중립(NEU) 쏠림 (+는 중립 증가, -는 중립 감소=양극화)
       +4..+10: 긍정(POS) 쏠림 (긍정 비중이 전체 대비 증가)
    """
    p = _to_prob3(media_pos, media_neu, media_neg)
    q = _to_prob3(base_pos, base_neu, base_neg)

    d_pos = p[0] - q[0]
    d_neu = p[1] - q[1]
    d_neg = p[2] - q[2]

    # 완전 동일
    if abs(d_pos) < 1e-12 and abs(d_neu) < 1e-12 and abs(d_neg) < 1e-12:
        return 0.0

    a_pos = abs(d_pos)
    a_neu = abs(d_neu)
    a_neg = abs(d_neg)

    # dominant 결정(동률이면 NEU > POS > NEG 우선)
    dominant = "neu"
    if a_pos > a_neu and a_pos >= a_neg:
        dominant = "pos"
    elif a_neg > a_neu and a_neg > a_pos:
        dominant = "neg"
    else:
        dominant = "neu"

    # 1) NEU가 가장 크게 변한 경우: -3..+3
    if dominant == "neu":
        mag = min(3.0, abs(d_neu) * 5.0)
        score = mag if d_neu >= 0.0 else -mag
        return float(_clamp(score, -3.0, 3.0))

    # 2) POS/NEG가 가장 크게 변한 경우
    # - dominant 축이 증가(>0)면 해당 방향
    # - dominant 축이 감소(<0)이면 증가하는 축(neg/neu 또는 pos/neu)을 비교해 방향 재결정
    if dominant == "pos":
        if d_pos > 0.0:
            mag = min(6.0, d_pos * 10.0)
            return float(_clamp(4.0 + mag, 4.0, 10.0))

        # pos가 줄었다: neg 또는 neu가 늘어났을 가능성이 크다
        if d_neg > 0.0 and d_neg >= d_neu:
            mag = min(6.0, d_neg * 10.0)
            return float(_clamp(-(4.0 + mag), -10.0, -4.0))

        if d_neu > 0.0:
            mag = min(3.0, d_neu * 5.0)
            return float(_clamp(mag, -3.0, 3.0))

        return 0.0

    # dominant == "neg"
    if d_neg > 0.0:
        mag = min(6.0, d_neg * 10.0)
        return float(_clamp(-(4.0 + mag), -10.0, -4.0))

    # neg가 줄었다: pos 또는 neu가 늘어났을 가능성이 크다
    if d_pos > 0.0 and d_pos >= d_neu:
        mag = min(6.0, d_pos * 10.0)
        return float(_clamp(4.0 + mag, 4.0, 10.0))

    if d_neu > 0.0:
        mag = min(3.0, d_neu * 5.0)
        return float(_clamp(mag, -3.0, 3.0))

    return 0.0


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
    """
    (키워드 내) 언론사별 감성비율을 기사수(article_count)로 가중평균해서 overall을 추정한다.
    counts: (keyword_seq, media_code) -> article_count

    - 기사수 합계가 0이면 None 반환(호출부에서 단순 평균 fallback)
    """
    if not rows:
        return None

    sum_w = 0.0
    sum_pos = 0.0
    sum_neu = 0.0
    sum_neg = 0.0

    for r in rows:
        w = float(max(0, int(counts.get((int(r.keyword_seq), int(r.media_code)), 0))))
        if w <= 0.0:
            continue
        sum_w += w
        sum_pos += float(r.positive_pct_content) * w
        sum_neu += float(r.neutral_pct_content) * w
        sum_neg += float(r.negative_pct_content) * w

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
) -> Tuple[List[ContentBiasItem], Dict[str, int]]:
    """
    순수 계산 함수: 언론사별 본문 편향도 점수를 계산한다.

    입력:
      - media_rows: 언론사별 본문 감성 분포 (MEDIA_CODE != 0)
      - overall_map: keyword_seq -> (pos, neu, neg) (MEDIA_CODE=0이 있을 때의 전체 집계)
      - article_count_map: (keyword_seq, media_code) -> article_count (overall 추정 가중치)
      - keyword_name_map: keyword_seq -> keyword_name

    반환:
      - items: ContentBiasItem 리스트(언론사별)
      - stats: 요약 카운트들
    """
    pf = str(period_filter).upper().strip()
    if pf not in _ALLOWED_PERIODS:
        raise ValueError(f"period_filter는 {', '.join(SUPPORTED_PERIODS)} 중 하나여야 합니다: {period_filter}")

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

    # period mismatch row 안전 제거 + 키워드별 그룹핑(전체 baseline 추정용)
    filtered_out = 0
    rows_filtered: List[SentimentContentRow] = []
    by_keyword: Dict[int, List[SentimentContentRow]] = {}

    for r in media_rows:
        if str(r.period_filter).upper().strip() != pf:
            filtered_out += 1
            continue
        rows_filtered.append(r)
        by_keyword.setdefault(int(r.keyword_seq), []).append(r)

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
    for r in rows_filtered:
        kseq = int(r.keyword_seq)
        mcode = int(r.media_code)

        # baseline(전체) 확보: overall_map 우선, 없으면 fallback
        base = overall_map.get(kseq)
        if base is None:
            rows_same_kw = by_keyword.get(kseq, [])
            wavg = _weighted_overall_from_media(rows_same_kw, counts=article_count_map)
            if wavg is not None:
                base = wavg
            else:
                avg = _avg_overall_from_media(rows_same_kw)
                if avg is None:
                    missing_baseline += 1
                    continue
                base = avg

        base_pos, base_neu, base_neg = base

        score = _bias_score_content_signed_3dir(
            media_pos=float(r.positive_pct_content),
            media_neu=float(r.neutral_pct_content),
            media_neg=float(r.negative_pct_content),
            base_pos=float(base_pos),
            base_neu=float(base_neu),
            base_neg=float(base_neg),
        )

        kw_name = keyword_name_map.get(kseq)
        if not kw_name:
            missing_keyword_name += 1
            kw_name = f"keyword_seq={kseq}"

        items.append(
            ContentBiasItem(
                keyword_seq=kseq,
                keyword_name=str(kw_name),
                media_code=mcode,
                period_filter=pf,
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


# 호환용 별칭(원하는 명명 규칙으로 통일할 때 사용)
calc_content_bias_items = compute_content_bias_items
