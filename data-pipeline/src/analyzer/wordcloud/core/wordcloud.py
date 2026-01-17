# data-pipeline/src/analyzer/wordcloud/core/wordcloud.py
# 워드클라우드 핵심 로직(core)
# - DB I/O 없이 "토큰 목록 -> (단어, 가중치) 상위 K"를 계산하는 순수 계산 로직만 제공
# - 전처리/토큰화/불용어/필터링은 preprocess/tokenize 레이어에서 수행한다.

from __future__ import annotations

import math
from collections import Counter
from dataclasses import dataclass
from typing import Iterable, List, Sequence


@dataclass(frozen=True)
class WordcloudItem:
    rank_no: int
    word_text: str
    weight: float
    count: int


def build_wordcloud_items_from_tokens(
    tokens: Sequence[str] | Iterable[str],
    *,
    top_k: int = 60,
    weight_mode: str = "log",  # "count" | "log"
) -> List[WordcloudItem]:
    """
    토큰 목록에서 워드클라우드 상위 K개를 만든다.

    전제:
    - tokens는 preprocess/tokenize 단계에서 이미 정규화/필터링(불용어, 길이, 숫자-only 제거 등)이 끝난 상태

    weight_mode:
    - "count": weight = count
    - "log":   weight = log(1 + count)
    """
    top_k = max(1, int(top_k))
    wm = (weight_mode or "").strip().lower()
    if wm not in {"log", "count"}:
        wm = "log"

    counter: Counter[str] = Counter()
    for tok in tokens:
        t = (tok or "").strip()
        if not t:
            continue
        counter[t] += 1

    if not counter:
        return []

    # 빈도 기준 내림차순, 동률이면 사전순(재현성)
    sorted_items = sorted(counter.items(), key=lambda x: (-x[1], x[0]))[:top_k]

    out: List[WordcloudItem] = []
    for idx, (w, c) in enumerate(sorted_items, start=1):
        wt = float(c) if wm == "count" else float(math.log1p(c))
        out.append(WordcloudItem(rank_no=idx, word_text=w, weight=wt, count=int(c)))
    return out
