# data-pipeline/src/analyzer/bias/title/core/title_bias.py
# 제목 감성분석 결과(언론사별 분포)로 제목 편향도 지수를 계산하는 "핵심 로직" 모듈 (순수 계산 + 실행 오케스트레이션)
#
# 편향도 지수(Title Bias Score) 정의(단일 값, -10 ~ +10, 3방향 인코딩):
# - 분포 P(media) = (pos, neu, neg), Q(overall) = (pos, neu, neg) 를 확률(합=1)로 만든다.
# - 델타: d = P - Q
#     d_pos = p_pos - q_pos
#     d_neu = p_neu - q_neu
#     d_neg = p_neg - q_neg
# - "가장 큰 변화(절대값)" 축을 dominant로 보고, 점수를 아래 구간으로 매핑한다.
#
#   NEG(부정 쏠림):  [-10 .. -4]  (부정 비중이 전체 대비 증가한 방향)
#   NEU(중립 쏠림):  [-3  .. +3]  (중립 비중 증감 방향, +는 중립 증가, -는 중립 감소=양극화)
#   POS(긍정 쏠림):  [+4  .. +10] (긍정 비중이 전체 대비 증가한 방향)
#
# - dominant 축이 감소(d < 0)인 경우, 확률합=1 특성상 다른 축이 증가하게 되므로
#   증가(d > 0)하는 축(neg/neu 또는 pos/neu)을 우선순위로 선택하여 방향을 결정한다.
#
# - 스케일:
#   - POS/NEG 구간:  score = 4 + min(6, delta * 10)  -> 4..10
#   - NEU 구간:      score = sign(delta) * min(3, |delta| * 5) -> -3..+3
#
# overall 기준(입력으로 주어지는 overall_map 활용):
# - overall_map에 (keyword_seq -> (pos, neu, neg))가 있으면 그 값을 사용
# - 없으면 같은 키워드의 언론사 row들을 이용해 overall을 추정
#   - 1순위: 기사수(counts_map) 가중평균
#   - 2순위: 기사수가 없거나 전부 0이면 단순 평균
#
# 실행 오케스트레이션(run_title_bias_for_run):
# - DB 조회(reader) -> 계산(calc_title_bias_items) -> DB 저장(writer)
# - refresh는 DELETE 금지(본문 점수와 충돌). 동일 run+period의 BIAS_SCORE_TITLE만 0으로 reset 후 UPSERT.
#
# 지원 기간:
# - TODAY, D7, D14

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"

SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14)


@dataclass(frozen=True)
class SentimentTitleRow:
    """
    제목 감성분석 입력 row(언론사별).
    - media_code는 언론사 코드(0은 overall로 쓰는 경우가 많으니, 여기서는 보통 0이 아닌 값이 들어온다고 가정)
    - positive/neutral/negative는 "퍼센트(0~100)" 값
    """
    keyword_seq: int
    media_code: int
    period_filter: str
    positive_pct_title: float
    neutral_pct_title: float
    negative_pct_title: float


@dataclass(frozen=True)
class TitleBiasItem:
    keyword_seq: int
    keyword_name: str
    media_code: int
    period_filter: str
    bias_score_title: float  # -10 .. +10 (단일 값 3방향 인코딩)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


def _normalize_period_filter(raw: str) -> str:
    pf = str(raw).upper().strip()
    if pf not in SUPPORTED_PERIODS:
        supported = "/".join(SUPPORTED_PERIODS)
        raise ValueError(f"period_filter는 {supported} 중 하나여야 합니다: {pf}")
    return pf


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


def _avg_overall_from_media(rows: List[SentimentTitleRow]) -> Optional[Tuple[float, float, float]]:
    if not rows:
        return None
    pos = sum(float(r.positive_pct_title) for r in rows) / len(rows)
    neu = sum(float(r.neutral_pct_title) for r in rows) / len(rows)
    neg = sum(float(r.negative_pct_title) for r in rows) / len(rows)
    return (pos, neu, neg)


