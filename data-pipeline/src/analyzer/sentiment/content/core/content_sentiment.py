# data-pipeline/src/analyzer/sentiment/content/core/content_sentiment.py
# 본문(CONTENT_CLEAN) 기반 감성분석(LLM 미사용)
# - Transformers 분류 모델 래퍼는 title/core/sentiment.py를 재사용
# - 본문은 길 수 있으므로 문자 기반 chunking 유틸을 제공한다.

from __future__ import annotations

from typing import List

from src.analyzer.sentiment.title.core.title_sentiment import (
    SentimentModel,
    SentimentProba,
    mean_proba,
    to_pct,
)

__all__ = [
    "SentimentModel",
    "SentimentProba",
    "mean_proba",
    "to_pct",
    "split_text_into_chunks_by_chars",
]


def split_text_into_chunks_by_chars(
    text: str,
    *,
    chunk_size: int,
    overlap: int,
    max_chunks: int,
) -> List[str]:
    """
    문자 기준 chunking.
    - chunk_size: 한 조각 길이(문자)
    - overlap: 겹치는 길이(문자)
    - max_chunks: 최대 조각 수(과도한 비용/시간 방지)

    반환: 앞에서부터 잘린 chunk 리스트
    """
    s = (text or "").strip()
    if not s:
        return []

    chunk_size = max(1, int(chunk_size))
    overlap = max(0, int(overlap))
    if overlap >= chunk_size:
        overlap = max(0, chunk_size // 4)

    step = max(1, chunk_size - overlap)

    out: List[str] = []
    start = 0
    while start < len(s) and len(out) < max(1, int(max_chunks)):
        end = min(len(s), start + chunk_size)
        piece = s[start:end].strip()
        if piece:
            out.append(piece)
        start += step

    return out
