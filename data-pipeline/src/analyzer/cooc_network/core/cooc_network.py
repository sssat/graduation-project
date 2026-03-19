# data-pipeline/src/analyzer/cooc_network/core/cooc_network.py
# 
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from itertools import combinations
from typing import Dict, Iterable, List, Sequence, Tuple

from src.analyzer.cooc_network.preprocess.cooc_preprocess import (
    CoocPreprocessOptions,
    preprocess_for_cooc,
)
from src.analyzer.cooc_network.tokenize.cooc_tokenize import (
    CoocTokenizeOptions,
    tokenize_for_cooc,
)


@dataclass(frozen=True)
class CoocNode:
    token: str
    doc_freq: int
    total_freq: int
    rank: int


@dataclass(frozen=True)
class CoocEdge:
    src: str
    dst: str
    weight: int
    rank: int


def _normalize_pair(a: str, b: str) -> Tuple[str, str]:
    return (a, b) if a <= b else (b, a)


def build_cooc_network(
    texts: Sequence[str],
    *,
    preprocess_opt: CoocPreprocessOptions,
    tokenize_opt: CoocTokenizeOptions,
    stopwords: set[str],
    mode: str,  # "doc" | "window"
    window_size: int,
    max_tokens_per_doc: int,
    node_top_k: int,
    edge_top_k: int,
    min_edge_weight: int,
) -> Tuple[List[CoocNode], List[CoocEdge], Dict[str, int]]:
    """
    공동언급 네트워크 생성.

    mode="doc":
      - 문서(기사) 단위로 토큰을 뽑고(문서 내 빈도 기준 상위 N개),
      - 같은 문서에 함께 등장한 토큰 쌍을 1회로 카운트한다(문서 기반 co-mention).

    mode="window":
      - 토큰 시퀀스에서 window_size 범위 내 동시 등장 쌍을 카운트한다(근접 기반 co-mention).
      - 안전을 위해 문서당 max_tokens_per_doc 길이로 시퀀스를 자른다.

    반환:
      nodes, edges, stats
    """
    m = (mode or "").strip().lower()
    if m not in {"doc", "window"}:
        m = "doc"

    window_size = max(2, int(window_size))
    max_tokens_per_doc = max(0, int(max_tokens_per_doc))
    node_top_k = max(0, int(node_top_k))
    edge_top_k = max(0, int(edge_top_k))
    min_edge_weight = max(1, int(min_edge_weight))

    node_doc_freq: Dict[str, int] = {}
    node_total_freq: Dict[str, int] = {}
    edge_counter: Dict[Tuple[str, str], int] = {}

    docs_input = len(texts)
    docs_used = 0
    docs_skipped_empty = 0
    docs_skipped_too_few_tokens = 0

    for raw in texts:
        s = preprocess_for_cooc(raw, opt=preprocess_opt)
        if not s:
            docs_skipped_empty += 1
            continue

        tokens = tokenize_for_cooc(s, opt=tokenize_opt, stopwords=stopwords)
        if not tokens:
            docs_skipped_empty += 1
            continue

        token_counts = Counter(tokens)

        if m == "doc":
            # 문서 내에서 중요한 토큰만 남겨서 조합 폭발을 막는다.
            items = sorted(token_counts.items(), key=lambda x: (-x[1], x[0]))
            if max_tokens_per_doc > 0:
                items = items[:max_tokens_per_doc]
            doc_terms = [t for t, _ in items]
        else:
            # window 모드는 시퀀스를 자르되 중복은 그대로 둔다(근접 정보용).
            seq = tokens
            if max_tokens_per_doc > 0:
                seq = seq[:max_tokens_per_doc]
            doc_terms = seq

        if len(doc_terms) < 2:
            docs_skipped_too_few_tokens += 1
            continue

        docs_used += 1

        # 노드 통계(빈도/문서빈도)는 실제 엣지 생성에 사용한 토큰 기준으로 맞춘다.
        node_counts = Counter(doc_terms)
        for t, c in node_counts.items():
            node_total_freq[t] = int(node_total_freq.get(t, 0)) + int(c)
        for t in set(doc_terms):
            node_doc_freq[t] = int(node_doc_freq.get(t, 0)) + 1

        # 엣지 카운트
        if m == "doc":
            # 문서 내 unique 조합
            uniq_terms = list(dict.fromkeys(doc_terms))  # 순서 유지 dedup
            if len(uniq_terms) < 2:
                continue
            for a, b in combinations(uniq_terms, 2):
                p = _normalize_pair(a, b)
                edge_counter[p] = int(edge_counter.get(p, 0)) + 1
        else:
            # window 기반
            seq = doc_terms
            n = len(seq)
            for i in range(n):
                a = seq[i]
                end = min(n, i + window_size)
                for j in range(i + 1, end):
                    b = seq[j]
                    if a == b:
                        continue
                    p = _normalize_pair(a, b)
                    edge_counter[p] = int(edge_counter.get(p, 0)) + 1

    if docs_used <= 0:
        return [], [], {
            "docs_input": int(docs_input),
            "docs_used": 0,
            "docs_skipped_empty": int(docs_skipped_empty),
            "docs_skipped_too_few_tokens": int(docs_skipped_too_few_tokens),
            "nodes_total": 0,
            "edges_total": 0,
            "edges_kept": 0,
        }

    # 노드 랭킹: doc_freq 우선, total_freq 보조
    node_items = []
    for t, df in node_doc_freq.items():
        tf = int(node_total_freq.get(t, 0))
        node_items.append((t, int(df), tf))

    node_items.sort(key=lambda x: (-x[1], -x[2], x[0]))

    if node_top_k > 0:
        node_items = node_items[:node_top_k]

    node_set = {t for (t, _, _) in node_items}

    nodes: List[CoocNode] = []
    for idx, (t, df, tf) in enumerate(node_items, start=1):
        nodes.append(CoocNode(token=t, doc_freq=int(df), total_freq=int(tf), rank=int(idx)))

    # 엣지 필터링: min_edge_weight + 노드셋 내부
    edge_items: List[Tuple[str, str, int]] = []
    for (a, b), w in edge_counter.items():
        if int(w) < min_edge_weight:
            continue
        if a not in node_set or b not in node_set:
            continue
        edge_items.append((a, b, int(w)))

    edge_items.sort(key=lambda x: (-x[2], x[0], x[1]))
    if edge_top_k > 0:
        edge_items = edge_items[:edge_top_k]

    edges: List[CoocEdge] = []
    for idx, (a, b, w) in enumerate(edge_items, start=1):
        edges.append(CoocEdge(src=a, dst=b, weight=int(w), rank=int(idx)))

    return nodes, edges, {
        "docs_input": int(docs_input),
        "docs_used": int(docs_used),
        "docs_skipped_empty": int(docs_skipped_empty),
        "docs_skipped_too_few_tokens": int(docs_skipped_too_few_tokens),
        "nodes_total": int(len(node_doc_freq)),
        "nodes_kept": int(len(nodes)),
        "edges_total": int(len(edge_counter)),
        "edges_kept": int(len(edges)),
    }