def _weighted_overall_from_media(
    rows: List[SentimentTitleRow],
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
        sum_pos += float(r.positive_pct_title) * w
        sum_neu += float(r.neutral_pct_title) * w
        sum_neg += float(r.negative_pct_title) * w

    if sum_w <= 0.0:
        return None

    return (sum_pos / sum_w, sum_neu / sum_w, sum_neg / sum_w)


def _bias_score_title_signed_3dir(
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
      -10..-4 : 부정(NEG) 쏠림
       -3..+3 : 중립(NEU) 쏠림 (+는 중립 증가, -는 중립 감소=양극화)
       +4..+10: 긍정(POS) 쏠림
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

    # NEU가 가장 크게 변한 경우: -3..+3
    if dominant == "neu":
        mag = min(3.0, abs(d_neu) * 5.0)
        score = mag if d_neu >= 0.0 else -mag
        return float(_clamp(score, -3.0, 3.0))

    # POS/NEG가 가장 크게 변한 경우:
    # - d가 증가(>0)면 해당 방향을 사용
    # - d가 감소(<0)면 증가하는 축(neg/neu 또는 pos/neu)을 비교해서 방향을 재결정
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

        # 예외적으로 증가축 판단이 애매하면 0
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


def calc_title_bias_items(
    *,
    period_filter: str,
    media_rows: Iterable[SentimentTitleRow],
    overall_map: Dict[int, Tuple[float, float, float]],
    counts_map: Dict[Tuple[int, int], int],
    keyword_name_map: Optional[Dict[int, str]] = None,
) -> List[TitleBiasItem]:
    """
    제목 편향도 핵심 계산(순수 로직).

    입력:
      - period_filter: "TODAY" 또는 "D7" 또는 "D14"
      - media_rows: 언론사별 제목 감성 비율 row들 (보통 media_code != 0)
      - overall_map: (keyword_seq -> (pos, neu, neg)) overall(전체) 분포
          - 없으면 fallback으로 (가중평균 -> 단순평균) 계산
      - counts_map: (keyword_seq, media_code) -> article_count (fallback 가중평균용)
      - keyword_name_map: (keyword_seq -> keyword_name) (선택)
          - 없으면 "keyword_seq=<kseq>"로 대체

    출력:
      - TitleBiasItem 리스트 (언론사별)
        - bias_score_title: -10 .. +10 (3방향 단일 값)
    """
    pf = _normalize_period_filter(period_filter)
    rows_list = list(media_rows)

    # 키워드별로 언론사 row를 묶어 overall fallback 계산에 사용
    by_keyword: Dict[int, List[SentimentTitleRow]] = {}
    for r in rows_list:
        # period mismatch row가 섞여 들어오면 무시(안전)
        if str(r.period_filter).upper().strip() != pf:
            continue
        by_keyword.setdefault(int(r.keyword_seq), []).append(r)

    items: List[TitleBiasItem] = []
    kn_map = keyword_name_map or {}

    for r in rows_list:
        if str(r.period_filter).upper().strip() != pf:
            continue

        kseq = int(r.keyword_seq)
        mcode = int(r.media_code)

        # baseline(전체) 확보: overall_map 우선, 없으면 fallback
        base = overall_map.get(kseq)
        if base is None:
            rows_same_kw = by_keyword.get(kseq, [])
            wavg = _weighted_overall_from_media(rows_same_kw, counts=counts_map)
            if wavg is not None:
                base = wavg
            else:
                avg = _avg_overall_from_media(rows_same_kw)
                if avg is None:
                    continue
                base = avg

        base_pos, base_neu, base_neg = base

        score = _bias_score_title_signed_3dir(
            media_pos=float(r.positive_pct_title),
            media_neu=float(r.neutral_pct_title),
            media_neg=float(r.negative_pct_title),
            base_pos=float(base_pos),
            base_neu=float(base_neu),
            base_neg=float(base_neg),
        )

        kw_name = kn_map.get(kseq) or f"keyword_seq={kseq}"

        items.append(
            TitleBiasItem(
                keyword_seq=kseq,
                keyword_name=kw_name,
                media_code=mcode,
                period_filter=pf,
                bias_score_title=score,
            )
        )

    return items


def run_title_bias_for_run(
    *,
    trend_run_seq: int,
    period_filter: str,
    refresh_same_run: bool,
) -> Dict[str, Any]:
    """
    제목 편향도 실행(DB 조회 -> 계산 -> DB 저장) 오케스트레이션.

    - 입력: TREND_RUN_SEQ, PERIOD_FILTER(TODAY/D7/D14), refresh 여부
    - 동작:
      1) T_ANALYZE_SENTIMENT에서 언론사별 제목 감성비율 조회
      2) overall(MEDIA_CODE=0) 있으면 사용, 없으면 기사수 가중평균 -> 단순평균 fallback
      3) 3방향 단일 값(-10..+10) 편향 점수 계산
      4) refresh면 같은 run+period에서 BIAS_SCORE_TITLE만 0으로 reset
      5) T_ANALYZE_MEDIA_BIAS에 UPSERT
    """
    pf = _normalize_period_filter(period_filter)

    # 레이어 간 결합을 최소화하려고 내부 import 사용
    from src.common.db import get_conn
    from src.analyzer.bias.title.storage.title_bias_reader import (
        select_media_article_counts,
        select_media_sentiments_title,
        select_keyword_name,
        select_overall_sentiments_title,
    )
    from src.analyzer.bias.title.storage.title_bias_writer import (
        reset_title_bias_for_run_period,
        upsert_title_bias_rows,
    )

    conn = get_conn(autocommit=True)
    try:
        media_rows = select_media_sentiments_title(conn=conn, trend_run_seq=int(trend_run_seq), period_filter=pf)
        overall_map = select_overall_sentiments_title(conn=conn, trend_run_seq=int(trend_run_seq), period_filter=pf)
        counts_map = select_media_article_counts(conn=conn, trend_run_seq=int(trend_run_seq), period_filter=pf)

        # 키워드명 맵 구성(필요시 IN 쿼리로 최적화 가능)
        keyword_name_map: Dict[int, str] = {}
        for r in media_rows:
            kseq = int(r.keyword_seq)
            if kseq not in keyword_name_map:
                keyword_name_map[kseq] = select_keyword_name(conn=conn, keyword_seq=kseq)

        items = calc_title_bias_items(
            period_filter=pf,
            media_rows=media_rows,
            overall_map=overall_map,
            counts_map=counts_map,
            keyword_name_map=keyword_name_map,
        )

        reset_cnt = 0
        if bool(refresh_same_run):
            reset_cnt = reset_title_bias_for_run_period(conn=conn, trend_run_seq=int(trend_run_seq), period_filter=pf)

        write_rows = [(it.keyword_seq, it.media_code, it.period_filter, it.bias_score_title) for it in items]
        written = upsert_title_bias_rows(conn=conn, trend_run_seq=int(trend_run_seq), rows=write_rows)

        return {
            "trend_run_seq": int(trend_run_seq),
            "period_filter": pf,
            "refresh": bool(refresh_same_run),
            "media_rows": int(len(media_rows)),
            "overall_rows": int(len(overall_map)),
            "reset_rows": int(reset_cnt),
            "items": int(len(items)),
            "written": int(written),
        }
    finally:
        conn.close()
