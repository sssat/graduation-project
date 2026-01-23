# data-pipeline/src/analyzer/final_rank/core/final_rank_calc.py
# 최종 순위 계산(순수 로직): 필터링/정규화/랭킹 부여
# - DB 접근 없음

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Dict, Iterable, List, Sequence, Tuple


PERIOD_TODAY = "TODAY"
PERIOD_D7 = "D7"
PERIOD_D14 = "D14"
SUPPORTED_PERIODS = (PERIOD_TODAY, PERIOD_D7, PERIOD_D14)


_RE_NUMERIC_ONLY = re.compile(r"^\d+$")
_RE_HAS_KOREAN = re.compile(r"[가-힣]")
# 영문-only(대략): 영문/숫자/공백/일부 구두점만 허용
_RE_ENGLISH_ONLY = re.compile(r"^[A-Za-z0-9\s'’\-\._]+$")


def norm_kw(s: str) -> str:
    return " ".join((s or "").strip().lower().split())


# data-pipeline/src/analyzer/final_rank/core/final_rank_calc.py

def parse_english_whitelist(raw: str | None) -> set[str]:
    """
    raw 예: "tesla,chatgpt,bitcoin"
    """
    raw = (raw or "").strip()
    if not raw:
        return set()

    items: List[str] = []
    for part in raw.split(","):
        p = norm_kw(part)
        if p:
            items.append(p)
    return set(items)



@dataclass(frozen=True)
class KeywordRow:
    keyword_seq: int
    keyword_name: str


def is_numeric_only(name: str) -> bool:
    return bool(_RE_NUMERIC_ONLY.match((name or "").strip()))


def is_english_only(name: str) -> bool:
    s = (name or "").strip()
    if not s:
        return False
    # 한글이 하나라도 있으면 영문-only로 보지 않음
    if _RE_HAS_KOREAN.search(s):
        return False
    return bool(_RE_ENGLISH_ONLY.match(s))


@dataclass(frozen=True)
class FilterStats:
    excluded_total: int
    excluded_numeric: int
    excluded_english: int
    kept_by_whitelist: int


def filter_keywords_for_final_rank(
    *,
    keywords: Sequence[KeywordRow],
    english_whitelist: set[str],
) -> Tuple[List[Tuple[int, str]], List[int], FilterStats]:
    """
    최종순위 단계에서만 적용되는 필터링.

    반환:
      - included: [(keyword_seq, keyword_name), ...]
      - excluded_keyword_seqs: [keyword_seq, ...]
      - stats: FilterStats
    """
    included: List[Tuple[int, str]] = []
    excluded_keyword_seqs: List[int] = []

    excluded_total = 0
    excluded_numeric = 0
    excluded_english = 0
    kept_by_whitelist = 0

    for kw in keywords:
        name = kw.keyword_name

        # 숫자-only 제외
        if is_numeric_only(name):
            excluded_total += 1
            excluded_numeric += 1
            excluded_keyword_seqs.append(kw.keyword_seq)
            continue

        # 영문-only는 whitelist만 허용
        if is_english_only(name):
            n = norm_kw(name)
            if n in english_whitelist:
                kept_by_whitelist += 1
                included.append((kw.keyword_seq, name))
            else:
                excluded_total += 1
                excluded_english += 1
                excluded_keyword_seqs.append(kw.keyword_seq)
            continue

        # 나머지(한글 포함 or 혼합)는 허용
        included.append((kw.keyword_seq, name))

    return (
        included,
        excluded_keyword_seqs,
        FilterStats(
            excluded_total=excluded_total,
            excluded_numeric=excluded_numeric,
            excluded_english=excluded_english,
            kept_by_whitelist=kept_by_whitelist,
        ),
    )


def rank_by_article_count(
    *,
    included: Sequence[Tuple[int, str]],
    sum_map: Dict[int, int],
) -> List[Tuple[int, int, int]]:
    """
    포함된 키워드들에 대해 기사수 기준 정렬 후 FINAL_RANK 부여.
    - 기사수가 같으면 keyword_seq 오름차순으로 안정 정렬

    반환: [(keyword_seq, article_count, final_rank), ...]
    """
    ranked_base = sorted(
        ((kseq, int(sum_map.get(kseq, 0))) for (kseq, _name) in included),
        key=lambda x: (-x[1], x[0]),
    )

    out: List[Tuple[int, int, int]] = []
    for idx, (kseq, cnt) in enumerate(ranked_base, start=1):
        out.append((kseq, cnt, idx))
    return out
