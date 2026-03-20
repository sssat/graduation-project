# data-pipeline/src/analyzer/bias/title/core/title_bias.py
# 제목 감성분석 결과(언론사별 분포)로 제목 편향도 지수를 계산하는 "핵심 로직" 모듈 (순수 계산 + 실행 오케스트레이션)
#
# 편향도 지수(Title Bias Score) 정의(단일 값, -10 ~ +10, 연속형):
# - 분포 P(media) = (pos, neu, neg), Q(overall) = (pos, neu, neg) 를 확률(합=1)로 만든다.
# - 각 분포의 "순감성(net sentiment)" 을 (pos - neg) 로 정의한다.
# - overall 대비 차이(delta_net) = (p_pos - p_neg) - (q_pos - q_neg)
# - 점수는 score = clamp(delta_net * 5, -10, +10) 로 계산한다.
#   - overall과 완전히 같으면 0점
#   - overall보다 더 긍정 쪽이면 +점
#   - overall보다 더 부정 쪽이면 -점
#   - 절대값이 클수록 overall 대비 차이가 큰 것으로 해석한다.
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
# - TODAY, D7, D14, D30

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"
PERIOD_D30 = "D30"

SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14, PERIOD_D30)


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
    bias_score_title: float  # -10 .. +10 (단일 값, overall 대비 연속형 점수)


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


def _bias_score_title_continuous(
    *,
    media_pos: float,
    media_neu: float,
    media_neg: float,
    base_pos: float,
    base_neu: float,
    base_neg: float,
) -> float:
    """
    단일 값( -10 .. +10 ) 연속형 제목 편향 점수.

    계산 방식:
      - media 순감성  = (pos - neg)
      - overall 순감성 = (pos - neg)
      - delta_net = media_net - overall_net
      - score = clamp(delta_net * 5, -10, +10)

    해석:
      - 0 : overall과 동일한 감성 분포
      - + : overall보다 더 긍정 쪽
      - - : overall보다 더 부정 쪽
      - |score|가 클수록 overall 대비 차이가 큼
    """
    p = _to_prob3(media_pos, media_neu, media_neg)
    q = _to_prob3(base_pos, base_neu, base_neg)

    media_net = p[0] - p[2]
    base_net = q[0] - q[2]
    delta_net = media_net - base_net

    score = delta_net * 13.0
    return float(_clamp(score, -10.0, 10.0))


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
      - period_filter: "TODAY" 또는 "D7" 또는 "D14" 또는 "D30"
      - media_rows: 언론사별 제목 감성 비율 row들 (보통 media_code != 0)
      - overall_map: (keyword_seq -> (pos, neu, neg)) overall(전체) 분포
          - 없으면 fallback으로 (가중평균 -> 단순평균) 계산
      - counts_map: (keyword_seq, media_code) -> article_count (fallback 가중평균용)
      - keyword_name_map: (keyword_seq -> keyword_name) (선택)
          - 없으면 "keyword_seq=<kseq>"로 대체

    출력:
      - TitleBiasItem 리스트 (언론사별)
        - bias_score_title: -10 .. +10 (overall 대비 연속형 단일 값)
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

        score = _bias_score_title_continuous(
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

    - 입력: TREND_RUN_SEQ, PERIOD_FILTER(TODAY/D7/D14/D30), refresh 여부
    - 동작:
      1) T_ANALYZE_SENTIMENT에서 언론사별 제목 감성비율 조회
      2) overall(MEDIA_CODE=0) 있으면 사용, 없으면 기사수 가중평균 -> 단순평균 fallback
      3) overall 대비 연속형 단일 값(-10..+10) 편향 점수 계산
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
